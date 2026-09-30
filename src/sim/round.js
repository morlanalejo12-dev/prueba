// Simulación de una ronda. No toca el DOM ni el audio: avanza con pasos fijos y deja eventos
// en `events` para que la presentación (render, sonido, interfaz) reaccione.
import { CFG } from '../config.js';
import { clamp } from '../util/math.js';
import { mulberry32, hash01 } from '../util/rng.js';
import { buildLevel, laneAt } from './level.js';
import { clearance, GATE_HALF } from './gates.js';
import { createCrowd, updateCrowd, resetCrowdForFork } from './crowd.js';

const NEAR_MARGIN = 9;   // a menos de esta distancia del borde, la pasada cuenta como "justa"
const FX_CAP = 240;      // máximo de partículas por colapso

// Qué caminos colapsan: el más poblado (o el menos poblado si la bifurcación está invertida).
// Si todos los ocupados empatan, cae uno al azar. Si hay un solo camino ocupado, resiste.
export function pickCollapse(counts, invert, rand) {
  const occ = [];
  for (let k = 0; k < counts.length; k++) if (counts[k] > 0) occ.push(k);
  if (occ.length < 2) return [];
  let target = invert ? Infinity : -Infinity;
  for (const k of occ) target = invert ? Math.min(target, counts[k]) : Math.max(target, counts[k]);
  let col = occ.filter(k => counts[k] === target);
  if (col.length === occ.length) col = [col[Math.floor(rand() * col.length)]];
  return col;
}

const SYL = ['lu', 'ka', 'mi', 'ro', 'ne', 'ta', 'zu', 'vi', 'xo', 'pa', 'li', 'mo', 'ra', 'ki', 'so', 'fe'];
const TAIL = ['_ar', '_mx', '_co', '', '_07', '_99', '_uy', '_cl', 'x', 'z'];

export class Round {
  constructor({ seed = Date.now(), demo = false, bots = CFG.BOTS } = {}) {
    this.seed = seed >>> 0;
    this.r = mulberry32(this.seed);
    this.demo = demo;
    this.lvl = buildLevel(this.r);
    this.n = bots;
    this.crowd = createCrowd(bots, this.r);
    this.aliveBots = bots;

    this.t = 0;
    this.pY = 0;
    this.speed = CFG.SPEED0;
    this.cf = 0;
    this.intentT = 0;

    // Jugador
    this.px = CFG.W / 2;
    this.ptx = this.px;
    this.keyDir = 0;
    this.pAlive = !demo;
    this.pLane = -1;
    this.pNg = 0;
    this.gateMin = Infinity;
    this.pOrb = 0;
    this.ngDone = false;
    this.ngMin = Infinity;
    this.pDeath = Infinity;
    this.why = '';
    this.rank = 0;
    this.pct = 0;

    // Puntaje
    this.score = 0;
    this.near = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.orbs = 0;
    this.orbChain = 0;
    this.lastOrbT = -9;
    this.forksOk = 0;
    this.forkLog = [];
    this.feats = { gold: false, fog: false, invert: false };

    this.ended = false;
    this.outlier = null;
    this.events = [];
  }

  emit(type, data) {
    if (!this.demo || type === 'forkResolved') this.events.push({ type, ...data });
  }

  get aliveTotal() { return this.aliveBots + (this.pAlive ? 1 : 0); }
  get fork() { return this.lvl.forks[this.cf]; }

  setTarget(x) { this.ptx = x; }
  setKeyDir(d) {
    this.keyDir = d;
    if (!d) this.ptx = this.px;
  }

  // Qué tan tensa está la ronda (0 a 1): guía la música y los efectos
  tension() {
    const f = this.fork;
    if (!f || this.ended) return 0.3;
    if (this.pY >= f.entryY) return 0.85 + 0.15 * clamp((this.pY - f.entryY) / (f.endY - f.entryY), 0, 1);
    if (this.pY >= f.startY - 150) return 0.55 + 0.25 * clamp((this.pY - f.startY + 150) / (f.entryY - f.startY + 150), 0, 1);
    return 0.4;
  }

  step(dt) {
    this.t += dt;
    const f = this.fork;
    this.speed = CFG.SPEED0 + CFG.SPEED_STEP * this.cf;
    this.pY += this.speed * dt;

    if (f && !this.ended && !f.announced && this.pY >= f.startY - 160) {
      f.announced = true;
      this.emit('forkAnnounce', { fork: f });
    }
    this.intentT -= dt;
    if (f && this.intentT <= 0) { this.intentT = 0.12; this.computeCounts(f); }

    if (this.pAlive && !this.ended) this.updatePlayer(dt, f);
    updateCrowd(this, dt, f);
    if (f && !this.ended && !f.resolved && this.pY >= f.endY + 12) this.resolveFork(f);
    if (!this.ended && (this.pY >= this.lvl.endY || this.aliveTotal <= 1)) this.finish();
  }

  runToEnd(maxSteps = 60000) {
    for (let i = 0; i < maxSteps && !this.ended; i++) this.step(1 / 60);
  }

  computeCounts(f) {
    const c = this.crowd, intent = new Array(f.k).fill(0), counts = new Array(f.k).fill(0);
    for (let i = 0; i < this.n; i++) {
      if (!c.alive[i]) continue;
      const ln = c.lane[i] >= 0 ? c.lane[i] : laneAt(f, c.x[i]);
      intent[ln]++;
      if (c.lane[i] >= 0) counts[ln]++;
    }
    if (this.pAlive) {
      const ln = this.pLane >= 0 ? this.pLane : laneAt(f, this.px);
      intent[ln]++;
      if (this.pLane >= 0) counts[ln]++;
    }
    let tot = 0;
    for (const v of intent) tot += v;
    f.intent = intent.map(v => v / (tot || 1));
    f.counts = counts;
  }

  // ---------- Jugador ----------
  movePlayer(dt, f) {
    const P = CFG.PR;
    if (this.keyDir) this.ptx = this.px + this.keyDir * 60;
    let lo = CFG.WALL + P, hi = CFG.W - CFG.WALL - P;
    if (f && this.pLane < 0 && this.pY >= f.entryY) this.pLane = laneAt(f, this.px);
    if (f && this.pLane >= 0) {
      const L = f.lanes[this.pLane];
      lo = L.x0 + P; hi = L.x1 - P;
    }
    const md = CFG.PLAYER_SPEED * dt;
    this.px = clamp(this.px + clamp(clamp(this.ptx, lo, hi) - this.px, -md, md), lo, hi);
  }

  updatePlayer(dt, f) {
    const P = CFG.PR;
    this.movePlayer(dt, f);
    this.score += this.speed * dt / 10;

    const orbs = this.lvl.orbs;
    while (this.pOrb < orbs.length && orbs[this.pOrb].y < this.pY - 24) this.pOrb++;
    for (let k = this.pOrb; k < orbs.length && orbs[k].y < this.pY + 24; k++) {
      const o = orbs[k];
      if (!o.taken && Math.abs(o.y - this.pY) < P + 8 && Math.abs(o.x - this.px) < P + 8) this.takeOrb(o);
    }

    const g = this.lvl.gates[this.pNg];
    if (g) {
      if (Math.abs(this.pY - g.y) < GATE_HALF + P) {
        const m = clearance(g, this.px, P, this.t);
        if (m < 0) { this.killPlayer('wall', 0); return; }
        this.gateMin = Math.min(this.gateMin, m);
      } else if (this.pY > g.y + GATE_HALF + P) {
        this.passGate(this.gateMin);
        this.gateMin = Infinity;
        this.pNg++;
      }
    }

    if (f && f.ng && this.pLane === f.ng.lane && !this.ngDone) {
      const ng = f.ng;
      if (Math.abs(this.pY - ng.y) < GATE_HALF + P) {
        const m = clearance(ng, this.px, P, this.t);
        if (m < 0) { this.killPlayer('wall', 0); return; }
        this.ngMin = Math.min(this.ngMin, m);
      } else if (this.pY > ng.y + GATE_HALF + P) {
        this.ngDone = true;
        this.passGate(this.ngMin);
      }
    }
  }

  takeOrb(o) {
    o.taken = true;
    this.orbs++;
    this.orbChain = this.t - this.lastOrbT < 1.4 ? this.orbChain + 1 : 1;
    this.lastOrbT = this.t;
    const pts = 10 * Math.min(this.orbChain, 5);
    this.score += pts;
    this.emit('orb', { x: o.x, y: o.y, chain: this.orbChain, pts });
  }

  passGate(margin) {
    if (margin < NEAR_MARGIN) {
      this.combo++;
      this.near++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const pts = 25 * this.combo;
      this.score += pts;
      this.emit('nearMiss', { x: this.px, y: this.pY, combo: this.combo, pts });
    } else {
      this.combo = 0;
      this.emit('gatePass', {});
    }
  }

  // ---------- Multitud ----------
  killBot(i, fx) {
    const c = this.crowd;
    c.alive[i] = 0;
    c.death[i] = this.t;
    this.aliveBots--;
    if (fx && this._fx && this._fx.length < FX_CAP * 2) this._fx.push(c.x[i], this.pY + c.yo[i]);
  }

  resolveFork(f) {
    const c = this.crowd;
    f.resolved = true;
    f.resolvedAt = this.t;
    for (let i = 0; i < this.n; i++) if (c.alive[i] && c.lane[i] < 0) c.lane[i] = laneAt(f, c.x[i]);
    if (this.pAlive && this.pLane < 0) this.pLane = laneAt(f, this.px);
    this.computeCounts(f);

    const col = pickCollapse(f.counts, f.invert, this.r);
    f.collapsed = col;
    this._fx = [];
    let fallen = 0;
    for (let i = 0; i < this.n; i++) {
      if (!c.alive[i]) continue;
      if (col.includes(c.lane[i])) { this.killBot(i, true); fallen++; }
      else c.sc[i] += f.lanes[c.lane[i]].gold ? 200 : 100;
    }
    const fx = this._fx;
    this._fx = null;

    let outcome = null, gold = false;
    if (this.pAlive) {
      gold = f.lanes[this.pLane].gold;
      if (col.includes(this.pLane)) {
        outcome = 'died';
        this.forkLog.push('lost');
      } else {
        outcome = 'survived';
        this.forksOk++;
        this.forkLog.push('ok');
        this.score += gold ? 200 : 100;
        if (gold) this.feats.gold = true;
        if (f.variant === 'fog') this.feats.fog = true;
        if (f.invert) this.feats.invert = true;
      }
    }
    this.emit('forkResolved', { fork: f, collapsed: col, fallen, fx, outcome, gold });
    if (outcome === 'died') this.killPlayer(f.invert ? 'inverted' : 'majority', fallen);

    resetCrowdForFork(this);
    this.pLane = -1;
    this.ngDone = false;
    this.ngMin = Infinity;
    this.cf++;
  }

  killPlayer(why, sameEvent) {
    this.pAlive = false;
    this.pDeath = this.t;
    this.why = why;
    this.combo = 0;
    const better = this.aliveBots;
    this.rank = better + 1;
    this.pct = Math.max(0, (this.n - better - sameEvent) / this.n * 100);
    this.emit('playerDied', { why, rank: this.rank, pct: this.pct, sameEvent, x: this.px, y: this.pY });
  }

  finish() {
    const c = this.crowd;
    this.ended = true;
    const avg = CFG.SPEED0 + CFG.SPEED_STEP * CFG.FORKS / 2;
    let bestDeath = -1, bestScore = -1, who = 0;
    for (let i = 0; i < this.n; i++) {
      const d = c.death[i];
      const sc = c.sc[i] + Math.min(d, this.t) * avg / 10 + hash01(i, this.seed) * 120;
      c.sc[i] = sc;
      if (d > bestDeath || (d === bestDeath && sc > bestScore)) { bestDeath = d; bestScore = sc; who = i; }
    }
    if (this.pAlive) {
      let better = 0;
      for (let i = 0; i < this.n; i++) if (c.alive[i] && c.sc[i] > this.score) better++;
      this.rank = better + 1;
      this.pct = (this.n - better) / this.n * 100;
    }
    const pd = this.pAlive ? Infinity : this.pDeath;
    const youWin = !this.demo && (pd > bestDeath || (pd === bestDeath && this.score >= bestScore));
    if (youWin) this.rank = 1;
    this.outlier = youWin ? { you: true, score: this.score } : { you: false, name: this.botName(who), score: bestScore };
    this.emit('roundEnd', {});
  }

  botName(i) {
    const h = (hash01(i, this.seed) * 4294967296) >>> 0;
    return '@' + SYL[h & 15] + SYL[(h >>> 4) & 15] + SYL[(h >>> 8) & 15] + TAIL[(h >>> 12) % TAIL.length];
  }

  summary() {
    return {
      score: Math.round(this.score), rank: this.rank, total: this.n + 1, pct: this.pct,
      forksOk: this.forksOk, forks: CFG.FORKS, near: this.near, maxCombo: this.maxCombo, orbs: this.orbs,
      alive: this.pAlive, outlier: !!(this.outlier && this.outlier.you), why: this.why, feats: { ...this.feats },
    };
  }
}
