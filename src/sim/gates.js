// Muros: cada muro tiene uno o dos huecos que pueden moverse o alternarse con el tiempo.
//   static  un hueco fijo
//   moving  un hueco que oscila de lado a lado
//   double  dos huecos abiertos (el chico suele tener chispas)
//   alt     dos puertas: solo una está abierta y se alternan cada `period` segundos
import { CFG } from '../config.js';

export const GATE_HALF = 9; // medio grosor del muro

const scratch = new Float64Array(4);

export function makeGate(y, type, gw, c) {
  return { y, type, gw, c, amp: 0, freq: 1, ph: 0, c2: 0, gw2: 0, period: 0, lo: CFG.WALL, hi: CFG.W - CFG.WALL };
}

// Índice de la puerta abierta (0 → c, 1 → c2) y progreso hasta el próximo cambio
export const altOpen = (g, t) => Math.floor((t + g.ph) / g.period) & 1;
export const altPhase = (g, t) => ((t + g.ph) % g.period) / g.period;

// Escribe los huecos abiertos como pares [a, z] en `out` y devuelve cuántos hay
export function gapsAt(g, t, out) {
  switch (g.type) {
    case 'moving': {
      const c = g.c + Math.sin(t * g.freq + g.ph) * g.amp;
      out[0] = c - g.gw / 2; out[1] = c + g.gw / 2;
      return 1;
    }
    case 'double':
      out[0] = g.c - g.gw / 2; out[1] = g.c + g.gw / 2;
      out[2] = g.c2 - g.gw2 / 2; out[3] = g.c2 + g.gw2 / 2;
      return 2;
    case 'alt': {
      const second = altOpen(g, t) === 1;
      const c = second ? g.c2 : g.c, w = second ? g.gw2 : g.gw;
      out[0] = c - w / 2; out[1] = c + w / 2;
      return 1;
    }
    default:
      out[0] = g.c - g.gw / 2; out[1] = g.c + g.gw / 2;
      return 1;
  }
}

// Margen libre de un círculo de radio r en x: negativo significa que choca
export function clearance(g, x, r, t) {
  const n = gapsAt(g, t, scratch);
  let best = -Infinity;
  for (let k = 0; k < n; k++) {
    const m = Math.min(x - r - scratch[2 * k], scratch[2 * k + 1] - (x + r));
    if (m > best) best = m;
  }
  return best;
}

// Hueco más cercano a x (o el que lo contiene): escribe [a, z] en out
export function gapAround(g, t, x, out) {
  const n = gapsAt(g, t, scratch);
  let bi = 0, bd = Infinity;
  for (let k = 0; k < n; k++) {
    const d = Math.abs(x - (scratch[2 * k] + scratch[2 * k + 1]) / 2);
    if (d < bd) { bd = d; bi = k; }
  }
  out[0] = scratch[2 * bi]; out[1] = scratch[2 * bi + 1];
  return out;
}

// Hacia dónde apunta un bot: el hueco abierto al llegar; en los dobles, casi siempre el más cercano
export function aimX(g, t, x, pick) {
  const n = gapsAt(g, t, scratch);
  const c0 = (scratch[0] + scratch[1]) / 2;
  if (n === 1) return c0;
  const c1 = (scratch[2] + scratch[3]) / 2;
  const nearFirst = Math.abs(x - c0) <= Math.abs(x - c1);
  return (pick < 0.85) === nearFirst ? c0 : c1;
}

export const gapWidth = g => (g.type === 'double' || g.type === 'alt' ? Math.min(g.gw, g.gw2) : g.gw);
