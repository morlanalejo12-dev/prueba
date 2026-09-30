// Vista de una ronda online. Expone la misma interfaz que Round (px, pY, fork, crowd, events…)
// para reutilizar el render, el HUD y los sonidos, pero el que decide es el servidor:
//  - la multitud y los otros jugadores llegan en instantáneas y se interpolan;
//  - el reloj del mundo se extrapola y se corrige suave hacia el del servidor;
//  - tu x se predice acá (respuesta inmediata) y se informa al servidor con tu y.
import { CFG } from '../config.js';
import { clamp } from '../util/math.js';
import { laneAt } from '../sim/level.js';

const SEND_EVERY = 0.05;     // 20 envíos por segundo
const SNAP_DT = 4 / 60;      // intervalo entre instantáneas del servidor

function b64bytes(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class NetRound {
  constructor(start, myId, send) {
    this.online = true;
    this.demo = false;
    this.seed = start.seed;
    this.send = send;
    const L = start.level;
    for (const o of L.orbs) o.taken = false;
    this.lvl = L;
    this.n = start.n;
    const yo = new Int8Array(b64bytes(start.yo).buffer);
    this.crowd = {
      x: new Float32Array(this.n), yo: Float32Array.from(yo), alive: new Uint8Array(this.n).fill(1),
      x0: new Float32Array(this.n), x1: new Float32Array(this.n),
    };
    for (let i = 0; i < this.n; i++) this.crowd.x[i] = this.crowd.x0[i] = this.crowd.x1[i] = CFG.W / 2;
    this.humans = start.humans;
    const me = start.humans.find(h => h.id === myId);
    this.meIdx = me ? me.idx : -1;
    this.others = start.humans.filter(h => h.id !== myId).map(h => ({ ...h, x: CFG.W / 2, x0: CFG.W / 2, x1: CFG.W / 2, alive: true }));
    this.aliveBots = this.n;
    this.aliveH = start.humans.length;

    this.t = 0; this.pY = 0; this.speed = CFG.SPEED0; this.cf = 0;
    this.px = CFG.W / 2; this.ptx = this.px; this.keyDir = 0;
    this.pAlive = this.meIdx >= 0; this.pLane = -1; this.laneFork = -1;
    this.score = 0; this.combo = 0; this.charges = CFG.DASH_START; this.dashFork = -1;
    this.forkLog = [];
    this.rival = -1; this.rivalAlive = true; this.rivalName = '';
    this.ended = false; this.outlier = null; this.result = null;
    this.events = [];
    this.running = false;
    this.clock = null;           // última referencia del servidor { T, y, sp, at }
    this.snapAt = 0;
    this.sendT = 0;
    this.overtime = 0;
    this.pOrb = 0;
  }

  // Durante la cuenta regresiva: moverse y avisar la posición inicial
  idle(dt) {
    this.movePlayer(dt, null);
    this.sendT -= dt;
    if (this.sendT <= 0) { this.sendT = 0.1; this.send({ t: 'in', x: Math.round(this.px * 10) / 10, y: 0 }); }
  }

  get total() { return this.n + this.humans.length; }
  get aliveTotal() { return this.aliveBots + this.aliveH; }
  get fork() { return this.lvl.forks[this.cf]; }

  setTarget(x) { this.ptx = x; }
  setKeyDir(d) { this.keyDir = d; if (!d) this.ptx = this.px; }

  tension() {
    const f = this.fork;
    if (!f || this.ended) return 0.3;
    if (this.pY >= f.entryY) return 0.85 + 0.15 * clamp((this.pY - f.entryY) / (f.endY - f.entryY), 0, 1);
    if (this.pY >= f.startY - 150) return 0.55 + 0.25 * clamp((this.pY - f.startY + 150) / (f.entryY - f.startY + 150), 0, 1);
    return 0.4;
  }

  movePlayer(dt, f) {
    const P = CFG.PR;
    if (this.keyDir) this.ptx = this.px + this.keyDir * 60;
    let lo = CFG.WALL + P, hi = CFG.W - CFG.WALL - P;
    if (f && !f.resolved && this.laneFork !== f.i && this.pY >= f.entryY) {
      this.laneFork = f.i;
      this.pLane = laneAt(f, this.px);
    }
    if (f && this.laneFork === f.i && this.pLane >= 0) {
      const L = f.lanes[this.pLane];
      lo = L.x0 + P; hi = L.x1 - P;
    }
    const md = CFG.PLAYER_SPEED * dt;
    this.px = clamp(this.px + clamp(clamp(this.ptx, lo, hi) - this.px, -md, md), lo, hi);
  }

  canDash() {
    const f = this.fork;
    return !!(this.pAlive && !this.ended && this.running && f && this.charges > 0 && this.laneFork === f.i && this.pLane >= 0
      && !f.resolved && this.pY < f.endY - 10 && this.dashFork !== f.i);
  }

  dash(dir) {
    if (!this.canDash()) return false;
    const f = this.fork, to = this.pLane + dir;
    if (to < 0 || to >= f.k) return false;
    const from = this.pLane, fromX = this.px;
    this.send({ t: 'in', x: this.px, y: this.pY });
    this.send({ t: 'dash', d: dir });
    this.pLane = to;
    this.px = this.ptx = (f.lanes[to].x0 + f.lanes[to].x1) / 2;
    this.charges--;
    this.dashFork = f.i;
    this.events.push({ type: 'dash', from, to, x0: fromX, x1: this.px, y: this.pY });
    return true;
  }

  // ---------- Reloj e interpolación ----------
  step(dt) {
    if (!this.running || this.ended) return;
    this.t += dt;
    this.pY += this.speed * dt;
    const c = this.clock;
    if (c) {
      const el = (performance.now() - c.at) / 1000;
      const ty = c.y + c.sp * el, tt = c.T + el;
      if (Math.abs(ty - this.pY) > 250) { this.pY = ty; this.t = tt; }
      else {
        const k = Math.min(1, dt * 4);
        this.pY += (ty - this.pY) * k;
        this.t += (tt - this.t) * k;
      }
    }
    const f = this.fork;
    if (this.pAlive) {
      this.movePlayer(dt, f);
      // Ocultar al instante las chispas que tocás (los puntos los confirma el servidor)
      const P = CFG.PR;
      for (const o of this.lvl.orbs) {
        if (o.y > this.pY + 24) break;
        if (!o.taken && o.y > this.pY - 24 && Math.abs(o.y - this.pY) < P + 8 && Math.abs(o.x - this.px) < P + 8) o.taken = true;
      }
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = SEND_EVERY; this.send({ t: 'in', x: Math.round(this.px * 10) / 10, y: Math.round(this.pY * 10) / 10 }); }
    }
    // Multitud: interpolar entre las dos últimas instantáneas
    const a = clamp((performance.now() - this.snapAt) / 1000 / SNAP_DT, 0, 1), cr = this.crowd;
    for (let i = 0; i < this.n; i++) if (cr.alive[i]) cr.x[i] = cr.x0[i] + (cr.x1[i] - cr.x0[i]) * a;
    for (const o of this.others) o.x = o.x0 + (o.x1 - o.x0) * a;
  }

  // ---------- Mensajes del servidor ----------
  onSnap(m) {
    const now = performance.now();
    this.clock = { T: m.T, y: m.y, sp: m.sp, at: now };
    if (!this.running) { this.running = true; this.pY = m.y; this.t = m.T; }
    this.speed = m.sp;
    this.aliveBots = m.ab;
    this.aliveH = m.ah;
    if (m.me) {
      this.score = m.me.sc;
      this.combo = m.me.cb;
      if (this.dashFork !== (this.fork && this.fork.i) || m.me.ch <= this.charges) this.charges = m.me.ch;
    }
    const bx = b64bytes(m.bx), cr = this.crowd;
    for (let i = 0; i < this.n; i++) {
      const v = bx[i];
      if (!v) { cr.alive[i] = 0; continue; }
      const x = (v - 1) / 254 * CFG.W;
      cr.x0[i] = cr.alive[i] ? cr.x[i] : x;
      cr.x1[i] = x;
    }
    for (const [idx, x, alive] of m.hs) {
      const o = this.others.find(p => p.idx === idx);
      if (!o) continue;
      o.x0 = o.x; o.x1 = x; o.alive = !!alive;
    }
    this.snapAt = now;
    if (m.f) {
      const f = this.lvl.forks[m.f.i];
      if (f) {
        f.intent = m.f.in; f.counts = m.f.c; f.trend = m.f.tr;
      }
    }
  }

  onEvents(m) {
    const personal = m.p || [];
    for (const e of m.g || []) {
      switch (e.type) {
        case 'forkAnnounce': {
          const f = this.lvl.forks[e.fork];
          if (f && !f.announced) { f.announced = true; this.events.push({ type: 'forkAnnounce', fork: f }); }
          break;
        }
        case 'forkResolved': {
          const f = this.lvl.forks[e.fork];
          if (!f) break;
          f.resolved = true; f.resolvedAt = this.t; f.collapsed = e.collapsed; f.counts = e.counts; f.lottery = e.lottery;
          const surv = personal.find(p => p.type === 'survived');
          const died = personal.find(p => p.type === 'playerDied' && p.why !== 'wall');
          let outcome = null, gold = false;
          if (surv) { outcome = 'survived'; gold = surv.gold; this.forkLog.push('ok'); }
          else if (died) { outcome = 'died'; this.forkLog.push('lost'); }
          const fx = [];
          for (let k = 0; k + 1 < e.fx.length; k += 2) fx.push(e.fx[k], e.fx[k + 1] - (this.clock ? this.clock.y - this.pY : 0));
          this.events.push({ type: 'forkResolved', fork: f, collapsed: e.collapsed, fallen: e.fallen, fx, outcome, gold, lottery: e.lottery });
          this.cf = Math.max(this.cf, e.fork + 1);
          this.pLane = -1;
          break;
        }
        case 'overtime': {
          const L = this.lvl, s = e.seg;
          L.gates.push(...s.gates);
          L.forks.push(s.fork);
          for (const o of s.orbs) { o.taken = false; L.orbs.push(o); }
          L.orbs.sort((a, b) => a.y - b.y);
          L.endY = e.endY;
          this.overtime = e.n;
          this.events.push({ type: 'overtime', n: e.n, alive: e.alive });
          break;
        }
        case 'humanDown':
          if (!this.humans[this.meIdx] || e.id !== this.humans[this.meIdx].id) this.events.push({ type: 'humanDown', name: e.name, why: e.why });
          break;
        default: break;
      }
    }
    for (const e of personal) {
      switch (e.type) {
        case 'orb': {
          const o = this.lvl.orbs[e.k];
          if (o) o.taken = true;
          this.events.push(e);
          break;
        }
        case 'charge': this.charges = e.charges; this.events.push(e); break;
        case 'nearMiss': case 'gatePass': case 'milestone': this.events.push(e); break;
        case 'playerDied':
          this.pAlive = false;
          this.pDeath = this.t;
          this.combo = 0;
          this.events.push({ ...e, x: this.px, y: this.pY });
          break;
        default: break;
      }
    }
  }

  onEnd(m, myId) {
    this.ended = true;
    this.result = m.sum;
    this.standings = m.standings;
    const o = m.outlier || {};
    this.outlier = { you: !!(o.human && o.id === myId), name: o.name || '—', score: o.score || 0, human: !!o.human };
  }

  summary() { return this.result; }
}
