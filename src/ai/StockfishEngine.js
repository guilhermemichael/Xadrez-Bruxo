import { Chess } from 'chess.js';

const DIFFICULTIES = Object.freeze({
  1: { skill: 0, movetime: 180, elo: 1350 },
  2: { skill: 8, movetime: 650, elo: 1800 },
  3: { skill: 20, movetime: 1800, elo: 2400 }
});

class StockfishEngine {
  constructor({ WorkerImpl = globalThis.Worker, baseUrl = '/', timeoutMs = 8000 } = {}) {
    this.WorkerImpl = WorkerImpl;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.timeoutMs = timeoutMs;
    this.worker = null;
    this.state = 'idle';
    this.requestId = 0;
    this.options = new Set();
    this.pending = null;
  }

  engineUrl() {
    return `${this.baseUrl}assets/stockfish/stockfish-19-lite-single.js`;
  }

  async initialize() {
    if (this.state === 'ready' || this.state === 'searching') return;
    if (!this.WorkerImpl) throw new Error('Web Worker não está disponível neste ambiente.');
    this.destroy();
    this.state = 'initializing';
    const worker = new this.WorkerImpl(this.engineUrl());
    this.worker = worker;
    worker.onmessage = (event) => this.handleLine(String(event?.data ?? ''));
    worker.onerror = (event) => this.fail(new Error(event?.message || 'Falha ao carregar o Stockfish.'));
    try {
      await this.waitFor('uciok', () => this.send('uci'));
      this.sendSupportedOptions();
      await this.waitFor('readyok', () => this.send('isready'));
      this.state = 'ready';
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  sendSupportedOptions() {
    if (this.options.has('Skill Level')) this.send('setoption name Skill Level value 20');
    if (this.options.has('UCI_LimitStrength')) this.send('setoption name UCI_LimitStrength value false');
  }

  waitFor(expected, start) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`Timeout aguardando ${expected}.`));
      }, this.timeoutMs);
      this.pending = { type: 'handshake', expected, resolve: () => { clearTimeout(timer); this.pending = null; resolve(); }, reject };
      try { start(); } catch (error) { clearTimeout(timer); this.pending = null; reject(error); }
    });
  }

  handleLine(line) {
    if (line.includes('\n')) {
      line.split(/\r?\n/).filter(Boolean).forEach((part) => this.handleLine(part));
      return;
    }
    if (line.startsWith('option name ')) {
      const option = line.slice('option name '.length).split(' type ')[0].trim();
      this.options.add(option);
    }
    if (this.pending?.type === 'handshake' && line === this.pending.expected) {
      this.pending.resolve();
      return;
    }
    if (this.pending?.type === 'search') {
      const info = this.parseInfo(line);
      if (info) this.pending.info?.(info);
      const match = line.match(/^bestmove\s+(\S+)/);
      if (match) this.completeSearch(match[1]);
    }
  }

  parseInfo(line) {
    const depth = line.match(/\bdepth\s+(\d+)/)?.[1];
    const scoreCp = line.match(/\bscore\s+cp\s+(-?\d+)/)?.[1];
    if (!depth && scoreCp === undefined) return null;
    return { depth: depth ? Number(depth) : undefined, scoreCp: scoreCp === undefined ? undefined : Number(scoreCp) };
  }

  send(command) {
    if (!this.worker) throw new Error('Worker do Stockfish não está disponível.');
    this.worker.postMessage(command);
  }

  async searchBestMove(fen, difficulty = 2, { info } = {}) {
    const requestId = this.requestId + 1;
    this.requestId = requestId;
    await this.initialize();
    if (requestId !== this.requestId) throw new Error('Pesquisa cancelada.');
    if (this.state === 'searching') this.cancel();
    const config = DIFFICULTIES[Math.max(1, Math.min(3, Number(difficulty) || 2))];
    this.state = 'searching';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending?.requestId !== requestId) return;
        this.pending = null;
        this.state = 'ready';
        this.send('stop');
        reject(new Error('Timeout aguardando a jogada do Stockfish.'));
      }, this.timeoutMs + config.movetime);
      this.pending = { type: 'search', requestId, fen, resolve: (move) => { clearTimeout(timer); this.pending = null; this.state = 'ready'; resolve(move); }, reject: (error) => { clearTimeout(timer); this.pending = null; this.state = 'ready'; reject(error); }, info };
      try {
        this.send(`setoption name Skill Level value ${config.skill}`);
        if (this.options.has('UCI_LimitStrength')) this.send(`setoption name UCI_LimitStrength value ${config.skill < 20}`);
        if (this.options.has('UCI_Elo')) this.send(`setoption name UCI_Elo value ${config.elo}`);
        this.send('ucinewgame');
        this.send(`position fen ${fen}`);
        this.send(`go movetime ${config.movetime}`);
      } catch (error) {
        clearTimeout(timer);
        this.pending = null;
        this.state = 'failed';
        reject(error);
      }
    });
  }

  completeSearch(uci) {
    const current = this.pending;
    if (!current || current.type !== 'search') return;
    const move = this.validateUciMove(uci, current.fen);
    if (!move) {
      current.reject(new Error(`O Stockfish retornou uma jogada ilegal: ${uci}`));
      return;
    }
    current.resolve(move);
  }

  validateUciMove(uci, fen) {
    if (!uci || uci === '(none)' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
    const game = new Chess(fen);
    const candidate = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    if (uci.length === 5) candidate.promotion = uci[4];
    return game.moves({ verbose: true }).find((move) => move.from === candidate.from && move.to === candidate.to && (move.promotion || null) === (candidate.promotion || null)) || null;
  }

  cancel(invalidate = true) {
    if (this.state === 'searching') {
      try { this.send('stop'); } catch (_) { /* Worker já pode ter encerrado. */ }
      this.pending?.reject(new Error('Pesquisa cancelada.'));
      this.pending = null;
      this.state = 'ready';
    }
    if (invalidate) this.requestId++;
  }

  fail(error) {
    this.pending?.reject(error);
    this.pending = null;
    this.state = 'failed';
  }

  destroy() {
    this.cancel(false);
    try { this.worker?.postMessage('quit'); } catch (_) { /* encerramento best-effort */ }
    try { this.worker?.terminate(); } catch (_) { /* encerramento best-effort */ }
    this.worker = null;
    this.state = 'idle';
  }
}

export { DIFFICULTIES, StockfishEngine };
