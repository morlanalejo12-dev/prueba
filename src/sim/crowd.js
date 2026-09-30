// La multitud: miles de bots guardados como arreglos paralelos (structure of arrays) para que
// actualizarlos sea barato. Cada bot decide en cada bifurcación con una de cuatro estrategias.
import { CFG, BOT } from '../config.js';
import { clamp } from '../util/math.js';
import { gauss, hash01, hashNormal } from '../util/rng.js';
import { clearance, aimX, gapAround } from './gates.js';
import { laneAt } from './level.js';

const gap = new Float64Array(2);

export function botType(u) {
  const m = CFG.MIX;
  return u < m[0] ? BOT.HERD : u < m[0] + m[1] ? BOT.CONTRA : u < 1 - m[3] ? BOT.STUB : BOT.LATE;
}

export function createCrowd(n, r) {
  const c = {
    x: new Float32Array(n), tx: new Float32Array(n), yo: new Float32Array(n), v: new Float32Array(n),
    sk: new Float32Array(n), ty: new Uint8Array(n), alive: new Uint8Array(n).fill(1),
    death: new Float64Array(n).fill(Infinity), sc: new Float32Array(n), ng: new Uint16Array(n),
    lane: new Int8Array(n).fill(-1), want: new Int8Array(n).fill(-1), tick: new Float32Array(n),
    flips: new Uint8Array(n), jit: new Float32Array(n), late: new Float32Array(n), lateDone: new Uint8Array(n),
    dashAt: new Float32Array(n),
  };
  const { W, WALL } = CFG;
  for (let i = 0; i < n; i++) {
    c.x[i] = c.tx[i] = WALL + 8 + r() * (W - 2 * WALL - 16);
    c.yo[i] = clamp(gauss(r) * 16, -42, 42);
    c.v[i] = 190 + r() * 150;
    c.sk[i] = 0.07 + r() * 0.19;
    c.ty[i] = botType(r());
    c.jit[i] = (r() - 0.5) * 0.7;
    c.late[i] = 0.3 + r() * 0.5;
    c.tick[i] = r();
    c.dashAt[i] = r() < CFG.BOT_DASH ? 0.1 + r() * 0.45 : 0;
  }
  return c;
}

const argmin = a => { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] < a[m]) m = i; return m; };
const argmax = a => { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; };
// El camino que conviene según la regla de la bifurcación
const safest = f => (f.invert ? argmax(f.intent) : argmin(f.intent));

function weightedLane(R, f) {
  let total = 0;
  for (const L of f.lanes) total += L.gold ? 2.2 : L.narrow ? 0.35 : 1;
  let u = R.r() * total;
  for (let i = 0; i < f.k; i++) {
    const L = f.lanes[i];
    u -= L.gold ? 2.2 : L.narrow ? 0.35 : 1;
    if (u <= 0) return i;
  }
  return f.k - 1;
}

// La manada va con la mayoría, los contreras con la minoría (en una inversión, la mitad se da
// cuenta y cambia), los tercos eligen una vez y los de último momento cambian justo antes de entrar.
function decide(R, i, f) {
  const c = R.crowd, ty = c.ty[i], r = R.r;
  c.tick[i] = ty === BOT.HERD ? 0.35 + r() * 0.6 : ty === BOT.CONTRA ? 0.3 + r() * 0.8 : 99;
  if (c.want[i] < 0) c.want[i] = weightedLane(R, f);
  if (f.variant === 'fog' || ty === BOT.STUB || ty === BOT.LATE) return;
  if (ty === BOT.HERD) {
    // En la primera bifurcación la manada se deja llevar menos: la gente queda más repartida
    if (r() < (f.i === 0 ? 0.35 : 0.85)) {
      let m = 0, best = -1;
      for (let k = 0; k < f.k; k++) {
        const v = f.intent[k] + (f.lanes[k].gold ? 0.08 : 0);
        if (v > best) { best = v; m = k; }
      }
      c.want[i] = m;
    }
  } else if (c.flips[i] < 3) {
    const smart = f.invert && hash01(i, f.i + 555) < 0.5;
    const m = smart ? argmax(f.intent) : argmin(f.intent);
    if (m !== c.want[i]) { c.want[i] = m; c.flips[i]++; }
  }
}

function botDashTarget(R, f, lane) {
  const opts = [lane - 1, lane + 1].filter(k => k >= 0 && k < f.k);
  if (!opts.length) return -1;
  opts.sort((a, b) => (f.invert ? f.counts[b] - f.counts[a] : f.counts[a] - f.counts[b]));
  const pick = R.r() < 0.7 ? opts[0] : opts[opts.length - 1];
  // Solo se mueve si mejora (o por error, a veces)
  const better = f.invert ? f.counts[pick] > f.counts[lane] : f.counts[pick] < f.counts[lane];
  return better || R.r() < 0.25 ? pick : -1;
}

export function resetCrowdForFork(R) {
  const c = R.crowd;
  for (let i = 0; i < R.n; i++) {
    if (!c.alive[i]) continue;
    c.lane[i] = -1; c.want[i] = -1; c.flips[i] = 0; c.lateDone[i] = 0;
    c.tick[i] = R.r() * 0.5;
    c.ty[i] = botType(R.r()); // cada persona decide distinto en cada bifurcación
    c.dashAt[i] = R.r() < CFG.BOT_DASH ? 0.1 + R.r() * 0.45 : 0;
  }
}

export function updateCrowd(R, dt, f) {
  const c = R.crowd, gates = R.lvl.gates, { W, WALL } = CFG;
  for (let i = 0; i < R.n; i++) {
    if (!c.alive[i]) continue;
    const by = R.pY + c.yo[i];

    // Cruce de muros
    let gi = c.ng[i];
    while (gi < gates.length && gates[gi].y <= by) {
      if (clearance(gates[gi], c.x[i], 2, R.t) < 0) { R.killBot(i, false); break; }
      if (hash01(i, gi + 999) < 0.25) c.sc[i] += 25;
      gi++;
    }
    if (!c.alive[i]) continue;
    c.ng[i] = gi;

    let target = c.tx[i], lo = WALL + 2, hi = W - WALL - 2;
    if (f && by >= f.startY - 100) {
      if (c.lane[i] < 0 && by >= f.entryY) c.lane[i] = laneAt(f, c.x[i]);
      if (c.lane[i] >= 0) {
        // Algunos bots usan un impulso a mitad del carril para pasarse al vecino que conviene
        if (c.dashAt[i] > 0 && f.variant !== 'fog' && by >= f.entryY + c.dashAt[i] * (f.endY - f.entryY)) {
          c.dashAt[i] = 0;
          const to = botDashTarget(R, f, c.lane[i]);
          if (to >= 0) {
            c.lane[i] = to;
            c.x[i] = (f.lanes[to].x0 + f.lanes[to].x1) / 2;
          }
        }
        const L = f.lanes[c.lane[i]];
        lo = L.x0 + 2; hi = L.x1 - 2;
        target = (L.x0 + L.x1) / 2 + c.jit[i] * (L.x1 - L.x0) * 0.6;
        if (f.ng && c.lane[i] === f.ng.lane) {
          if (by >= f.ng.y && by - R.speed * dt < f.ng.y && R.r() < CFG.NARROW_DEATH) { R.killBot(i, false); continue; }
          if (by < f.ng.y) target = f.ng.c;
        }
      } else {
        c.tick[i] -= dt;
        if (c.tick[i] <= 0 || c.want[i] < 0) decide(R, i, f);
        if (c.ty[i] === BOT.LATE && !c.lateDone[i] && f.entryY - by < R.speed * c.late[i]) {
          c.lateDone[i] = 1;
          if (f.variant !== 'fog') c.want[i] = safest(f);
        }
        const L = f.lanes[c.want[i]];
        target = (L.x0 + L.x1) / 2 + c.jit[i] * (L.x1 - L.x0) * 0.6;
      }
    } else {
      const g = gates[gi];
      const dist = g ? g.y - by : Infinity;
      if (dist < R.speed * 0.95) {
        const tA = R.t + dist / R.speed;
        let aim = aimX(g, tA, c.x[i], hash01(i, gi + 77));
        // Si hay otro muro pegado (pinza), entrar por el lado que queda más cerca del siguiente hueco
        const nx = gates[gi + 1];
        if (nx && nx.y - g.y < 110) {
          const aimN = aimX(nx, R.t + (nx.y - by) / R.speed, aim, hash01(i, gi + 78));
          gapAround(g, tA, aim, gap);
          aim = clamp(aimN, gap[0] + 5, gap[1] - 5);
        }
        gapAround(g, tA, aim, gap);
        target = aim + hashNormal(i, gi) * c.sk[i] * (gap[1] - gap[0]);
      } else {
        c.tick[i] -= dt;
        if (c.tick[i] <= 0) {
          c.tick[i] = 0.7 + R.r() * 1.2;
          c.tx[i] = clamp(c.x[i] + (R.r() - 0.5) * 90, lo, hi);
        }
        target = c.tx[i];
      }
    }
    const md = c.v[i] * dt, d = clamp(target, lo, hi) - c.x[i];
    c.x[i] = clamp(c.x[i] + (d > md ? md : d < -md ? -md : d), lo, hi);
  }
}
