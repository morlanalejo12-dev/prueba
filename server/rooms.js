// Salas del modo online. No sabe nada de sockets: cada jugador trae una función send(obj|string),
// así la lógica se puede probar sin red.
//  - GLOBAL: sala pública, arranca una ronda al comenzar cada minuto (si hay alguien).
//  - Privadas: código de 4 letras; el anfitrión decide cuándo empieza.
import { MultiRound } from '../src/sim/multi.js';
import { CFG } from '../src/config.js';

export const PROTOCOL = 1;
export const GLOBAL = 'GLOBAL';
const STEP = 1 / 60;
const SNAP_EVERY = 4;          // 60 / 4 = 15 instantáneas por segundo
const COUNTDOWN_MS = 3000;
const RESULTS_MS = 8000;       // pausa entre el final de una ronda y la siguiente (global)
const QUEUE_MS = 10000;        // la sala global arranca 10 s después de que entra alguien…
const QUEUE_FULL = 8;          // …o apenas se juntan 8 jugadores
const MAX_PLAYERS = 40;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export { cleanName } from '../src/util/name.js';

const b64 = u8 => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
const r3 = v => Math.round(v * 1000) / 1000;

export function nextMinute(now, minGap = 0) {
  let t = Math.ceil((now + 1) / 60000) * 60000;
  while (t - now < minGap) t += 60000;
  return t;
}

export class Room {
  constructor(code, { pub = false, now = Date.now() } = {}) {
    this.code = code;
    this.pub = pub;
    this.players = new Map();
    this.host = null;
    this.phase = 'lobby';
    this.round = null;
    this.startAt = 0;
    this.acc = 0;
    this.steps = 0;
    this.roundNo = 0;
    this.last = null;      // resumen de la última ronda para quien entra después
  }

  get size() { return this.players.size; }

  add(p) {
    if (this.players.size >= MAX_PLAYERS) return false;
    this.players.set(p.id, p);
    if (!this.pub && !this.host) this.host = p.id;
    this.broadcastRoom();
    return true;
  }

  remove(id) {
    this.players.delete(id);
    if (this.host === id) this.host = this.players.size ? this.players.keys().next().value : null;
    this.broadcastRoom();
  }

  info(now = Date.now()) {
    return {
      t: 'room', code: this.code, pub: this.pub, host: this.host, phase: this.phase,
      startAt: this.startAt, now, round: this.roundNo,
      players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, skin: p.skin, trail: p.trail, nameStyle: p.nameStyle, lvl: p.lvl || 1, ttl: p.ttl || '', inRound: !!(this.round && this.round.byId.has(p.id)) })),
    };
  }

  broadcast(msg) {
    const s = typeof msg === 'string' ? msg : JSON.stringify(msg);
    for (const p of this.players.values()) p.send(s);
  }

  broadcastRoom(now = Date.now()) { this.broadcast(this.info(now)); }

  // Alguien cambió su nombre o su aspecto: avisar a toda la sala (también durante la ronda)
  profileChanged(p) {
    if (this.round) {
      const h = this.round.byId.get(p.id);
      if (h) Object.assign(h, { name: p.name, skin: p.skin, trail: p.trail, nameStyle: p.nameStyle, lvl: p.lvl || 1 });
    }
    this.broadcastRoom();
  }

  // El anfitrión de una sala privada pide empezar
  requestStart(id, now = Date.now()) {
    if (this.pub || id !== this.host || this.phase !== 'lobby' || !this.players.size) return false;
    this.beginCountdown(now + COUNTDOWN_MS, now);
    return true;
  }

  beginCountdown(at, now) {
    const humans = [...this.players.values()].map(p => ({ id: p.id, name: p.name, skin: p.skin, trail: p.trail, nameStyle: p.nameStyle, lvl: p.lvl || 1 }));
    const seed = (Math.random() * 4294967296) >>> 0;
    const R = new MultiRound({ seed, humans, bots: Math.max(200, CFG.BOTS - humans.length) });
    this.round = R;
    this.roundNo++;
    this.phase = 'countdown';
    this.startAt = at;
    this.acc = 0;
    this.steps = 0;
    const yo = new Int8Array(R.n);
    for (let i = 0; i < R.n; i++) yo[i] = Math.round(R.crowd.yo[i]);
    const base = {
      t: 'start', seed, n: R.n, at, now, round: this.roundNo,
      yo: b64(new Uint8Array(yo.buffer)),
      level: { gates: R.lvl.gates, forks: R.lvl.forks, orbs: R.lvl.orbs, endY: R.lvl.endY },
      humans: R.humans.map(h => ({ id: h.id, name: h.name, skin: h.skin, trail: h.trail, nameStyle: h.nameStyle, idx: h.idx })),
    };
    const s = JSON.stringify(base);
    for (const p of this.players.values()) p.send(s);
    this.broadcastRoom(now);
  }

  input(id, x, y) {
    if (this.round && (this.phase === 'playing' || this.phase === 'countdown')) {
      if (this.phase === 'countdown') {
        const h = this.round.byId.get(id);
        if (h) h.x = this.round.clampX(h, x, 0);
      } else this.round.input(id, x, y);
    }
  }

  dash(id, dir) {
    if (this.round && this.phase === 'playing') this.round.dash(id, dir);
  }

  // Avanza la sala. dtMs: tiempo real transcurrido
  tick(now, dtMs) {
    if (this.pub && this.phase === 'lobby') {
      // Cola continua: sin esperar al minuto exacto
      if (!this.players.size) { if (this.startAt) { this.startAt = 0; this.broadcastRoom(now); } return; }
      if (!this.startAt) { this.startAt = now + QUEUE_MS; this.broadcastRoom(now); }
      if (this.players.size >= QUEUE_FULL && this.startAt > now + COUNTDOWN_MS) { this.startAt = now + COUNTDOWN_MS; this.broadcastRoom(now); }
      if (now >= this.startAt - COUNTDOWN_MS) this.beginCountdown(Math.max(this.startAt, now + 1500), now);
      return;
    }
    if (this.phase === 'countdown' && now >= this.startAt) {
      this.phase = 'playing';
      this.broadcastRoom(now);
    }
    if (this.phase !== 'playing') return;
    const R = this.round;
    this.acc += Math.min(dtMs, 250) / 1000;
    while (this.acc >= STEP && !R.ended) {
      R.step(STEP);
      this.acc -= STEP;
      this.steps++;
      this.flushEvents();
      if (this.steps % SNAP_EVERY === 0) this.snapshot();
    }
    if (R.ended) this.endRound(now);
  }

  flushEvents() {
    const R = this.round, g = R.gEvents;
    for (const h of R.humans) {
      if (!g.length && !h.ev.length) continue;
      const p = this.players.get(h.id);
      if (p) p.send(JSON.stringify({ t: 'ev', g, p: h.ev }));
      h.ev = [];
    }
    // Espectadores que entraron durante la ronda: solo los eventos globales
    if (g.length) {
      const s = JSON.stringify({ t: 'ev', g, p: [] });
      for (const p of this.players.values()) if (!R.byId.has(p.id)) p.send(s);
    }
    R.gEvents = [];
  }

  snapshot() {
    const R = this.round, c = R.crowd, f = R.fork;
    const bx = new Uint8Array(R.n);
    for (let i = 0; i < R.n; i++) bx[i] = c.alive[i] ? Math.max(1, Math.min(255, Math.round(c.x[i] / CFG.W * 254) + 1)) : 0;
    const shared = JSON.stringify({
      T: r3(R.t), y: r3(R.pY), sp: R.speed, cf: R.cf, ab: R.aliveBots, ah: R.aliveHumans,
      bx: b64(bx),
      hs: R.humans.map(h => [h.idx, Math.round(h.x * 10) / 10, h.alive ? 1 : 0, h.laneFork === R.cf ? h.lane : -1]),
      f: f ? { i: f.i, in: (f.intent || []).map(r3), c: f.counts || [], tr: (f.trend || []).map(r3), pj: (f.proj || []).map(r3) } : null,
    });
    const tail = shared.slice(1);
    for (const p of this.players.values()) {
      const h = R.byId.get(p.id);
      const me = h ? { sc: Math.round(h.score), ch: h.charges, cb: h.combo, al: h.alive ? 1 : 0, y: Math.round(h.y) } : null;
      p.send(`{"t":"s","me":${JSON.stringify(me)},${tail}`);
    }
  }

  endRound(now) {
    const R = this.round;
    this.flushEvents();
    const standings = R.standings();
    const outlier = R.outlier;
    for (const h of R.humans) {
      const p = this.players.get(h.id);
      if (p) p.send(JSON.stringify({ t: 'end', sum: R.summaryFor(h), standings, outlier }));
    }
    const spect = JSON.stringify({ t: 'end', sum: null, standings, outlier });
    for (const p of this.players.values()) if (!R.byId.has(p.id)) p.send(spect);
    this.last = { standings, outlier };
    this.round = null;
    this.phase = 'lobby';
    this.startAt = this.pub && this.players.size ? now + RESULTS_MS + COUNTDOWN_MS : 0;
    this.broadcastRoom(now);
  }
}

export class Lobby {
  constructor() {
    this.rooms = new Map([[GLOBAL, new Room(GLOBAL, { pub: true })]]);
    this.seq = 0;
  }

  newCode() {
    for (let tries = 0; tries < 200; tries++) {
      let s = '';
      for (let k = 0; k < 4; k++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
      if (!this.rooms.has(s)) return s;
    }
    return null;
  }

  create() {
    if (this.rooms.size > 500) return null;
    const code = this.newCode();
    if (!code) return null;
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code) { return this.rooms.get(String(code || '').toUpperCase()); }

  leave(room, id) {
    room.remove(id);
    if (!room.pub && !room.size) this.rooms.delete(room.code);
  }

  tick(now, dtMs) {
    for (const room of this.rooms.values()) room.tick(now, dtMs);
  }
}
