// Motor de audio 100% sintetizado (sin archivos): efectos y una música generativa
// que se intensifica con la tensión de la ronda. Programa las notas con anticipación
// (lookahead scheduler) para que el ritmo no dependa de los cuadros del juego.

const BPM = 112;
const STEP = 60 / BPM / 4;         // duración de una semicorchea
const LOOKAHEAD = 0.12;            // segundos que se programan por adelantado
const ROOTS = [110, 87.31, 130.81, 98];                              // La, Fa, Do, Sol
const CHORDS = [[1, 1.2, 1.5, 2], [1, 1.26, 1.5, 2], [1, 1.26, 1.5, 2], [1, 1.26, 1.5, 2]];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.level = 0;
    this.target = 0.15;
    this.step = 0;
    this.nextTime = 0;
    this.timer = 0;
  }

  // Debe llamarse desde un gesto del usuario (los navegadores bloquean el audio antes)
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp).connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxOn ? 1 : 0;
      this.sfx.connect(this.master);
      this.music = c.createGain();
      this.music.gain.value = this.musicOn ? 0.5 : 0;
      this.lp = c.createBiquadFilter();
      this.lp.type = 'lowpass';
      this.lp.frequency.value = 700;
      this.music.connect(this.lp).connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nextTime = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.2);
  }

  setIntensity(v) { this.target = v; }

  // ---------- Música ----------
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    this.level += (this.target - this.level) * 0.06;
    this.lp.frequency.setTargetAtTime(450 + this.level * this.level * 4800, c.currentTime, 0.15);
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      if (this.musicOn) this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(s, t) {
    const L = this.level, bar = s >> 4, k = s & 15, root = ROOTS[bar], chord = CHORDS[bar], out = this.music;
    if (k === 0) {
      this.voice(out, root * 2, 'sawtooth', 0.035, STEP * 15, t, 0.4);
      this.voice(out, root * 2 * chord[2], 'sawtooth', 0.025, STEP * 15, t, 0.4);
    }
    if (k % 4 === 0) this.voice(out, root, 'triangle', 0.24, STEP * 3, t);
    if (L > 0.5 && k % 4 === 2) this.voice(out, root * 2, 'triangle', 0.1, STEP * 1.5, t);
    if (L > 0.28 && (k === 0 || k === 8)) this.kick(out, t, 0.25 + 0.35 * L);
    if (L > 0.7 && (k === 4 || k === 12)) this.snare(out, t, 0.08);
    if (L > 0.34 && k % 4 === 2) this.hat(out, t, 0.05);
    if (L > 0.78 && k % 2 === 1) this.hat(out, t, 0.03);
    if (L > 0.55 && k % 2 === 0) {
      const n = chord[(k / 2 + bar) % chord.length];
      this.voice(out, root * 4 * n, 'square', 0.03 * L, STEP * 0.9, t);
    }
  }

  // ---------- Instrumentos ----------
  voice(dest, freq, type, vol, dur, t, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.02);
  }

  sweep(dest, freq, to, type, vol, dur, t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dest, t, vol, dur, type, freq) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  kick(dest, t, vol) { this.sweep(dest, 150, 0.3, 'sine', vol, 0.16, t); }
  hat(dest, t, vol) { this.noise(dest, t, vol, 0.04, 'highpass', 7000); }
  snare(dest, t, vol) { this.noise(dest, t, vol, 0.12, 'bandpass', 1800); }

  // ---------- Efectos ----------
  play(name, arg = 0) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, o = this.sfx;
    const arp = (notes, gap, type, vol, dur, delay = 0) =>
      notes.forEach((f, i) => this.voice(o, f, type, vol, dur, t + delay + i * gap));
    switch (name) {
      case 'count': this.voice(o, 440, 'square', 0.06, 0.09, t); break;
      case 'go': arp([523, 784, 1047], 0.06, 'triangle', 0.08, 0.14); break;
      case 'orb': this.voice(o, 660 + Math.min(arg, 8) * 80, 'sine', 0.08, 0.09, t); break;
      case 'near': this.voice(o, 520 + Math.min(arg, 8) * 70, 'triangle', 0.08, 0.1, t); this.hat(o, t, 0.06); break;
      case 'pass': this.voice(o, 330, 'sine', 0.03, 0.05, t); break;
      case 'announce': arp([440, 660], 0.11, 'square', 0.05, 0.1); break;
      case 'invert': arp([660, 440, 330], 0.1, 'square', 0.06, 0.12); break;
      case 'tick': this.voice(o, 600 + arg * 700, 'square', 0.025, 0.035, t); break;
      case 'survive': arp([523, 659, 784, 1047], 0.07, 'triangle', 0.07, 0.13); break;
      case 'collapse': this.sweep(o, 110, 0.35, 'sawtooth', 0.07, 0.5, t); this.noise(o, t, 0.14, 0.5, 'lowpass', 900); break;
      case 'die': this.sweep(o, 180, 0.3, 'sawtooth', 0.1, 0.45, t); this.noise(o, t, 0.1, 0.3, 'lowpass', 1500); break;
      case 'levelup': arp([659, 784, 988, 1319], 0.08, 'triangle', 0.08, 0.16, 0.1); break;
      case 'ach': arp([880, 1175, 1568], 0.08, 'sine', 0.07, 0.2); break;
      case 'outlier': arp([523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.08, 0.2); break;
      case 'ui': this.voice(o, 540, 'sine', 0.04, 0.05, t); break;
      case 'milestone': arp([784, 988, 1175], 0.06, 'square', 0.05, 0.1); break;
      case 'rival': arp([523, 784], 0.08, 'triangle', 0.07, 0.14); break;
      case 'claim': arp([988, 1319], 0.07, 'sine', 0.08, 0.16); this.hat(o, t, 0.05); break;
      case 'buy': arp([659, 880, 1109, 1319], 0.06, 'triangle', 0.07, 0.14); break;
      case 'rankup': arp([392, 523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.09, 0.22); this.kick(o, t, 0.4); break;
      default: break;
    }
  }
}
