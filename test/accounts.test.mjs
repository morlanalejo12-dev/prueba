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

test('pagos: apagados sin credenciales; Mercado Pago solo entrega pagos aprobados por el precio correcto', async () => {
  const off = client();
  assert.equal((await off.call('GET', '/api/config')).json.payments, false);
  const pays = {};
  const fakeMp = async (url, opt) => {
    if (url.endsWith('/checkout/preferences')) { const b = JSON.parse(opt.body); globalThis.__pref = b; return { ok: true, json: async () => ({ id: 'pref1', init_point: 'https://mp/pagar/1' }) }; }
    const p = pays[url.split('/').pop()];
    return { ok: !!p, json: async () => p };
  };
  const { call } = client({ MP_ACCESS_TOKEN: 'tok', PUBLIC_URL: 'https://juego.com', FX_ARS: '1200' }, fakeMp);
  const cfg = (await call('GET', '/api/config')).json;
  assert.deepEqual(cfg.pay, { mp: true, dlocal: false, paypal: false });
  const g = (await call('POST', '/api/account', {})).json;
  assert.equal((await call('POST', '/api/pay/checkout', { id: g.id, secret: g.secret, item: 'pass', country: 'AR', method: 'mp' })).code, 403, 'un invitado no puede comprar');
  await call('POST', '/api/register', { email: 'c@c.com', password: '12345678', id: g.id, secret: g.secret });
  const log = (await call('POST', '/api/login', { email: 'c@c.com', password: '12345678' })).json;
  assert.equal((await call('POST', '/api/pay/checkout', { id: log.id, secret: log.secret, item: 'pass', country: 'BR', method: 'mp' })).code, 502, 'Mercado Pago es solo para Argentina');
  const co = (await call('POST', '/api/pay/checkout', { id: log.id, secret: log.secret, item: 'pass', country: 'AR', method: 'mp' })).json;
  assert.equal(co.url, 'https://mp/pagar/1');
  assert.equal(globalThis.__pref.items[0].unit_price, 2399, 'precio argentino: 3,99 × 1200 × 0,5 redondeado');
  assert.equal(globalThis.__pref.items[0].currency_id, 'ARS');
  pays[11] = { status: 'approved', external_reference: co.order, transaction_amount: 2399, currency_id: 'ARS' };
  pays[12] = { status: 'rejected', external_reference: co.order, transaction_amount: 2399, currency_id: 'ARS' };
  pays[13] = { status: 'approved', external_reference: co.order, transaction_amount: 10, currency_id: 'ARS' };
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '12' } });
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '13' } });
  assert.equal((await call('POST', '/api/me', { id: log.id, secret: log.secret })).json.ent.pass, false, 'rechazado o monto bajo: no se entrega');
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '11' } });
  await call('POST', '/api/pay/webhook', { type: 'payment', data: { id: '11' } });
  const me = (await call('POST', '/api/me', { id: log.id, secret: log.secret })).json;
  assert.equal(me.ent.pass, true);
  assert.equal(me.ent.bought.pass, 1, 'un aviso repetido no entrega dos veces');
  assert.equal((await call('POST', '/api/pay/status', { id: log.id, secret: log.secret, order: co.order })).json.status, 'paid');
  assert.equal((await call('POST', '/api/pay/checkout', { id: log.id, secret: log.secret, item: 'pass', country: 'AR', method: 'mp' })).code, 409, 'no se compra dos veces');
});

test('pagos: dLocal Go cobra en moneda local y entrega el pack completo', async () => {
  let created;
  const fake = async (url, opt) => {
    if (url.endsWith('/v1/payments') && opt.method === 'POST') {
      created = JSON.parse(opt.body);
      assert.equal(opt.headers.Authorization, 'Bearer key:sec');
      return { ok: true, json: async () => ({ id: 'DP-1', redirect_url: 'https://dlocal/pagar' }) };
    }
    if (url.endsWith('/v1/payments/DP-1')) return { ok: true, json: async () => ({ id: 'DP-1', status: 'PAID', order_id: created.order_id, amount: created.amount, currency: created.currency }) };
    return { ok: false, json: async () => ({}) };
  };
  const { call } = client({ DLOCAL_API_KEY: 'key', DLOCAL_SECRET_KEY: 'sec', PUBLIC_URL: 'https://juego.com' }, fake);
  const r = (await call('POST', '/api/register', { email: 'br@x.com', password: '12345678' })).json;
  assert.equal((await call('POST', '/api/pay/checkout', { id: r.id, secret: r.secret, item: 'pack-mitico', country: 'US', method: 'dlocal' })).code, 502, 'dLocal no opera en EE. UU.');
  const co = (await call('POST', '/api/pay/checkout', { id: r.id, secret: r.secret, item: 'pack-mitico', country: 'BR', method: 'dlocal' })).json;
  assert.equal(co.url, 'https://dlocal/pagar');
  assert.equal(created.currency, 'BRL');
  assert.equal(created.country, 'BR');
  assert.equal(created.amount, 18.9);
  await call('POST', '/api/pay/dlocal', { payment_id: 'DP-1' });
  const ent = (await call('POST', '/api/me', { id: r.id, secret: r.secret })).json.ent;
  assert.ok(ent.items.dragon_estelar && ent.items.quasar && ent.items.gusano, 'el pack entrega todo lo que incluye');
  assert.equal((await call('POST', '/api/pay/checkout', { id: r.id, secret: r.secret, item: 'pack-todo', country: 'BR', method: 'dlocal' })).code, 409, 'packs con algo ya comprado no se venden');
});

test('pagos: PayPal captura al volver y el Pack de Inicio da destellos una sola vez', async () => {
  let order;
  const fake = async (url, opt) => {
    if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'T' }) };
    if (url.endsWith('/v2/checkout/orders')) { order = JSON.parse(opt.body); return { ok: true, json: async () => ({ id: 'PP1', links: [{ rel: 'payer-action', href: 'https://paypal/aprobar' }] }) }; }
    if (url.endsWith('/v2/checkout/orders/PP1/capture')) {
      const a = order.purchase_units[0].amount;
      return { ok: true, json: async () => ({ status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ status: 'COMPLETED', amount: { currency_code: a.currency_code, value: a.value } }] } }] }) };
    }
    return { ok: false, json: async () => ({}) };
  };
  const { call } = client({ PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 's', PUBLIC_URL: 'https://juego.com' }, fake);
  const r = (await call('POST', '/api/register', { email: 'us@x.com', password: '12345678' })).json;
  const co = (await call('POST', '/api/pay/checkout', { id: r.id, secret: r.secret, item: 'pack-inicio', country: 'AR', method: 'paypal' })).json;
  assert.equal(co.url, 'https://paypal/aprobar');
  assert.deepEqual(order.purchase_units[0].amount, { currency_code: 'USD', value: '0.99' }, 'PayPal cobra en dólares fuera de la zona euro');
  const back = await call('GET', '/api/pay/paypal?o=' + co.order);
  assert.equal(back.code, 302);
  await call('GET', '/api/pay/paypal?o=' + co.order);
  const ent = (await call('POST', '/api/me', { id: r.id, secret: r.secret })).json.ent;
  assert.equal(ent.coins, 1500, 'los destellos del pack se entregan una sola vez');
  assert.ok(ent.items.pionera && ent.items.estela_pionera);
  assert.equal((await call('POST', '/api/pay/checkout', { id: r.id, secret: r.secret, item: 'pack-inicio', country: 'AR', method: 'paypal' })).code, 409, 'el Pack de Inicio es de una sola vez');
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
