export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const fmt = n => Math.round(n).toLocaleString('es-AR');
export const pctText = p => (p >= 99.95 ? '100%' : (p >= 99 ? p.toFixed(1) : Math.floor(p)) + '%');
