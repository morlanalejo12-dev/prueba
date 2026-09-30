// Generación del nivel a partir de un generador determinista.
import { CFG } from '../config.js';
import { clamp } from '../util/math.js';
import { makeGate } from './gates.js';


const NARROW_W = 56;

export function buildLevel(r) {
  const { WALL, DIV, W } = CFG;
  const gates = [], forks = [], orbs = [];
  const invertAt = r() < CFG.INVERT_CHANCE ? 2 + Math.floor(r() * (CFG.FORKS - 2)) : -1;
  let y = 420;

  for (let f = 0; f < CFG.FORKS; f++) {
    const nG = f === 0 ? 2 : (r() < 0.35 ? 3 : 2);
    for (let i = 0; i < nG; i++) {
      y += 230 + r() * 70;
      const type = pickGateType(r, f);
      if (type === 'pinch') y = addPinch(r, f, y, gates, orbs);
      else gates.push(buildGate(r, f, y, type, orbs));
    }

    y += 280;
    const k = f === 0 ? 2 : (f >= 3 && r() < 0.22) ? 4 : (r() < 0.5 ? 2 : 3);
    let variant = 'normal';
    if (f >= 1) {
      const v = r();
      variant = v < 0.24 ? 'golden' : v < 0.44 ? 'narrow' : v < 0.58 ? 'fog' : 'normal';
    }
    if (variant === 'narrow' && k === 4) variant = 'normal';
    const invert = f === invertAt;
    if (invert && variant === 'fog') variant = 'normal';

    const inner = W - 2 * WALL - DIV * (k - 1);
    const narrowIdx = variant === 'narrow' ? Math.floor(r() * k) : -1;
    const goldIdx = variant === 'golden' ? Math.floor(r() * k) : -1;
    const lanes = [];
    let x = WALL;
    for (let i = 0; i < k; i++) {
      const w = narrowIdx < 0 ? inner / k : (i === narrowIdx ? NARROW_W : (inner - NARROW_W) / (k - 1));
      lanes.push({ x0: x, x1: x + w, gold: i === goldIdx, narrow: i === narrowIdx });
      x += w + DIV;
    }

    const startY = y, entryY = y + CFG.APPROACH, endY = entryY + CFG.LANE_LEN;
    if (goldIdx >= 0) {
      const L = lanes[goldIdx], xm = (L.x0 + L.x1) / 2;
      orbs.push({ x: xm, y: entryY + 70 }, { x: xm, y: entryY + 150 }, { x: xm, y: entryY + 230 });
    }
    let ng = null;
    if (narrowIdx >= 0) {
      const L = lanes[narrowIdx], gw = 30;
      const a = L.x0 + 4 + r() * (L.x1 - L.x0 - gw - 8);
      ng = { ...makeGate(entryY + CFG.LANE_LEN * 0.5, 'static', gw, a + gw / 2), lane: narrowIdx, lo: L.x0, hi: L.x1 };
    }

    forks.push({
      i: f, k, variant, invert, lanes, startY, entryY, endY, ng,
      announced: false, resolved: false, resolvedAt: 0, collapsed: [],
      counts: new Array(k).fill(0), intent: new Array(k).fill(1 / k),
    });
    y = endY + 60;
  }

  for (const o of orbs) o.taken = false;
  orbs.sort((a, b) => a.y - b.y);
  return { gates, forks, orbs, invertAt, endY: y + 500 };
}

// Muerte súbita: tramos cortos y cada vez más exigentes, hasta que quede uno solo
export function buildOvertime(r, y, n) {
  const { WALL, DIV, W } = CFG;
  const gates = [], orbs = [];
  y += 200;
  const g = buildGate(r, 5, y, r() < 0.5 ? 'moving' : 'static', orbs);
  g.gw = Math.max(56, Math.min(g.gw, 82 - n * 4));
  gates.push(g);
  y += 260;
  const k = 2, w = (W - 2 * WALL - DIV) / 2;
  const lanes = [
    { x0: WALL, x1: WALL + w, gold: false, narrow: false },
    { x0: WALL + w + DIV, x1: W - WALL, gold: false, narrow: false },
  ];
  const startY = y, entryY = y + 520, endY = entryY + 260;
  const fork = {
    i: CFG.FORKS + n, k, variant: 'normal', invert: false, overtime: true, lanes, startY, entryY, endY, ng: null,
    announced: false, resolved: false, resolvedAt: 0, collapsed: [], lottery: false,
    counts: [0, 0], intent: [0.5, 0.5],
  };
  return { gates, fork, orbs, endY: endY + 60 };
}

function pickGateType(r, f) {
  if (f === 0) return 'static';
  const u = r();
  if (f === 1) return u < 0.6 ? 'static' : 'double';
  return u < 0.3 ? 'static' : u < 0.52 ? 'moving' : u < 0.7 ? 'double' : u < 0.86 ? 'alt' : 'pinch';
}

const baseGap = (r, f) => Math.max(74, 118 - f * 6 - r() * 14);

function buildGate(r, f, y, type, orbs) {
  const { W, WALL } = CFG;
  const gw = baseGap(r, f);
  const g = makeGate(y, type, gw, W / 2);
  g.freq = 0.9 + r() * 0.9;
  g.ph = r() * 6.283;

  if (type === 'moving') {
    g.amp = 30 + r() * 45;
    const minC = WALL + gw / 2 + g.amp + 6, maxC = W - WALL - gw / 2 - g.amp - 6;
    g.c = minC + r() * (maxC - minC);
    const ox = WALL + 40 + r() * (W - 2 * WALL - 80);
    orbs.push({ x: ox, y: y + 90 }, { x: ox, y: y + 150 });
  } else if (type === 'double' || type === 'alt') {
    // Un hueco en cada mitad del túnel
    const half = (W - 2 * WALL) / 2;
    const place = (w, from) => from + 10 + w / 2 + r() * Math.max(0, half - w - 20);
    let wA = gw * 0.9, wB = type === 'double' ? gw * 0.62 : gw * 0.9;
    if (r() < 0.5) [wA, wB] = [wB, wA];
    g.c = place(wA, WALL); g.gw = wA;
    g.c2 = place(wB, WALL + half); g.gw2 = wB;
    if (type === 'alt') {
      g.period = 1.5 - Math.min(f, 5) * 0.06;
      g.ph = r() * g.period * 2;
      orbs.push({ x: W / 2, y: y + 110 });
    } else {
      const small = g.gw < g.gw2 ? g.c : g.c2;
      orbs.push({ x: small, y: y - 110 }, { x: small, y: y - 60 }, { x: small, y });
    }
  } else {
    const minC = WALL + gw / 2 + 6, maxC = W - WALL - gw / 2 - 6;
    g.c = minC + r() * (maxC - minC);
    orbs.push({ x: g.c, y: y - 150 }, { x: g.c, y: y - 95 });
    if (r() < 0.5) orbs.push({ x: g.c + (r() < 0.5 ? -1 : 1) * (gw / 2 - 13), y });
  }
  return g;
}

// Pinza: dos muros pegados con los huecos desplazados, obliga a zigzaguear
function addPinch(r, f, y, gates, orbs) {
  const { W, WALL } = CFG;
  const gw = Math.max(86, baseGap(r, f) + 8);
  const minC = WALL + gw / 2 + 6, maxC = W - WALL - gw / 2 - 6;
  const c1 = minC + r() * (maxC - minC);
  let c2 = c1 + (r() < 0.5 ? -1 : 1) * (70 + r() * 50);
  if (c2 < minC || c2 > maxC) c2 = 2 * c1 - c2;
  c2 = clamp(c2, minC, maxC);
  gates.push(makeGate(y, 'static', gw, c1), makeGate(y + 84, 'static', gw, c2));
  orbs.push({ x: (c1 + c2) / 2, y: y + 42 });
  return y + 84;
}

export function laneAt(f, x) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < f.k; i++) {
    const L = f.lanes[i];
    const d = x < L.x0 ? L.x0 - x : x > L.x1 ? x - L.x1 : 0;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Las chispas valen más (y cambian de color y forma) a medida que avanza la ronda
export const ORB_TIERS = [
  { mult: 1, name: 'Chispa', col: '#ffd166', shape: 'diamond' },
  { mult: 2, name: 'Gema', col: '#5ef2c2', shape: 'hex' },
  { mult: 3, name: 'Estrella', col: '#ff7ad9', shape: 'star' },
  { mult: 5, name: 'Prisma', col: null, shape: 'crystal' },
];

export function orbTier(forks, o) {
  if (o.tier === undefined) {
    let k = 0;
    for (const f of forks) if (f.endY < o.y) k++;
    o.tier = k < 2 ? 0 : k < 4 ? 1 : k < 6 ? 2 : 3;
  }
  return o.tier;
}
