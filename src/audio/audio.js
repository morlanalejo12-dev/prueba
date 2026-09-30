// Motor de audio 100% sintetizado (sin archivos): efectos y una música generativa
// que se intensifica con la tensión de la ronda. Programa las notas con anticipación
// (lookahead scheduler) para que el ritmo no dependa de los cuadros del juego.

import { TRACKS } from './tracks.js';

// La música crece por etapas (una por bifurcación superada): más rápida, más aguda y con más capas.
const MAX_STAGE = 7;
const LOOKAHEAD = 0.12;            // segundos que se programan por adelantado

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
    this.stage = 0;
    this.onBeat = null;  // se llama en cada negra, sincronizado con lo que suena
    this.track = TRACKS.corriente;
    this.trackId = 'corriente';
  }

  // Cambiar de tema: arranca desde el primer compás
  setTrack(id) {
    const tr = TRACKS[id] || TRACKS.corriente;
    if (tr === this.track) return;
    this.track = tr;
    this.trackId = TRACKS[id] ? id : 'corriente';
    this.step = 0;
  }

  setStage(n) { this.stage = Math.max(0, Math.min(MAX_STAGE, n)); }

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
      // Sidechain: el bombo de algunos temas "agacha" la música un instante
      this.duckG = c.createGain();
      this.music.connect(this.duckG).connect(this.lp).connect(this.master);
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
    const tr = this.track, loop = tr.bars * 16;
    const stepDur = 60 / (tr.bpm + this.stage * tr.bpmStep) / 4;
    while (this.nextTime < c.currentTime + LOOKAHEAD) {
      if (this.musicOn) tr.step(this, this.step % loop, this.nextTime, stepDur, this.level, this.stage);
      if ((this.step & 3) === 0 && this.onBeat) {
        const strong = (this.step & 15) === 0;
        setTimeout(() => this.onBeat && this.onBeat(strong), Math.max(0, (this.nextTime - c.currentTime) * 1000));
      }
      this.nextTime += stepDur;
      this.step = (this.step + 1) % loop;
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
  openHat(dest, t, vol) { this.noise(dest, t, vol, 0.16, 'highpass', 6500); }
  clap(dest, t, vol) {
    for (let i = 0; i < 3; i++) this.noise(dest, t + i * 0.011, vol * (i === 2 ? 1 : 0.6), i === 2 ? 0.14 : 0.02, 'bandpass', 1300);
  }

  // Varias sierras desafinadas: el sonido "ancho" de la electrónica
  supersaw(dest, freq, vol, dur, t, spread = 0.01, n = 3, attack = 0.01) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    g.connect(dest);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq * (1 + (i - (n - 1) / 2) * spread), t);
      o.connect(g);
      o.start(t);
      o.stop(t + attack + dur + 0.02);
    }
  }

  // Cuerda pulsada: sierra con un filtro que se cierra rápido
  pluck(dest, freq, vol, dur, t) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.004, t);
    f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(5200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g).connect(dest);
    o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  // Línea ácida: sierra con filtro resonante
  acid(dest, freq, vol, dur, t, cutoff) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass'; f.Q.value = 14;
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.25), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // Subida de ruido para los redobles
  riser(dest, t, dur, vol) {
    const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    src.connect(f).connect(g).connect(dest);
    src.start(t); src.stop(t + dur + 0.1);
  }

  // Sidechain: baja el volumen de la música y lo recupera
  duck(t, depth, rel) {
    const g = this.duckG.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1 - depth, t);
    g.linearRampToValueAtTime(1, t + rel);
  }
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
      case 'riser': {
        // Crescendo de ruido que sube mientras se cierran los carriles
        const c = this.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        src.buffer = this.noiseBuf; src.loop = true;
        f.type = 'bandpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(6000, t + arg);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + arg * 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + arg + 0.05);
        src.connect(f).connect(g).connect(o);
        src.start(t); src.stop(t + arg + 0.1);
        break;
      }
      case 'dash': this.sweep(o, 300, 3.2, 'triangle', 0.08, 0.16, t); this.noise(o, t, 0.08, 0.14, 'highpass', 2500); break;
      case 'drop': this.kick(o, t, 0.7); this.noise(o, t, 0.12, 0.6, 'highpass', 3000); break;
      case 'overtime': arp([220, 330, 440, 660, 880], 0.07, 'sawtooth', 0.06, 0.18); this.kick(o, t, 0.6); break;
      case 'rankup': arp([392, 523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.09, 0.22); this.kick(o, t, 0.4); break;
      default: break;
    }
  }
}
