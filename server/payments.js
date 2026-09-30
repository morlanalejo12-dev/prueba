// Pagos: Mercado Pago (Argentina), dLocal Go (Latinoamérica, moneda local) y PayPal (todo el mundo).
// Cada uno se enciende con sus credenciales. El precio lo calcula el servidor (src/game/prices.js) y
// cada pago se verifica consultando al proveedor antes de entregar la compra: no se puede falsificar.
import crypto from 'node:crypto';
import { catalog, methodsFor, CURRENCIES } from '../src/game/prices.js';

const MP = 'https://api.mercadopago.com';

export function paymentsConfig(env = process.env) {
  const publicUrl = (env.PUBLIC_URL || '').replace(/\/$/, '');
  const fx = {};
  for (const cur of Object.keys(CURRENCIES)) if (Number(env['FX_' + cur]) > 0) fx[cur] = Number(env['FX_' + cur]);
  // Compatibilidad con la v1.0: MP_USD_RATE = pesos por dólar
  if (!fx.ARS && Number(env.MP_USD_RATE) > 1) fx.ARS = Number(env.MP_USD_RATE);
  const cfg = {
    publicUrl, fx,
    mp: !!(env.MP_ACCESS_TOKEN && publicUrl), mpToken: env.MP_ACCESS_TOKEN,
    dlocal: !!(env.DLOCAL_API_KEY && env.DLOCAL_SECRET_KEY && publicUrl), dlocalKey: env.DLOCAL_API_KEY, dlocalSecret: env.DLOCAL_SECRET_KEY,
    dlocalUrl: env.DLOCAL_SANDBOX === '1' ? 'https://api-sbx.dlocalgo.com' : 'https://api.dlocalgo.com',
    paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET && publicUrl), paypalId: env.PAYPAL_CLIENT_ID, paypalSecret: env.PAYPAL_SECRET,
    paypalUrl: env.PAYPAL_SANDBOX === '1' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com',
  };
  cfg.on = cfg.mp || cfg.dlocal || cfg.paypal;
  cfg.enabled = { mp: cfg.mp, dlocal: cfg.dlocal, paypal: cfg.paypal };
  return cfg;
}

const money = (p) => (CURRENCIES[p.cur] && CURRENCIES[p.cur].dec === 0 ? Math.round(p.amount) : Math.round(p.amount * 100) / 100);
const okAmount = (paid, order) => Number(paid) + 0.01 >= order.amount;

// Crea la orden y devuelve la dirección de pago del proveedor
export async function createCheckout({ accountId, item, country, method }, cfg, store, fetchImpl = fetch) {
  const it = catalog()[item];
  if (!it) return { error: 'Ese artículo no está a la venta.' };
  const m = methodsFor(item, country, cfg.enabled, cfg.fx).find(x => x.id === method);
  if (!m) return { error: 'Ese medio de pago no está disponible en tu país.' };
  const orderId = crypto.randomBytes(12).toString('hex');
  const order = { acct: accountId, item, method, country, amount: money(m.price), cur: m.price.cur, status: 'pending', at: Date.now() };
  const back = s => `${cfg.publicUrl}/?pago=${s}`;
  let url = null, ref = null;
  try {
    if (method === 'mp') {
      const r = await fetchImpl(`${MP}/checkout/preferences`, {
        method: 'POST', headers: { Authorization: `Bearer ${cfg.mpToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: item, title: `${it.title} · Contracorriente`, quantity: 1, currency_id: order.cur, unit_price: order.amount }],
          external_reference: orderId, notification_url: `${cfg.publicUrl}/api/pay/webhook`,
          back_urls: { success: back('ok'), failure: back('error'), pending: back('pendiente') }, auto_return: 'approved', statement_descriptor: 'CONTRACORRIENTE',
        }),
      });
      const j = await r.json().catch(() => ({}));
      url = r.ok && j.init_point; ref = j.id;
    } else if (method === 'dlocal') {
      const r = await fetchImpl(`${cfg.dlocalUrl}/v1/payments`, {
        method: 'POST', headers: { Authorization: `Bearer ${cfg.dlocalKey}:${cfg.dlocalSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.amount, currency: order.cur, country, order_id: orderId, description: `${it.title} · Contracorriente`,
          success_url: back('ok'), back_url: back('error'), notification_url: `${cfg.publicUrl}/api/pay/dlocal`,
        }),
      });
      const j = await r.json().catch(() => ({}));
      url = r.ok && j.redirect_url; ref = j.id;
    } else if (method === 'paypal') {
      const token = await paypalToken(cfg, fetchImpl);
      if (token) {
        const r = await fetchImpl(`${cfg.paypalUrl}/v2/checkout/orders`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': orderId },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{ reference_id: item, custom_id: orderId, description: `${it.title} · Contracorriente`, amount: { currency_code: order.cur, value: order.amount.toFixed(2) } }],
            payment_source: { paypal: { experience_context: { brand_name: 'Contracorriente', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: `${cfg.publicUrl}/api/pay/paypal?o=${orderId}`, cancel_url: back('error') } } },
          }),
        });
        const j = await r.json().catch(() => ({}));
        const link = (j.links || []).find(l => l.rel === 'payer-action' || l.rel === 'approve');
        url = r.ok && link && link.href; ref = j.id;
      }
    }
  } catch (e) { url = null; }
  if (!url) return { error: 'No se pudo iniciar el pago. Probá de nuevo o elegí otro medio.' };
  order.ref = ref || null;
  await store.set('order', orderId, order);
  return { url, order: orderId };
}

async function paypalToken(cfg, fetchImpl) {
  const r = await fetchImpl(`${cfg.paypalUrl}/v1/oauth2/token`, {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.paypalId}:${cfg.paypalSecret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = r.ok ? await r.json().catch(() => null) : null;
  return j && j.access_token;
}

// ---------- Verificación (cada una devuelve el id de la orden pagada, o null) ----------
export async function verifyMp(paymentId, cfg, store, fetchImpl = fetch) {
  if (!cfg.mp || !/^\d+$/.test(String(paymentId || ''))) return null;
  const r = await fetchImpl(`${MP}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${cfg.mpToken}` } });
  const p = r.ok ? await r.json() : null;
  if (!p || p.status !== 'approved') return null;
  const order = await store.get('order', String(p.external_reference || ''));
  if (!order || order.method !== 'mp' || p.currency_id !== order.cur || !okAmount(p.transaction_amount, order)) return null;
  return String(p.external_reference);
}

export async function verifyDlocal(paymentId, cfg, store, fetchImpl = fetch) {
  if (!cfg.dlocal || !/^[\w-]{4,80}$/.test(String(paymentId || ''))) return null;
  const r = await fetchImpl(`${cfg.dlocalUrl}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${cfg.dlocalKey}:${cfg.dlocalSecret}` } });
  const p = r.ok ? await r.json() : null;
  if (!p || p.status !== 'PAID') return null;
  const order = await store.get('order', String(p.order_id || ''));
  if (!order || order.method !== 'dlocal' || p.currency !== order.cur || !okAmount(p.amount, order)) return null;
  return String(p.order_id);
}

// PayPal: al volver del pago se captura la orden (recién ahí se cobra)
export async function capturePaypal(orderId, cfg, store, fetchImpl = fetch) {
  const order = await store.get('order', String(orderId || ''));
  if (!cfg.paypal || !order || order.method !== 'paypal' || !order.ref) return null;
  if (order.status === 'paid') return orderId;
  const token = await paypalToken(cfg, fetchImpl);
  if (!token) return null;
  const r = await fetchImpl(`${cfg.paypalUrl}/v2/checkout/orders/${encodeURIComponent(order.ref)}/capture`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': 'cap-' + orderId },
  });
  const j = await r.json().catch(() => ({}));
  const cap = j && j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments && j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
  if (!cap || j.status !== 'COMPLETED' || cap.status !== 'COMPLETED' || cap.amount.currency_code !== order.cur || !okAmount(cap.amount.value, order)) return null;
  return orderId;
}
