// Ronda multijugador (corre en el servidor). Hereda la multitud y el nivel de Round, y suma
// jugadores humanos. Cada cliente informa su posición (x) junto con la altura (y) en la que
// estaba; el servidor la procesa "en diferido" a lo largo de ese tramo, así la latencia no
// cambia qué muros o chispas tocaste (compensación de lag). El servidor decide los colapsos.
import { CFG } from '../config.js';
import { clamp } from '../util/math.js';
import { hash01 } from '../util/rng.js';
import { Round, pickCollapse, MILESTONES } from './round.js';
import { buildOvertime, laneAt, orbTier, ORB_TIERS } from './level.js';
import { clearance, GATE_HALF } from './gates.js';
import { resetCrowdForFork } from './crowd.js';

const NEAR_MARGIN = 9;
const SUB = 4;             // paso (en y) al recorrer el tramo informado por el cliente
const AHEAD = 0.3;         // segundos que un cliente puede ir adelantado al servidor
const STALE = 0.7;         // si un cliente se atrasa más que esto, se lo mueve con su última x
const FX_CAP = 240;

export class MultiRound extends Round {
  constructor({ seed, bots = CFG.BOTS, humans = [] } = {}) {
    super({ seed, demo: true, bots });
    this.rival = -1;
    this.humans = humans.map((h, idx) => ({
      id: h.id, name: h.name, skin: h.skin, trail: h.trail, nameStyle: h.nameStyle, idx,
      x: CFG.W / 2, y: 0, alive: true, lane: -1, laneFork: -1, ng: 0, gateMin: Infinity,
      ngDone: -1, ngMin: Infinity, orb: 0, taken: new Set(),
      score: 0, near: 0, combo: 0, maxCombo: 0, orbs: 0, orbChain: 0, lastOrbT: -9,
      forksOk: 0, forkLog: [], feats: { gold: false, fog: false, invert: false, dashSave: false },
      charges: CFG.DASH_START, chargeOrbs: 0, dashFork: -1, dashes: 0,
      death: Infinity, why: '', rank: 0, pct: 0, milestoneIdx: 0, ev: [],
    }));
    this.byId = new Map(this.humans.map(h => [h.id, h]));
    this.gEvents = [];
    this.tlog = [];        // pares (pY, t) recientes para saber en qué instante se pasó por cada y
  }

  get aliveHumans() { let n = 0; for (const h of this.humans) if (h.alive) n++; return n; }
  get aliveTotal() { return this.aliveBots + this.aliveHumans; }
  get total() { return this.n + this.humans.length; }

  emit(type, data) {
    if (type === 'forkAnnounce') this.gEvents.push({ type, fork: data.fork.i });
    // forkResolved y overtime se emiten desde los métodos propios con datos para la red
  }

  hev(h, type, data) { h.ev.push({ type, ...data }); }

  step(dt) {
    super.step(dt);
    this.tlog.push(this.pY, this.t);
    if (this.tlog.length > 1600) this.tlog.splice(0, 400);
    if (this.ended) return;
    const lagY = this.pY - this.speed * STALE;
    for (const h of this.humans) if (h.alive && h.y < lagY) this.advance(h, h.x, lagY);
    this.checkMilestonesAll();
  }

  // Instante en el que el mundo estaba a la altura y
  tAt(y) {
    const L = this.tlog;
    if (!L.length || y >= L[L.length - 2]) return this.t + (y - this.pY) / this.speed;
    if (y <= L[0]) return L[1];
    let lo = 0, hi = L.length / 2 - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m * 2] <= y) lo = m; else hi = m; }
    const y0 = L[lo * 2], y1 = L[hi * 2], t0 = L[lo * 2 + 1], t1 = L[hi * 2 + 1];
    return y1 > y0 ? t0 + (t1 - t0) * (y - y0) / (y1 - y0) : t0;
  }

  // ---------- Entrada de los clientes ----------
  input(id, x, y) {
    const h = this.byId.get(id);
    if (!h || !h.alive || this.ended || !isFinite(x) || !isFinite(y)) return;
    y = Math.min(y, this.pY + this.speed * AHEAD);
    if (y <= h.y) { h.x = this.clampX(h, x, h.y); return; }
    this.advance(h, x, y);
  }

  // Límites de x para un humano a la altura y (paredes o su carril)
  clampX(h, x, y) {
    const P = CFG.PR;
    const f = this.forkAtY(y);
    if (f && h.laneFork === f.i && y >= f.entryY) {
      const L = f.lanes[h.lane];
      return clamp(x, L.x0 + P, L.x1 - P);
    }
    return clamp(x, CFG.WALL + P, CFG.W - CFG.WALL - P);
  }

  // La bifurcación que corresponde a la altura y (la actual o una ya resuelta si el cliente viene atrasado)
  forkAtY(y) {
    const F = this.lvl.forks;
    for (let k = Math.max(0, this.cf - 1); k < F.length; k++) if (y < F[k].endY + 12) return F[k];
    return null;
  }

  advance(h, x1, y1) {
    const x0 = h.x, y0 = h.y, span = y1 - y0;
    const n = Math.max(1, Math.ceil(span / SUB));
    for (let s = 1; s <= n && h.alive; s++) {
      const y = y0 + span * s / n;
      this.humanAt(h, x0 + (x1 - x0) * s / n, y);
    }
  }

  humanAt(h, xRaw, y) {
    const P = CFG.PR, t = this.tAt(y);
    const f = this.forkAtY(y);
    if (f && !f.resolved && y >= f.entryY && h.laneFork !== f.i) {
      h.laneFork = f.i;
      h.lane = laneAt(f, clamp(xRaw, CFG.WALL, CFG.W - CFG.WALL));
    }
    const x = this.clampX(h, xRaw, y);
    const prevY = h.y;
    h.x = x; h.y = y;
    h.score += y - prevY > 0 ? (y - prevY) / 10 : 0;

    const orbs = this.lvl.orbs;
    while (h.orb < orbs.length && orbs[h.orb].y < y - 24) h.orb++;
    for (let k = h.orb; k < orbs.length && orbs[k].y < y + 24; k++) {
      const o = orbs[k];
      if (!h.taken.has(o) && Math.abs(o.y - y) < P + 8 && Math.abs(o.x - x) < P + 8) this.takeOrbH(h, o, k);
    }

    const g = this.lvl.gates[h.ng];
    if (g) {
      if (Math.abs(y - g.y) < GATE_HALF + P) {
        const m = clearance(g, x, P, t);
        if (m < 0) { this.killHuman(h, 'wall', 0); return; }
        h.gateMin = Math.min(h.gateMin, m);
      } else if (y > g.y + GATE_HALF + P) {
        this.passGateH(h, h.gateMin);
        h.gateMin = Infinity;
        h.ng++;
      }
    }

    if (f && f.ng && h.laneFork === f.i && h.lane === f.ng.lane && h.ngDone !== f.i) {
      const ng = f.ng;
      if (Math.abs(y - ng.y) < GATE_HALF + P) {
        const m = clearance(ng, x, P, t);
        if (m < 0) { this.killHuman(h, 'wall', 0); return; }
        h.ngMin = Math.min(h.ngMin, m);
      } else if (y > ng.y + GATE_HALF + P) {
        h.ngDone = f.i;
        this.passGateH(h, h.ngMin);
        h.ngMin = Infinity;
      }
    }
  }

  takeOrbH(h, o, k) {
    h.taken.add(o);
    h.orbs++;
    h.orbChain = this.t - h.lastOrbT < 1.4 ? h.orbChain + 1 : 1;
    h.lastOrbT = this.t;
    const tier = orbTier(this.lvl.forks, o);
    const pts = 10 * Math.min(h.orbChain, 5) * ORB_TIERS[tier].mult;
    h.score += pts;
    this.hev(h, 'orb', { k, x: o.x, y: o.y, chain: h.orbChain, pts, tier });
    if (++h.chargeOrbs >= CFG.ORBS_PER_DASH) {
      h.chargeOrbs = 0;
      if (h.charges < CFG.DASH_MAX) {
        h.charges++;
        this.hev(h, 'charge', { charges: h.charges, x: o.x, y: o.y });
      }
    }
  }

  passGateH(h, margin) {
    if (margin < NEAR_MARGIN) {
      h.combo++;
      h.near++;
      h.maxCombo = Math.max(h.maxCombo, h.combo);
      const pts = 25 * h.combo;
      h.score += pts;
      this.hev(h, 'nearMiss', { x: h.x, y: h.y, combo: h.combo, pts });
    } else {
      h.combo = 0;
      this.hev(h, 'gatePass', {});
    }
  }

  // ---------- Impulso ----------
  canDashH(h) {
    const f = this.fork;
    return !!(h && h.alive && !this.ended && f && h.charges > 0 && h.laneFork === f.i && !f.resolved
      && h.y < f.endY - 10 && h.dashFork !== f.i);
  }

  dash(id, dir) {
    const h = this.byId.get(id);
    if (!this.canDashH(h)) return false;
    const f = this.fork, to = h.lane + (dir < 0 ? -1 : 1);
    if (to < 0 || to >= f.k) return false;
    const from = h.lane, fromX = h.x;
    h.lane = to;
    h.x = (f.lanes[to].x0 + f.lanes[to].x1) / 2;
    h.charges--;
    h.dashes++;
    h.dashFork = f.i;
    this.hev(h, 'dash', { from, to, x0: fromX, x1: h.x, y: h.y, charges: h.charges });
    return true;
  }

  // ---------- Bifurcaciones ----------
  humanLane(h, f) { return h.laneFork === f.i ? h.lane : laneAt(f, h.x); }

  computeCounts(f) {
    super.computeCounts(f);
    if (!this.humans || !this.humans.length) return;
    // Recalcular sumando a los humanos (la versión base ya guardó la de los bots)
    const c = this.crowd, intent = new Array(f.k).fill(0), counts = new Array(f.k).fill(0);
    for (let i = 0; i < this.n; i++) {
      if (!c.alive[i]) continue;
      const ln = c.lane[i] >= 0 ? c.lane[i] : laneAt(f, c.x[i]);
      intent[ln]++;
      if (c.lane[i] >= 0) counts[ln]++;
    }
    for (const h of this.humans) {
      if (!h.alive) continue;
      const ln = this.humanLane(h, f);
      intent[ln]++;
      if (h.laneFork === f.i) counts[ln]++;
    }
    let tot = 0;
    for (const v of intent) tot += v;
    f.intent = intent.map(v => v / (tot || 1));
    f.counts = counts;
    f.hist[f.hist.length - 1] = f.intent;
    f.trend = f.intent.map((v, k) => v - f.hist[0][k]);
  }

  resolveFork(f) {
    const c = this.crowd;
    f.resolved = true;
    f.resolvedAt = this.t;
    for (let i = 0; i < this.n; i++) if (c.alive[i] && c.lane[i] < 0) c.lane[i] = laneAt(f, c.x[i]);
    for (const h of this.humans) {
      if (h.alive && h.laneFork !== f.i) { h.laneFork = f.i; h.lane = laneAt(f, h.x); }
    }
    this.computeCounts(f);

    const col = pickCollapse(f.counts, f.invert, this.r);
    f.collapsed = col;
    let lottery = null;
    if (!col.length && f.overtime) {
      const lane = f.counts.findIndex(v => v > 1);
      if (lane >= 0) {
        const ids = [];
        for (let i = 0; i < this.n; i++) if (c.alive[i] && c.lane[i] === lane) ids.push(i);
        for (const h of this.humans) if (h.alive && h.lane === lane) ids.push(-1 - h.idx);
        for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(this.r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
        lottery = new Set(ids.slice(0, Math.max(1, Math.floor(ids.length / 2))));
        f.lottery = true;
      }
    }
    this._fx = [];
    let fallen = 0;
    for (let i = 0; i < this.n; i++) {
      if (!c.alive[i]) continue;
      if (col.includes(c.lane[i]) || (lottery && lottery.has(i))) { this.killBot(i, true); fallen++; }
      else c.sc[i] += f.lanes[c.lane[i]].gold ? 200 : 100;
    }
    const dying = [];
    for (const h of this.humans) {
      if (!h.alive) continue;
      const gold = f.lanes[h.lane].gold;
      if (col.includes(h.lane) || (lottery && lottery.has(-1 - h.idx))) {
        dying.push(h);
        h.forkLog.push('lost');
        fallen++;
        if (this._fx.length < FX_CAP * 2) this._fx.push(h.x, this.pY);
      } else {
        h.forksOk++;
        h.forkLog.push('ok');
        h.score += gold ? 200 : 100;
        if (gold) h.feats.gold = true;
        if (f.variant === 'fog') h.feats.fog = true;
        if (f.invert) h.feats.invert = true;
        if (h.dashFork === f.i) h.feats.dashSave = true;
        this.hev(h, 'survived', { gold });
      }
    }
    const fx = this._fx;
    this._fx = null;
    this.gEvents.push({ type: 'forkResolved', fork: f.i, collapsed: col, fallen, fx: fx.map(v => Math.round(v)), lottery: !!lottery, counts: f.counts });
    for (const h of dying) h.alive = false;
    for (const h of dying) this.killHuman(h, lottery ? 'lottery' : f.invert ? 'inverted' : 'majority', fallen - 1);

    resetCrowdForFork(this);
    this.cf++;
  }

  killHuman(h, why, sameEvent) {
    h.alive = false;
    h.death = this.t;
    h.why = why;
    h.combo = 0;
    const better = this.aliveTotal;   // ya no cuenta a h
    h.rank = better + 1;
    h.pct = Math.max(0, (this.total - better - sameEvent) / this.total * 100);
    this.hev(h, 'playerDied', { why, rank: h.rank, pct: h.pct, sameEvent, x: h.x, y: h.y });
    this.gEvents.push({ type: 'humanDown', id: h.id, name: h.name, why });
  }

  checkMilestonesAll() {
    const alive = this.aliveTotal;
    for (const h of this.humans) {
      if (!h.alive) continue;
      let hit = null, pts = 0;
      while (h.milestoneIdx < MILESTONES.length && alive <= MILESTONES[h.milestoneIdx].n) {
        hit = MILESTONES[h.milestoneIdx];
        pts += hit.pts;
        h.milestoneIdx++;
      }
      if (hit) {
        h.score += pts;
        this.hev(h, 'milestone', { n: hit.n, pts, x: h.x, y: h.y, alive });
      }
    }
  }

  extend() {
    const L = this.lvl;
    const y0 = Math.max(this.pY + 250, L.forks[L.forks.length - 1].endY + 60);
    const seg = buildOvertime(this.r, y0, this.overtime);
    this.overtime++;
    L.gates.push(...seg.gates);
    L.forks.push(seg.fork);
    for (const o of seg.orbs) L.orbs.push(o);
    L.orbs.sort((a, b) => a.y - b.y);
    L.endY = seg.endY + 400;
    this.gEvents.push({ type: 'overtime', n: this.overtime, alive: this.aliveTotal, seg: { gates: seg.gates, fork: seg.fork, orbs: seg.orbs }, endY: L.endY });
  }

  finish() {
    const c = this.crowd;
    this.ended = true;
    const avg = CFG.SPEED0 + CFG.SPEED_STEP * CFG.FORKS / 2;
    let bestDeath = -1, bestScore = -1, who = null;
    for (let i = 0; i < this.n; i++) {
      const d = c.death[i];
      const sc = c.sc[i] + Math.min(d, this.t) * avg / 10 + hash01(i, this.seed) * 120;
      c.sc[i] = sc;
      if (d > bestDeath || (d === bestDeath && sc > bestScore)) { bestDeath = d; bestScore = sc; who = { bot: i }; }
    }
    for (const h of this.humans) {
      if (h.death > bestDeath || (h.death === bestDeath && h.score >= bestScore)) { bestDeath = h.death; bestScore = h.score; who = { human: h }; }
    }
    // Puestos finales de los que siguen vivos: por puntaje
    for (const h of this.humans) {
      if (!h.alive) continue;
      let better = 0;
      for (let i = 0; i < this.n; i++) if (c.alive[i] && c.sc[i] > h.score) better++;
      for (const o of this.humans) if (o !== h && o.alive && o.score > h.score) better++;
      h.rank = better + 1;
      h.pct = (this.total - better) / this.total * 100;
    }
    if (who && who.human) who.human.rank = 1;
    this.outlier = who && who.human
      ? { id: who.human.id, name: who.human.name, score: Math.round(bestScore), human: true }
      : { name: this.botName(who ? who.bot : 0), score: Math.round(bestScore), human: false };
    this.gEvents.push({ type: 'roundEnd' });
  }

  summaryFor(h) {
    return {
      score: Math.round(h.score), rank: h.rank, total: this.total, pct: h.pct,
      forksOk: h.forksOk, forks: Math.max(CFG.FORKS, h.forkLog.length), near: h.near, maxCombo: h.maxCombo, orbs: h.orbs,
      alive: h.alive, outlier: !!(this.outlier && this.outlier.id === h.id), why: h.why, feats: { ...h.feats },
      forksSeen: h.forkLog.length, beatRival: false, rival: '', dashes: h.dashes, online: true,
    };
  }

  standings() {
    return this.humans
      .map(h => ({ id: h.id, name: h.name, skin: h.skin, nameStyle: h.nameStyle, rank: h.rank, score: Math.round(h.score), alive: h.alive }))
      .sort((a, b) => a.rank - b.rank || b.score - a.score);
  }
}
