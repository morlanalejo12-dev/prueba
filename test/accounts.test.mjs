import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { makeApi } from '../server/api.js';
import { MemoryStore } from '../server/store.js';

function client(env = {}, fetchImpl) {
  const store = new MemoryStore();
  const api = makeApi(store, env, fetchImpl);
  let n = 0;
  const call = async (method, path, body) => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    req.method = method;
    req.headers = { 'x-forwarded-for': '10.0.0.' + (n++ % 200) };
    let code = 0, out = '';
    await api(req, { writeHead: c => { code = c; }, end: s => { out = s; } }, new URL(path, 'http://x'));
    return { code, json: JSON.parse(out || '{}') };
  };
  return { call, store };
}

test('cuentas: invitado → registro con email conserva el progreso; login desde otro dispositivo', async () => {
  const { call } = client();
  const g = (await call('POST', '/api/account', {})).json;
  await call('PUT', '/api/save', { id: g.id, secret: g.secret, save: { xp: 500 } });
  assert.equal((await call('POST', '/api/register', { email: 'x', password: '12345678' })).code, 400);
  assert.equal((await call('POST', '/api/register', { email: 'ana@mail.com', password: 'corta' })).code, 400);
  const reg = (await call('POST', '/api/register', { email: 'Ana@Mail.com', password: 'secreta123', id: g.id, secret: g.secret })).json;
  assert.equal(reg.id, g.id, 'la cuenta de invitado pasa a tener email');
  assert.equal(reg.save.xp, 500);
  assert.equal((await call('POST', '/api/register', { email: 'ana@mail.com', password: 'otra12345' })).code, 400, 'email repetido');
  assert.equal((await call('POST', '/api/login', { email: 'ana@mail.com', password: 'mal' })).code, 401);
  const log = (await call('POST', '/api/login', { email: 'ANA@mail.com', password: 'secreta123' })).json;
  assert.equal(log.save.xp, 500);
  assert.notEqual(log.secret, reg.secret, 'cada dispositivo tiene su clave');
  assert.equal((await call('POST', '/api/me', { id: log.id, secret: reg.secret })).code, 200, 'la otra sesión sigue válida');
  await call('POST', '/api/logout', { id: log.id, secret: log.secret });
  assert.equal((await call('POST', '/api/me', { id: log.id, secret: log.secret })).code, 401, 'cerrar sesión invalida esa clave');
});

test('Google: verifica el token con Google y rechaza tokens de otra app', async () => {
  const fake = async url => ({ ok: true, json: async () => (url.includes('BUENO') ? { aud: 'mi-app', sub: 'g1', email: 'beto@gmail.com', email_verified: 'true' } : { aud: 'otra-app', sub: 'g2', email_verified: 'true' }) });
  const { call } = client({ GOOGLE_CLIENT_ID: 'mi-app' }, fake);
  assert.equal((await call('GET', '/api/config')).json.google, 'mi-app');
  assert.equal((await call('POST', '/api/google', { credential: 'MALO' })).code, 401);
  const a = (await call('POST', '/api/google', { credential: 'BUENO' })).json;
  const b = (await call('POST', '/api/google', { credential: 'BUENO' })).json;
  assert.equal(a.id, b.id, 'la misma cuenta de Google entra a la misma cuenta');
  assert.equal(a.email, 'beto@gmail.com');
});

test('pagos: apagados sin credenciales; con Mercado Pago, solo se entrega un pago aprobado y por el precio correcto', async () => {
  const off = client();
  assert.equal((await off.call('GET', '/api/config')).json.payments, false);
  const calls = [];
  const fakeMp = async (url, opt) => {
    calls.push(url);
    if (url.endsWith('/checkout/preferences')) return { ok: true, json: async () => ({ init_point: 'https://mp/pagar/1' }) };
    const id = url.split('/').pop();
    const pays = { 11: { status: 'approved', external_reference: 'REF:pass', transaction_amount: 4788 }, 12: { status: 'rejected', external_reference: 'REF:pass', transaction_amount: 4788 }, 13: { status: 'approved', external_reference: 'REF:pass', transaction_amount: 10 } };
    const p = pays[id];
    if (p) p.external_reference = p.external_reference.replace('REF', globalThis.__acc);
    return { ok: !!p, json: async () => p };
  };
  const { call } = client({ MP_ACCESS_TOKEN: 'tok', PUBLIC_URL: 'https://juego.com', MP_CURRENCY: 'ARS', MP_USD_RATE: '1200' }, fakeMp);
  const g = (await call('POST', '/api/account', {})).json;
  globalThis.__acc = g.id;
  assert.equal((await call('POST', '/api/pay/checkout', { id: g.id, secret: g.secret, item: 'pass' })).code, 403, 'un invitado no puede comprar');
  await call('POST', '/api/register', { email: 'c@c.com', password: '12345678', id: g.id, secret: g.secret });
  const log = (await call('POST', '/api/login', { email: 'c@c.com', password: '12345678' })).json;
  assert.equal((await call('POST', '/api/pay/checkout', { id: log.id, secret: log.secret, item: 'pass' })).json.url, 'https://mp/pagar/1');
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '12' } });
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '13' } });
  assert.equal((await call('POST', '/api/me', { id: log.id, secret: log.secret })).json.ent.pass, false, 'rechazado o monto bajo: no se entrega');
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '11' } });
  assert.equal((await call('POST', '/api/me', { id: log.id, secret: log.secret })).json.ent.pass, true);
});

test('límite de intentos por IP en el login', async () => {
  const store = new MemoryStore(), api = makeApi(store, {});
  let last = 0;
  for (let i = 0; i < 25; i++) {
    const req = Readable.from([Buffer.from('{"email":"a@a.com","password":"x"}')]);
    req.method = 'POST'; req.headers = { 'x-forwarded-for': '1.2.3.4' };
    await api(req, { writeHead: c => { last = c; }, end: () => {} }, new URL('/api/login', 'http://x'));
  }
  assert.equal(last, 429);
});

test('eliminar la cuenta borra los datos y libera el email', async () => {
  const { call } = client();
  const r = (await call('POST', '/api/register', { email: 'z@z.com', password: '12345678' })).json;
  assert.equal((await call('POST', '/api/delete', { id: r.id, secret: 'mal' })).code, 401);
  assert.equal((await call('POST', '/api/delete', { id: r.id, secret: r.secret })).json.ok, true);
  assert.equal((await call('POST', '/api/login', { email: 'z@z.com', password: '12345678' })).code, 401);
  assert.equal((await call('POST', '/api/register', { email: 'z@z.com', password: '12345678' })).code, 200, 'el email queda libre');
});

test('olvidé mi contraseña: envía un enlace por email y el token sirve una sola vez', async () => {
  const sent = [];
  const fakeMail = async (url, opt) => { sent.push(JSON.parse(opt.body)); return { ok: true, json: async () => ({}) }; };
  const { call } = client({ RESEND_API_KEY: 're_x', PUBLIC_URL: 'https://juego.com' }, fakeMail);
  await call('POST', '/api/register', { email: 'r@r.com', password: 'vieja1234' });
  assert.equal((await call('POST', '/api/reset/request', { email: 'nadie@r.com' })).json.ok, true, 'no revela si existe');
  assert.equal(sent.length, 0);
  await call('POST', '/api/reset/request', { email: 'r@r.com' });
  const token = sent[0].html.match(/reset=([A-Z0-9]+)/)[1];
  assert.equal((await call('POST', '/api/reset/confirm', { token, password: 'nueva1234' })).code, 200);
  assert.equal((await call('POST', '/api/reset/confirm', { token, password: 'otra12345' })).code, 400, 'un solo uso');
  assert.equal((await call('POST', '/api/login', { email: 'r@r.com', password: 'nueva1234' })).code, 200);
});
