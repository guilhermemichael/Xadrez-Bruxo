import test from 'node:test';
import assert from 'node:assert/strict';
import { StockfishEngine } from '../src/ai/StockfishEngine.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

class FakeWorker {
  static behavior = {};
  constructor(url) {
    this.url = url;
    this.messages = [];
    this.terminated = false;
    FakeWorker.instances.push(this);
  }
  postMessage(command) {
    this.messages.push(command);
    const behavior = FakeWorker.behavior;
    if (command === 'uci' && behavior.handshake !== false) {
      queueMicrotask(() => this.onmessage?.({ data: 'id name Fake Stockfish\noption name Skill Level type spin default 20 min 0 max 20\noption name UCI_LimitStrength type check\noption name UCI_Elo type spin' }));
      queueMicrotask(() => this.onmessage?.({ data: 'uciok' }));
    } else if (command === 'isready' && behavior.ready !== false) {
      queueMicrotask(() => this.onmessage?.({ data: 'readyok' }));
    } else if (command.startsWith('go ') && behavior.bestmove) {
      setTimeout(() => this.onmessage?.({ data: `bestmove ${behavior.bestmove}` }), behavior.delay ?? 0);
    }
  }
  terminate() { this.terminated = true; }
}
FakeWorker.instances = [];

function makeEngine(overrides = {}) {
  FakeWorker.instances = [];
  FakeWorker.behavior = { bestmove: 'e2e4', ...overrides };
  return new StockfishEngine({ WorkerImpl: FakeWorker, timeoutMs: 40, baseUrl: '/xadrez/' });
}

test('faz handshake UCI, espera readyok e converte bestmove legal', async () => {
  const engine = makeEngine({ bestmove: 'e2e4' });
  const move = await engine.searchBestMove(START_FEN, 2);
  assert.deepEqual({ from: move.from, to: move.to, promotion: move.promotion }, { from: 'e2', to: 'e4', promotion: undefined });
  assert.equal(FakeWorker.instances[0].url, '/xadrez/assets/stockfish/stockfish-19-lite-single.js');
  assert.ok(FakeWorker.instances[0].messages.includes('isready'));
  engine.destroy();
});

test('converte promoção e rejeita bestmove ilegal', async () => {
  const promotionFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
  const engine = makeEngine({ bestmove: 'a7a8q' });
  const promotion = await engine.searchBestMove(promotionFen, 3);
  assert.equal(promotion.promotion, 'q');
  engine.destroy();

  const illegal = makeEngine({ bestmove: 'a7b8q' });
  await assert.rejects(illegal.searchBestMove(promotionFen, 2), /ilegal/);
  illegal.destroy();
});

test('trata timeout de inicialização e timeout de pesquisa', async () => {
  const initTimeout = makeEngine({ handshake: false });
  await assert.rejects(initTimeout.searchBestMove(START_FEN), /Timeout aguardando uciok/);
  initTimeout.destroy();

  const searchTimeout = makeEngine({ bestmove: null });
  await assert.rejects(searchTimeout.searchBestMove(START_FEN), /Timeout aguardando a jogada/);
  searchTimeout.destroy();
});

test('cancela uma pesquisa anterior e descarta resposta antiga', async () => {
  const engine = makeEngine({ bestmove: 'e2e4', delay: 20 });
  await engine.initialize();
  const previous = engine.searchBestMove(START_FEN, 1);
  engine.cancel();
  await assert.rejects(previous, /cancelada/);
  engine.destroy();
});

test('trata erro do Worker e libera o recurso', async () => {
  const engine = makeEngine({ handshake: false });
  const pending = engine.searchBestMove(START_FEN);
  FakeWorker.instances[0].onerror?.({ message: 'WASM indisponível' });
  await assert.rejects(pending, /WASM indisponível|Timeout aguardando uciok/);
  engine.destroy();
  assert.equal(FakeWorker.instances[0].terminated, true);
});
