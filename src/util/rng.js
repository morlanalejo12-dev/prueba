// Generadores deterministas: la misma semilla produce siempre la misma ronda.

export function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r) {
  let u = 0;
  while (!u) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * r());
}

// Hash sin estado: da un valor fijo en [0, 1) para cada par (a, b)
export function hash01(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// Ruido aproximadamente normal (desvío ~1), fijo para cada par (a, b)
export const hashNormal = (a, b) => (hash01(a, b) + hash01(a + 17, b * 3 + 1) + hash01(a * 3 + 5, b + 11) - 1.5) * 2;
