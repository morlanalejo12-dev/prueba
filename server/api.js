// API HTTP del juego: cuentas en la nube, tablas de puntaje y estadísticas de uso.
// Todo responde JSON y admite CORS (el juego también se abre como archivo suelto).
import crypto from 'node:crypto';

const MAX_BODY = 256 * 1024;
const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const rid = n => Array.from(crypto.randomBytes(n), b => ID_CHARS[b % ID_CHARS.length]).join('');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const day = (d = new Date()) => d.toISOString().slice(0, 10);
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const FID = /^[A-Z0-9]{6}$/;
const BOARD = /^(daily-\d{4}-\d{2}-\d{2}|week-\d{4}-W\d{2})$/;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export function makeApi(store) {
  const send = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  const routes = {
    // Cuenta nueva (invitado): id público + secreto. El código de recuperación es "ID-SECRETO".
    'POST /api/account': async () => {
      const id = rid(8), secret = rid(10);
      await store.set('acct', id, { h: sha(secret), save: null, created: Date.now(), updated: 0 });
      return { id, secret };
    },
    'PUT /api/save': async b => {
      const acct = await auth(b.id, b.secret);
      if (!acct || !b.save || typeof b.save !== 'object') return [401, { error: 'Cuenta inválida.' }];
      acct.save = b.save;
      acct.updated = Date.now();
      await store.set('acct', b.id, acct);
      return { ok: true, updated: acct.updated };
    },
    'POST /api/restore': async b => {
      const [id, secret] = String(b.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').split('-');
      const acct = await auth(id, secret);
      if (!acct) return [404, { error: 'Código de recuperación inválido.' }];
      return { id, secret, save: acct.save, updated: acct.updated };
    },
    // Puntajes: se guarda el mejor de cada jugador por tabla
    'POST /api/score': async b => {
      if (!BOARD.test(b.board || '') || !FID.test(b.pid || '')) return [400, { error: 'Datos inválidos.' }];
      const score = Math.floor(+b.score);
      if (!(score >= 0 && score < 1e6)) return [400, { error: 'Puntaje inválido.' }];
      const ns = 'board:' + b.board, prev = await store.get(ns, b.pid);
      if (!prev || score > prev.score) {
        await store.set(ns, b.pid, { score, name: clean(b.name, 16) || 'Jugador', nameStyle: clean(b.nameStyle, 24), lvl: Math.max(1, Math.min(120, Math.floor(+b.lvl) || 1)), log: clean(b.log, 60), at: Date.now() });
      }
      return board(b.board, [b.pid]);
    },
    'GET /api/board': async (b, url) => {
      const id = url.searchParams.get('b') || '';
      if (!BOARD.test(id)) return [400, { error: 'Tabla inválida.' }];
      const ids = (url.searchParams.get('ids') || '').split(',').filter(x => FID.test(x)).slice(0, 100);
      return board(id, ids);
    },
    // Estadísticas de uso (anónimas): sesiones, rondas, dónde se muere, retención
    'POST /api/events': async b => {
      const dev = clean(b.device, 16), list = Array.isArray(b.events) ? b.events.slice(0, 200) : [];
      if (!dev) return [400, { error: 'Falta el dispositivo.' }];
      const today = day();
      const d = (await store.get('dev', dev)) || { first: today, days: [] };
      if (!d.days.includes(today)) { d.days.push(today); if (d.days.length > 90) d.days.shift(); await store.set('dev', dev, d); }
      const c = (await store.get('day', today)) || { devices: 0, sessions: 0, rounds: 0, survivedAll: 0, deathFork: {}, why: {}, opens: {}, modes: {} };
      if (!c._seen) c._seen = {};
      if (!c._seen[dev]) { c._seen[dev] = 1; c.devices++; }
      for (const e of list) {
        if (e.e === 'session') c.sessions++;
        else if (e.e === 'round') {
          c.rounds++;
          c.modes[e.mode || 'normal'] = (c.modes[e.mode || 'normal'] || 0) + 1;
          if (e.alive) c.survivedAll++;
          else { c.deathFork[e.fork] = (c.deathFork[e.fork] || 0) + 1; c.why[e.why] = (c.why[e.why] || 0) + 1; }
        } else if (e.e === 'open') c.opens[clean(e.k, 20)] = (c.opens[clean(e.k, 20)] || 0) + 1;
      }
      await store.set('day', today, c);
      return { ok: true };
    },
    'GET /api/stats': async () => {
      const days = (await store.list('day')).sort((a, b) => (a.key < b.key ? 1 : -1)).slice(0, 14)
        .map(({ key, value }) => { const { _seen, ...v } = value; return { day: key, ...v }; });
      const devs = await store.list('dev');
      const ret = {};
      for (const { value: d } of devs) {
        const r = ret[d.first] || (ret[d.first] = { nuevos: 0, d1: 0, d7: 0 });
        r.nuevos++;
        const f = new Date(d.first + 'T00:00:00Z');
        const plus = n => day(new Date(f.getTime() + n * 864e5));
        if (d.days.includes(plus(1))) r.d1++;
        if (d.days.includes(plus(7))) r.d7++;
      }
      return { dias: days, retencion: ret, jugadores: devs.length };
    },
  };

  async function auth(id, secret) {
    if (!/^[A-Z0-9]{8}$/.test(id || '') || !secret) return null;
    const acct = await store.get('acct', id);
    return acct && acct.h === sha(secret) ? acct : null;
  }

  async function board(id, ids) {
    const rows = (await store.list('board:' + id)).map(({ key, value }) => ({ pid: key, ...value })).sort((a, b) => b.score - a.score || a.at - b.at);
    const mine = {};
    rows.forEach((r, i) => { if (ids.includes(r.pid)) mine[r.pid] = i + 1; });
    return { board: id, total: rows.length, top: rows.slice(0, 20).map((r, i) => ({ rank: i + 1, ...r })), ranks: mine, friends: rows.filter(r => ids.includes(r.pid)).map(r => ({ rank: rows.indexOf(r) + 1, ...r })) };
  }

  // Devuelve true si atendió el pedido
  return async function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/')) return false;
    if (req.method === 'OPTIONS') { send(res, 204, {}); return true; }
    const fn = routes[`${req.method} ${url.pathname}`];
    if (!fn) { send(res, 404, { error: 'No existe.' }); return true; }
    try {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const out = await fn(body, url);
      if (Array.isArray(out)) send(res, out[0], out[1]); else send(res, 200, out);
    } catch (e) {
      send(res, 400, { error: 'Pedido inválido.' });
    }
    return true;
  };
}
