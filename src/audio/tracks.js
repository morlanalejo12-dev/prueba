// Temas musicales generativos. Cada uno programa un paso de semicorchea: recibe el motor (E),
// el paso dentro del loop (s), el instante (t), la duración del paso (STEP), la tensión (L, 0 a 1)
// y la etapa de la ronda (S, 0 a 7). Con más tensión y más etapas suman capas.
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
// Cada dos etapas la tonalidad sube un semitono
const up = S => Math.floor(S / 2);

// Acordes como notas MIDI
const CH = {
  Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62], Dm: [50, 53, 57], Em: [52, 55, 59],
  Am7: [57, 60, 64, 67], Dm7: [50, 53, 57, 60], Fmaj7: [53, 57, 60, 64], Em7: [52, 55, 59, 62], Cmaj7: [48, 52, 55, 59],
  Fsm: [54, 57, 61], D: [50, 54, 57], A: [45, 49, 52], E: [52, 56, 59], Bm: [47, 50, 54],
};

export const TRACKS = {
  // La música original: tensa y minimalista, crece por capas
  corriente: {
    bpm: 108, bpmStep: 4, bars: 4,
    step(E, s, t, STEP, L, S) {
      const ROOTS = [110, 87.31, 130.81, 98];
      const CHORDS = [[1, 1.2, 1.5, 2], [1, 1.26, 1.5, 2], [1, 1.26, 1.5, 2], [1, 1.26, 1.5, 2]];
      const bar = s >> 4, k = s & 15, chord = CHORDS[bar], out = E.music;
      const root = ROOTS[bar] * Math.pow(2, up(S) / 12);
      if (k === 0) {
        E.voice(out, root * 2, 'sawtooth', 0.035, STEP * 15, t, 0.4);
        E.voice(out, root * 2 * chord[2], 'sawtooth', 0.025, STEP * 15, t, 0.4);
      }
      if (k % 4 === 0) E.voice(out, root, 'triangle', 0.24, STEP * 3, t);
      if ((L > 0.5 || S >= 5) && k % 4 === 2) E.voice(out, root * 2, 'triangle', 0.1, STEP * 1.5, t);
      if (L > 0.28 && (k === 0 || k === 8 || (S >= 4 && (k === 4 || k === 12)))) E.kick(out, t, 0.25 + 0.35 * L);
      if ((L > 0.7 || S >= 3) && (k === 4 || k === 12)) E.snare(out, t, 0.08);
      if ((L > 0.34 || S >= 1) && k % 4 === 2) E.hat(out, t, 0.05);
      if ((L > 0.78 || S >= 5) && k % 2 === 1) E.hat(out, t, 0.03);
      if ((L > 0.55 || S >= 2) && k % 2 === 0) {
        const n = chord[(k / 2 + bar) % chord.length];
        E.voice(out, root * 4 * n, 'square', 0.03 * Math.max(L, 0.5), STEP * 0.9, t);
      }
      if (S >= 4 && L > 0.3) {
        const every = S >= 6 ? 1 : 2;
        if (k % every === 0) {
          const mel = [0, 2, 1, 3, 2, 1, 0, 3];
          const n = chord[mel[(k / every + bar * 3) % mel.length]];
          E.voice(out, root * 8 * n, S >= 6 ? 'sawtooth' : 'triangle', 0.028, STEP * every * 0.8, t);
        }
      }
    },
  },

  // Lo-fi: teclados suaves, batería apoyada y crujido de vinilo
  cascada: {
    bpm: 82, bpmStep: 2, bars: 4,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.Fmaj7, CH.Em7, CH.Dm7, CH.Cmaj7], bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const ch = prog[bar];
      if (k === 0 || k === 10) ch.forEach((m, i) => E.voice(out, hz(m + u), 'sine', 0.05, STEP * 7, t + i * 0.018, 0.02));
      if (k === 0 || k === 7 || k === 10) E.voice(out, hz(ch[0] - 12 + u), 'triangle', 0.16, STEP * 2.5, t);
      if (k === 0 || k === 9 || (L > 0.5 && k === 11)) E.kick(out, t, 0.28);
      if (k === 4 || k === 12) E.snare(out, t, 0.06);
      if ((L > 0.3 || S >= 1) && k % 2 === 0) E.hat(out, t + (k % 4 === 2 ? STEP * 0.18 : 0), 0.025);
      if (k % 8 === 3) E.noise(out, t, 0.012, 0.3, 'bandpass', 2500);
      if ((L > 0.55 || S >= 3) && k % 4 === 2) {
        const mel = [0, 2, 1, 3, 2, 3, 1, 0];
        E.voice(out, hz(ch[mel[(k >> 2) + (bar & 1) * 4] % ch.length] + 12 + u), 'triangle', 0.035, STEP * 3, t);
      }
    },
  },

  // Chiptune: consola de 8 bits a toda velocidad
  chip: {
    bpm: 140, bpmStep: 4, bars: 4,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.C, CH.G, CH.Am, CH.F], bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const ch = prog[bar];
      E.voice(out, hz(ch[k % 3] + 12 + u), 'square', 0.022 + 0.01 * L, STEP * 0.7, t);
      if (k % 2 === 0) E.voice(out, hz(ch[0] - 12 + u + (k % 4 === 2 ? 12 : 0)), 'triangle', 0.18, STEP * 0.9, t);
      if (k % 4 === 0) E.noise(out, t, 0.12, 0.06, 'lowpass', 400);
      if (k === 4 || k === 12) E.noise(out, t, 0.08, 0.08, 'highpass', 2000);
      if (L > 0.3 || S >= 1) {
        const mel = [12, 12, 7, 12, 16, 12, 7, 4, 7, 7, 4, 7, 11, 7, 4, 0];
        if (k % 2 === 0 || S >= 4) E.voice(out, hz(ch[0] + 12 + mel[k] + u), 'square', 0.028, STEP * (S >= 4 ? 0.5 : 1.4), t);
      }
      if ((L > 0.7 || S >= 5) && k % 2 === 1) E.noise(out, t, 0.025, 0.02, 'highpass', 8000);
    },
  },

  // Synthwave: arpegio nocturno, bajo en corcheas y caja con eco
  neon: {
    bpm: 104, bpmStep: 3, bars: 4,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.Am, CH.F, CH.C, CH.G], bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const ch = prog[bar];
      if (k === 0) ch.forEach(m => E.supersaw(out, hz(m + u), 0.018, STEP * 16, t, 0.008, 2, 0.25));
      if (k % 2 === 0) E.voice(out, hz(ch[0] - 24 + u + (k % 4 === 2 ? 12 : 0)), 'sawtooth', 0.07, STEP * 1.6, t);
      if ((L > 0.25 || S >= 1) && (k % 4 === 0)) E.kick(out, t, 0.32 + 0.2 * L);
      if (k === 4 || k === 12) { E.snare(out, t, 0.09); E.noise(out, t + STEP * 1.5, 0.025, 0.4, 'bandpass', 1500); }
      if ((L > 0.4 || S >= 2)) {
        const arp = [0, 1, 2, 1, 2, 3, 2, 1];
        const idx = arp[k % 8];
        E.voice(out, hz((idx === 3 ? ch[0] + 12 : ch[idx]) + 12 + u), 'square', 0.022, STEP * 0.8, t);
      }
      if (S >= 4 && L > 0.4 && k % 4 === 0) {
        const mel = [76, 74, 72, 71, 72, 74, 76, 79];
        E.voice(out, hz(mel[(k >> 2) + (bar & 1) * 4] - 12 + u), 'sawtooth', 0.026, STEP * 3.5, t, 0.03);
      }
      if ((L > 0.6 || S >= 3) && k % 2 === 1) E.hat(out, t, 0.028);
    },
  },

  // Deep house: acordes en contratiempo, bajo sincopado y hats abiertos
  pulso: {
    bpm: 120, bpmStep: 2, bars: 4,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.Dm7, CH.Am7, CH.Fmaj7, CH.Em7], bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const ch = prog[bar];
      if (k % 4 === 0) { E.kick(out, t, 0.35 + 0.2 * L); E.duck(t, 0.55, STEP * 2.5); }
      if (k % 4 === 2) E.openHat(out, t, 0.04);
      if (k === 3 || k === 6 || k === 11 || (L > 0.5 && k === 14)) ch.forEach(m => E.voice(out, hz(m + 12 + u), 'triangle', 0.03, STEP * 1.2, t));
      const bass = [0, -1, -1, 0, -1, -1, 1, -1, -1, -1, 0, -1, -1, 1, -1, -1];
      if (bass[k] >= 0) E.voice(out, hz(ch[0] - 24 + u + (bass[k] ? 12 : 0)), 'sine', 0.22, STEP * 1.5, t);
      if ((L > 0.45 || S >= 2) && (k === 4 || k === 12)) E.clap(out, t, 0.07);
      if ((L > 0.6 || S >= 3) && k % 2 === 1) E.hat(out, t, 0.02);
      if (S >= 4 && L > 0.4 && (k === 0 || k === 6 || k === 10)) E.pluck(out, hz(ch[(k + bar) % 4] + 24 + u), 0.04, STEP * 2, t);
    },
  },

  // Drum & bass: breakbeat a 170, bajo reese y pads
  vertigo: {
    bpm: 168, bpmStep: 2, bars: 4,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.Fsm, CH.D, CH.A, CH.E], bar = s >> 4, k = s & 15, out = E.music, u = up(S) - 12;
      const ch = prog[bar];
      if (k === 0) {
        ch.forEach(m => E.voice(out, hz(m + 12 + u), 'triangle', 0.02, STEP * 16, t, 0.3));
        E.supersaw(out, hz(ch[0] - 12 + u), 0.05, STEP * (L > 0.5 ? 7 : 15), t, 0.01, 2, 0.02);
      }
      if (k === 8 && L > 0.5) E.supersaw(out, hz(ch[1] - 12 + u), 0.05, STEP * 7, t, 0.01, 2, 0.02);
      if (k === 0 || k === 10 || (L > 0.6 && k === 7)) E.kick(out, t, 0.4);
      if (k === 4 || k === 12) E.snare(out, t, 0.11);
      if ((L > 0.3 || S >= 1) && k % 2 === 0) E.hat(out, t, 0.035);
      if ((L > 0.6 || S >= 3) && k % 2 === 1) E.hat(out, t, 0.018);
      if ((L > 0.55 || S >= 4) && k % 4 === 2) E.pluck(out, hz(ch[(k >> 2) % 3] + 24 + u), 0.03, STEP * 2, t);
    },
  },

  // Techno: bajo rodante en semicorcheas, bombo duro y un ácido que se abre con la tensión
  tormenta: {
    bpm: 128, bpmStep: 3, bars: 4,
    step(E, s, t, STEP, L, S) {
      const roots = [45, 45, 48, 43], bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const r = roots[bar] + u;
      if (k % 4 === 0) { E.kick(out, t, 0.5); E.duck(t, 0.45, STEP * 2); }
      else E.voice(out, hz(r - 12), 'sawtooth', 0.06, STEP * 0.8, t);
      if (k % 4 === 2) E.openHat(out, t, 0.045);
      if ((L > 0.35 || S >= 1) && (k === 4 || k === 12)) E.clap(out, t, 0.08);
      if ((L > 0.5 || S >= 2)) E.hat(out, t, k % 2 ? 0.02 : 0.03);
      if (L > 0.4 || S >= 3) {
        const acid = [0, 12, 0, 3, 0, 7, 12, 0, 10, 0, 3, 12, 0, 7, 0, 15];
        if (k % 2 === 0 || S >= 5) E.acid(out, hz(r + acid[k]), 0.035, STEP * 0.9, t, 500 + 3500 * L);
      }
      if (k === 0 && bar === 0) E.noise(out, t, 0.06, 1.2, 'highpass', 5000);
    },
  },

  // Exclusivo (código DKO01): electro house con supersierras, pluck pegadizo,
  // bombeo de sidechain, redobles y un drop cada 8 compases.
  voltaje: {
    bpm: 128, bpmStep: 2, bars: 8,
    step(E, s, t, STEP, L, S) {
      const prog = [CH.Fsm, CH.D, CH.A, CH.E, CH.Fsm, CH.D, CH.A, CH.E];
      const bar = s >> 4, k = s & 15, out = E.music, u = up(S);
      const ch = prog[bar], root = ch[0];
      const hype = Math.max(L, S / 7);
      const build = bar === 7;
      // Bombo con sidechain (en el compás del redoble se frena y crece la caja)
      if (!build || k < 8) {
        if (k % 4 === 0) { E.kick(out, t, 0.5 + 0.2 * hype); E.duck(t, 0.62, STEP * 3); }
      }
      if (build) {
        if (k >= 8 || hype > 0.5) E.snare(out, t, 0.03 + 0.07 * (k / 16));
        if (k === 0) E.riser(out, t, STEP * 16, 0.05);
      }
      if (k === 0 && bar === 0) E.noise(out, t, 0.09, 1.6, 'highpass', 4500);
      // Bajo en contratiempo (octavas)
      if (k % 4 === 2) E.supersaw(out, hz(root - 24 + u), 0.07, STEP * 1.6, t, 0.006, 2, 0.005);
      if (hype > 0.55 && k % 4 === 3) E.voice(out, hz(root - 12 + u), 'sawtooth', 0.04, STEP * 0.7, t);
      // Acordes de supersierra en contratiempo (el sidechain los hace "bombear")
      if (k % 4 === 2 || (hype > 0.7 && k % 4 === 3)) ch.forEach(m => E.supersaw(out, hz(m + 12 + u), 0.012 + 0.01 * hype, STEP * 1.4, t, 0.012, 3, 0.005));
      // Percusión
      if (k === 4 || k === 12) E.clap(out, t, 0.09);
      E.hat(out, t, k % 2 ? 0.018 : 0.03);
      if (k % 4 === 2) E.openHat(out, t, 0.04);
      // Pluck principal: el gancho del tema
      const hook = [
        [73, -1, 73, 76, -1, 73, -1, 71, -1, 69, -1, 71, 73, -1, -1, -1],
        [74, -1, 74, 73, -1, 71, -1, 69, -1, 66, -1, 69, 71, -1, 69, -1],
        [69, -1, 69, 71, -1, 73, -1, 76, -1, 73, -1, 71, 69, -1, -1, -1],
        [68, -1, 68, 71, -1, 73, -1, 76, -1, 80, -1, 78, 76, -1, 73, 71],
      ];
      const mel = hook[bar % 4][k];
      if (mel > 0 && (L > 0.2 || S >= 1)) {
        E.pluck(out, hz(mel + u), 0.05 + 0.02 * hype, STEP * 1.6, t);
        if (hype > 0.6) E.pluck(out, hz(mel + 12 + u), 0.02, STEP * 1.2, t);
      }
      // Arpegio de brillo en las etapas altas
      if (S >= 4 && k % 2 === 1) E.voice(out, hz(ch[(k >> 1) % 3] + 24 + u), 'square', 0.014, STEP * 0.6, t);
    },
  },
};
