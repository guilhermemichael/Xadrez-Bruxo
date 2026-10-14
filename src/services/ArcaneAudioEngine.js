class ArcaneAudioEngine {
      constructor() {
        this.ctx = null;
        this.sfxEnabled = true;
        this.ttsEnabled = true;
      }

      initContext() {
        if (!this.ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
      }

      // Clique sutil de pedra ao selecionar uma escultura
      playSelectChime() {
        if (!this.sfxEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.095);
      }

      // Batida grave seca quando o usuário tenta um movimento ilegal
      playIllegalThud() {
        if (!this.sfxEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(52, now + 0.16);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      }

      // Som grave de escultura monolítica deslizando no tabuleiro
      playStoneSlide(duration = 0.38) {
        if (!this.sfxEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(130, now);
        filter.frequency.linearRampToValueAtTime(190, now + duration * 0.6);
        filter.frequency.linearRampToValueAtTime(105, now + duration);
        filter.Q.value = 3.2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.24, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.006, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + duration);
      }

      // Impacto brutal + estilhaçamento de pedra para capturas cinematográficas
      playStoneShatter() {
        if (!this.sfxEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // 1. Sub-grave de impacto físico
        const osc = this.ctx.createOscillator();
        const impactGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(155, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.36);

        impactGain.gain.setValueAtTime(0.6, now);
        impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(impactGain);
        impactGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.39);

        // 2. Estalos de fragmentos de rocha quicando no tabuleiro
        for (let i = 0; i < 7; i++) {
          const delay = 0.025 + i * 0.042 + Math.random() * 0.025;
          const fragDur = 0.075 + Math.random() * 0.08;
          const bufSize = Math.floor(this.ctx.sampleRate * fragDur);
          const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
          const ch = buf.getChannelData(0);
          for (let j = 0; j < bufSize; j++) {
            ch[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufSize * 0.34));
          }

          const src = this.ctx.createBufferSource();
          src.buffer = buf;

          const bandpass = this.ctx.createBiquadFilter();
          bandpass.type = 'bandpass';
          bandpass.frequency.value = 520 + Math.random() * 1350;
          bandpass.Q.value = 2.1;

          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.26 / (1 + i * 0.25), now + delay);
          g.gain.exponentialRampToValueAtTime(0.004, now + delay + fragDur);

          src.connect(bandpass);
          bandpass.connect(g);
          g.connect(this.ctx.destination);
          src.start(now + delay);
        }
      }

      // Alerta místico para Xeque ou Fim de Partida
      playArcaneChord(isMate = false) {
        if (!this.sfxEnabled) return;
        this.initContext();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = isMate ? [196.0, 233.08, 293.66, 392.0] : [220.0, 261.63, 329.63];

        freqs.forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.06);

          gain.gain.setValueAtTime(0.001, now + idx * 0.06);
          gain.gain.linearRampToValueAtTime(0.11, now + idx * 0.06 + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.35);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + 1.4);
        });
      }

      // Narração em Português Brasileiro via Web Speech Synthesis
      speakMove(text) {
        if (!this.ttsEnabled || !('speechSynthesis' in window)) return;
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'pt-BR';
          utterance.rate = 1.02;
          utterance.pitch = 0.88;
          const voices = window.speechSynthesis.getVoices();
          const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt'));
          if (ptVoice) utterance.voice = ptVoice;
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          // Silencioso caso bloqueado pelo navegador
        }
      }
    }

    /**
     * ============================================================================
     * MÓDULO 2: INTELIGÊNCIA ARTIFICIAL ADVERSÁRIA ("O GUARDIÃO")
     * Avaliador posicional com Tabelas Peça-Quadrado (PST) e Minimax Alpha-Beta.
     * ============================================================================
     */

export { ArcaneAudioEngine };
