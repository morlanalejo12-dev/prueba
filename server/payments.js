// Pagos con Mercado Pago (Checkout Pro). Queda apagado hasta configurar MP_ACCESS_TOKEN y PUBLIC_URL.
// Flujo: el juego pide un checkout → el jugador paga en Mercado Pago → Mercado Pago avisa al webhook →
// el servidor consulta el pago en la API de Mercado Pago (así no se puede falsificar) y entrega la compra.
import { SKINS, TRAILS } from '../src/game/skins.js';
import { NAME_STYLES } from '../src/game/names.js';
import { PASS_PRICE_USD } from '../src/game/pass.js';

const MP = 'https://api.mercadopago.com';

// Catálogo de lo que se vende (precios en dólares, como se muestran en el juego)
export function catalog() {
  const out = { pass: { title: 'Pase Premium · Temporada 1', usd: PASS_PRICE_USD } };
  for (const k of [...SKINS, ...TRAILS, ...NAME_STYLES]) if (k.src.type === 'premium') out[k.id] = { title: `${k.name} (Contracorriente)`, usd: k.src.usd };
  return out;
}

export function paymentsConfig(env = process.env) {
  const on = !!(env.MP_ACCESS_TOKEN && env.PUBLIC_URL);
  return {
    on, token: env.MP_ACCESS_TOKEN, publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),
    currency: env.MP_CURRENCY || 'ARS',
    // Si se cobra en pesos: cuántos pesos por dólar (actualizalo cuando haga falta)
    rate: Number(env.MP_USD_RATE) || 1,
  };
}

export const priceFor = (usd, cfg) => (cfg.currency === 'USD' ? usd : Math.round(usd * cfg.rate));

export async function createCheckout({ accountId, item }, cfg, fetchImpl = fetch) {
  const it = catalog()[item];
  if (!it) return { error: 'Ese artículo no está a la venta.' };
  const body = {
    items: [{ id: item, title: it.title, quantity: 1, currency_id: cfg.currency, unit_price: priceFor(it.usd, cfg) }],
    external_reference: `${accountId}:${item}`,
    notification_url: `${cfg.publicUrl}/api/pay/webhook`,
    back_urls: { success: `${cfg.publicUrl}/?pago=ok`, failure: `${cfg.publicUrl}/?pago=error`, pending: `${cfg.publicUrl}/?pago=pendiente` },
    auto_return: 'approved',
    statement_descriptor: 'CONTRACORRIENTE',
  };
  const r = await fetchImpl(`${MP}/checkout/preferences`, {
    method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.init_point) return { error: 'No se pudo iniciar el pago. Probá de nuevo.' };
  return { url: j.init_point };
}

// Devuelve { accountId, item } si el pago está aprobado
export async function verifyPayment(paymentId, cfg, fetchImpl = fetch) {
  if (!/^\d+$/.test(String(paymentId || ''))) return null;
  const r = await fetchImpl(`${MP}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${cfg.token}` } });
  const p = r.ok ? await r.json() : null;
  if (!p || p.status !== 'approved') return null;
  const [accountId, item] = String(p.external_reference || '').split(':');
  const it = catalog()[item];
  if (!accountId || !it) return null;
  // El monto cobrado tiene que coincidir con el precio (evita pagos manipulados)
  if (Number(p.transaction_amount) + 0.01 < priceFor(it.usd, cfg)) return null;
  return { accountId, item, amount: p.transaction_amount, currency: p.currency_id };
}
