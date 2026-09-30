// API HTTP del juego: cuentas en la nube, tablas de puntaje y estadísticas de uso.
// Todo responde JSON y admite CORS (el juego también se abre como archivo suelto).
import { Accounts } from './accounts.js';
import { paymentsConfig, createCheckout, verifyMp, verifyDlocal, capturePaypal } from './payments.js';
import { catalog, packById, packAvailable } from '../src/game/prices.js';

const MAX_BODY = 256 * 1024;
const MAX_SCORE = 60000;       // puntaje máximo creíble en una ronda (filtra trampas groseras)
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

// Límite simple por IP para las rutas sensibles (login, registro, recuperación)
function limiter(max, windowMs) {
  const hits = new Map();
  return ip => {
    const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
    if (now - h.t > windowMs) { h.n = 0; h.t = now; }
    h.n++;
    hits.set(ip, h);
    if (hits.size > 5000) hits.clear();
    return h.n <= max;
  };
}

export function makeApi(store, env = process.env, fetchImpl = fetch) {
  const accounts = new Accounts(store);
  const pay = paymentsConfig(env);
  const strict = limiter(20, 60000);
  const STRICT = new Set(['/api/login', '/api/register', '/api/google', '/api/restore', '/api/account', '/api/password', '/api/reset/request', '/api/reset/confirm']);
  const send = (res, code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };

  const routes = {
    // Qué está habilitado en este servidor (Google, pagos)
    'GET /api/config': async () => ({ google: env.GOOGLE_CLIENT_ID || null, payments: pay.on, pay: pay.enabled, fx: pay.fx, reset: !!(env.RESEND_API_KEY && env.PUBLIC_URL) }),
    // Cuenta nueva (invitado): id + clave. El código de recuperación es "ID-CLAVE".
    'POST /api/account': async () => accounts.createGuest(),
    'POST /api/register': async b => { const r = await accounts.register(b); return r.error ? [400, r] : r; },
    'POST /api/login': async b => { const r = await accounts.login(b); return r.error ? [401, r] : r; },
    'POST /api/google': async b => { const r = await accounts.google(b, env.GOOGLE_CLIENT_ID, fetchImpl); return r.error ? [401, r] : r; },
    'POST /api/password': async b => { const r = await accounts.changePassword(b); return r.error ? [400, r] : r; },
    'POST /api/logout': async b => accounts.logout(b),
    // Siempre responde lo mismo (no revela si el email existe)
    'POST /api/reset/request': async b => {
      if (!env.RESEND_API_KEY || !env.PUBLIC_URL) return [503, { error: 'La recuperación por email todavía no está disponible. Usá tu código de recuperación.' }];
      const r = await accounts.resetRequest(b.email);
      if (r) {
        const link = `${env.PUBLIC_URL.replace(/\/$/, '')}/?reset=${r.token}`;
        await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: env.MAIL_FROM || 'Contracorriente <onboarding@resend.dev>', to: [r.email], subject: 'Restablecé tu contraseña de Contracorriente',
            html: `<p>Hola:</p><p>Pediste restablecer tu contraseña de Contracorriente. Tocá este enlace (vence en 30 minutos):</p><p><a href="${link}">${link}</a></p><p>Si no fuiste vos, ignorá este email.</p>`,
          }),
        }).catch(() => {});
      }
      return { ok: true };
    },
    'POST /api/reset/confirm': async b => { const r = await accounts.resetConfirm(b); return r.error ? [400, r] : r; },
    'POST /api/delete': async b => { const r = await accounts.remove(b); return r.error ? [401, r] : r; },
    // Datos de la cuenta: email y compras (lo comprado lo decide el servidor, no el dispositivo)
    'POST /api/me': async b => {
      const acct = await accounts.auth(b.id, b.secret);
      if (!acct) return [401, { error: 'Cuenta inválida.' }];
      return { email: acct.email || null, google: !!acct.google, ent: acct.ent || { pass: false, items: {} }, updated: acct.updated };
    },
    'PUT /api/save': async b => {
      const acct = await accounts.auth(b.id, b.secret);
      if (!acct || !b.save || typeof b.save !== 'object') return [401, { error: 'Cuenta inválida.' }];
      acct.save = b.save;
      await accounts.put(b.id, acct);
      return { ok: true, updated: acct.updated, ent: acct.ent || { pass: false, items: {} } };
    },
    'POST /api/restore': async b => {
      const [id, secret] = String(b.code || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').split('-');
      const acct = await accounts.auth(id, secret);
      if (!acct) return [404, { error: 'Código de recuperación inválido.' }];
      return { id, secret, save: acct.save, updated: acct.updated, email: acct.email || null, ent: acct.ent };
    },
    // Pagos
    'POST /api/pay/checkout': async b => {
      if (!pay.on) return [503, { error: 'Las compras se habilitan pronto.' }];
      const acct = await accounts.auth(b.id, b.secret);
      if (!acct) return [401, { error: 'Iniciá sesión para comprar.' }];
      if (!acct.email) return [403, { error: 'Creá una cuenta con email para comprar: así no perdés lo que pagás.' }];
      if (!catalog()[b.item]) return [400, { error: 'Ese artículo no está a la venta.' }];
      const ent = acct.ent || {};
      const pk = packById(b.item);
      if (pk && !packAvailable(pk, ent.items || {}, !!ent.pass, ent.bought || {})) return [409, { error: 'Ya tenés algo de este pack.' }];
      if ((b.item === 'pass' && ent.pass) || (ent.items && ent.items[b.item])) return [409, { error: 'Ya es tuyo.' }];
      const r = await createCheckout({ accountId: b.id, item: b.item, country: String(b.country || 'XX'), method: String(b.method || '') }, pay, store, fetchImpl);
      return r.error ? [502, r] : r;
    },
    // Aviso de Mercado Pago
    'POST /api/pay/webhook': async (b, url) => {
      const pid = (b && b.data && b.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id');
      const type = (b && b.type) || url.searchParams.get('type') || url.searchParams.get('topic');
      if (!pay.mp || (type && type !== 'payment')) return { ok: true };
      await fulfill(await verifyMp(pid, pay, store, fetchImpl), 'mp:' + pid);
      return { ok: true };
    },
    // Aviso de dLocal Go
    'POST /api/pay/dlocal': async b => {
      if (!pay.dlocal) return { ok: true };
      const pid = b && (b.payment_id || b.id);
      await fulfill(await verifyDlocal(pid, pay, store, fetchImpl), 'dl:' + pid);
      return { ok: true };
    },
    // Vuelta de PayPal: se captura el pago y se vuelve al juego
    'GET /api/pay/paypal': async (b, url) => {
      const o = url.searchParams.get('o') || '';
      const done = await fulfill(await capturePaypal(o, pay, store, fetchImpl), 'pp:' + o);
      return { redirect: `${pay.publicUrl || ''}/?pago=${done ? 'ok' : 'error'}` };
    },
    // Estado de una orden (el juego lo consulta al volver del pago)
    'POST /api/pay/status': async b => {
      const acct = await accounts.auth(b.id, b.secret);
      if (!acct) return [401, { error: 'Cuenta inválida.' }];
      const o = await store.get('order', String(b.order || ''));
      if (!o || o.acct !== b.id) return [404, { error: 'No existe.' }];
      return { status: o.status, item: o.item, ent: acct.ent };
    },
    // Puntajes: se guarda el mejor de cada jugador por tabla
    'POST /api/score': async b => {
      if (!BOARD.test(b.board || '') || !FID.test(b.pid || '')) return [400, { error: 'Datos inválidos.' }];
      const score = Math.floor(+b.score);
      if (!(score >= 0 && score <= MAX_SCORE)) return [400, { error: 'Puntaje inválido.' }];
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
    'GET /api/stats': async (b, url) => {
      if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return [403, { error: 'Falta la clave de administrador.' }];
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

  // Entrega lo comprado una sola vez por orden (los avisos pueden llegar repetidos)
  async function fulfill(orderId, payRef) {
    if (!orderId) return false;
    const o = await store.get('order', orderId);
    if (!o) return false;
    if (o.status === 'paid') return true;
    await accounts.grant(o.acct, o.item);
    await store.set('order', orderId, { ...o, status: 'paid', paid: Date.now(), payRef });
    return true;
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
    const ip = String(req.headers && (req.headers['x-forwarded-for'] || '')).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
    if (STRICT.has(url.pathname) && !strict(ip)) { send(res, 429, { error: 'Demasiados intentos. Esperá un minuto.' }); return true; }
    const fn = routes[`${req.method} ${url.pathname}`];
    if (!fn) { send(res, 404, { error: 'No existe.' }); return true; }
    try {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const out = await fn(body, url);
      if (out && out.redirect) { res.writeHead(302, { location: out.redirect, 'cache-control': 'no-store' }); res.end(); } else if (Array.isArray(out)) send(res, out[0], out[1]); else send(res, 200, out);
    } catch (e) {
      send(res, 400, { error: 'Pedido inválido.' });
    }
    return true;
  };
}
