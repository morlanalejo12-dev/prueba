// Precios por país: cada artículo tiene un precio base en dólares y se muestra en la moneda local,
// ajustado al poder de compra de cada país (como hacen Steam o las tiendas de apps) y redondeado a
// precios "lindos" ($ 2.899, R$ 12,90, $ 49). El servidor usa este mismo archivo para cobrar.
import { SKINS, TRAILS } from './skins.js';
import { NAME_STYLES } from './names.js';
import { PASS_PRICE_USD } from './pass.js';

// País → moneda, idioma sugerido y ajuste de precio (ppp: 1 = precio de EE. UU.)
export const COUNTRIES = [
  { id: 'AR', name: 'Argentina', flag: '🇦🇷', cur: 'ARS', lang: 'es', ppp: 0.5 },
  { id: 'BO', name: 'Bolivia', flag: '🇧🇴', cur: 'BOB', lang: 'es', ppp: 0.5 },
  { id: 'BR', name: 'Brasil', flag: '🇧🇷', cur: 'BRL', lang: 'pt', ppp: 0.6 },
  { id: 'CL', name: 'Chile', flag: '🇨🇱', cur: 'CLP', lang: 'es', ppp: 0.7 },
  { id: 'CO', name: 'Colombia', flag: '🇨🇴', cur: 'COP', lang: 'es', ppp: 0.55 },
  { id: 'CR', name: 'Costa Rica', flag: '🇨🇷', cur: 'CRC', lang: 'es', ppp: 0.8 },
  { id: 'EC', name: 'Ecuador', flag: '🇪🇨', cur: 'USD', lang: 'es', ppp: 0.8 },
  { id: 'SV', name: 'El Salvador', flag: '🇸🇻', cur: 'USD', lang: 'es', ppp: 0.8 },
  { id: 'ES', name: 'España', flag: '🇪🇸', cur: 'EUR', lang: 'es', ppp: 1 },
  { id: 'US', name: 'Estados Unidos', flag: '🇺🇸', cur: 'USD', lang: 'en', ppp: 1 },
  { id: 'GT', name: 'Guatemala', flag: '🇬🇹', cur: 'GTQ', lang: 'es', ppp: 0.7 },
  { id: 'MX', name: 'México', flag: '🇲🇽', cur: 'MXN', lang: 'es', ppp: 0.7 },
  { id: 'PA', name: 'Panamá', flag: '🇵🇦', cur: 'USD', lang: 'es', ppp: 0.8 },
  { id: 'PY', name: 'Paraguay', flag: '🇵🇾', cur: 'PYG', lang: 'es', ppp: 0.55 },
  { id: 'PE', name: 'Perú', flag: '🇵🇪', cur: 'PEN', lang: 'es', ppp: 0.6 },
  { id: 'PT', name: 'Portugal', flag: '🇵🇹', cur: 'EUR', lang: 'pt', ppp: 0.9 },
  { id: 'DO', name: 'República Dominicana', flag: '🇩🇴', cur: 'USD', lang: 'es', ppp: 0.8 },
  { id: 'UY', name: 'Uruguay', flag: '🇺🇾', cur: 'UYU', lang: 'es', ppp: 0.75 },
  { id: 'VE', name: 'Venezuela', flag: '🇻🇪', cur: 'USD', lang: 'es', ppp: 0.6 },
  { id: 'XX', name: 'Otro país', flag: '🌎', cur: 'USD', lang: 'en', ppp: 1 },
];

// Moneda → cuántas unidades por dólar (valores de referencia: el servidor los puede actualizar con
// variables FX_ARS, FX_BRL, etc.) y forma de redondear
export const CURRENCIES = {
  USD: { fx: 1, nice: 'dec99', dec: 2 },
  EUR: { fx: 0.88, nice: 'dec99', dec: 2 },
  ARS: { fx: 1450, nice: 'int99', dec: 0 },
  BOB: { fx: 6.96, nice: 'dec90', dec: 2 },
  BRL: { fx: 5.4, nice: 'dec90', dec: 2 },
  CLP: { fx: 940, nice: 'int90', dec: 0 },
  COP: { fx: 4000, nice: 'int900', dec: 0 },
  CRC: { fx: 505, nice: 'int90', dec: 0 },
  GTQ: { fx: 7.7, nice: 'dec99', dec: 2 },
  MXN: { fx: 18.5, nice: 'int9', dec: 0 },
  PEN: { fx: 3.7, nice: 'dec90', dec: 2 },
  PYG: { fx: 7600, nice: 'int900', dec: 0 },
  UYU: { fx: 40, nice: 'int9', dec: 0 },
};

export const LANGS = [
  { id: 'es', name: 'Español' },
  { id: 'pt', name: 'Português' },
  { id: 'en', name: 'English' },
];

export const countryById = id => COUNTRIES.find(c => c.id === id) || COUNTRIES[COUNTRIES.length - 1];

// Adivina el país por la zona horaria y el idioma del navegador (el jugador lo puede cambiar)
const TZ = {
  'America/Argentina': 'AR', 'America/Buenos_Aires': 'AR', 'America/Cordoba': 'AR', 'America/Mendoza': 'AR', 'America/La_Paz': 'BO',
  'America/Sao_Paulo': 'BR', 'America/Bahia': 'BR', 'America/Fortaleza': 'BR', 'America/Recife': 'BR', 'America/Manaus': 'BR', 'America/Belem': 'BR', 'America/Cuiaba': 'BR', 'America/Porto_Velho': 'BR', 'America/Campo_Grande': 'BR', 'America/Maceio': 'BR', 'America/Araguaina': 'BR', 'America/Noronha': 'BR', 'America/Rio_Branco': 'BR', 'America/Boa_Vista': 'BR', 'America/Santarem': 'BR',
  'America/Santiago': 'CL', 'Pacific/Easter': 'CL', 'America/Punta_Arenas': 'CL', 'America/Bogota': 'CO', 'America/Costa_Rica': 'CR', 'America/Guayaquil': 'EC', 'Pacific/Galapagos': 'EC',
  'America/El_Salvador': 'SV', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES', 'Africa/Ceuta': 'ES', 'America/Guatemala': 'GT', 'America/Panama': 'PA', 'America/Asuncion': 'PY', 'America/Lima': 'PE',
  'Europe/Lisbon': 'PT', 'Atlantic/Azores': 'PT', 'Atlantic/Madeira': 'PT', 'America/Santo_Domingo': 'DO', 'America/Montevideo': 'UY', 'America/Caracas': 'VE',
  'America/Mexico_City': 'MX', 'America/Monterrey': 'MX', 'America/Tijuana': 'MX', 'America/Cancun': 'MX', 'America/Merida': 'MX', 'America/Chihuahua': 'MX', 'America/Hermosillo': 'MX', 'America/Mazatlan': 'MX', 'America/Matamoros': 'MX', 'America/Bahia_Banderas': 'MX',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Detroit': 'US',
};
export function guessCountry() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* sin Intl */ }
  const hit = TZ[tz] || Object.entries(TZ).find(([k]) => tz.startsWith(k + '/'))?.[1];
  if (hit) return hit;
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  const reg = (nav.split('-')[1] || '').toUpperCase();
  if (COUNTRIES.some(c => c.id === reg)) return reg;
  return nav.startsWith('pt') ? 'BR' : nav.startsWith('es') ? 'AR' : 'XX';
}
export function guessLang(country) {
  const nav = typeof navigator !== 'undefined' ? (navigator.language || '').slice(0, 2) : '';
  if (LANGS.some(l => l.id === nav)) return nav;
  return countryById(country).lang;
}

// Redondeo a precios "lindos" según la costumbre de cada moneda
function nice(v, mode) {
  if (mode === 'dec99') return Math.max(0.99, Math.round(v * 2) / 2 - 0.01);
  if (mode === 'dec90') return Math.max(0.9, Math.round(v) - 0.1);
  if (mode === 'int9') return Math.max(9, Math.round(v / 10) * 10 - 1);
  if (mode === 'int99') { const st = v < 1000 ? 10 : 100; return Math.max(st - 1, Math.round(v / st) * st - 1); }
  if (mode === 'int90') { const st = v < 1000 ? 10 : 100; return Math.max(st - 1, Math.round(v / st) * st - (st >= 100 ? 10 : 1)); }
  if (mode === 'int900') return Math.max(900, Math.round(v / 1000) * 1000 - 100);
  return v;
}

// Precio local de un monto base en dólares. fxOver: cotizaciones actualizadas que manda el servidor
export function localPrice(usdBase, countryId, fxOver = {}) {
  const c = countryById(countryId), cur = CURRENCIES[c.cur];
  if (c.cur === 'USD' && c.ppp === 1) return { amount: usdBase, cur: 'USD' };
  const fx = Number(fxOver[c.cur]) || cur.fx;
  const amount = nice(usdBase * fx * c.ppp, cur.nice);
  return { amount: Math.round(amount * 100) / 100, cur: c.cur };
}

const SYMBOL = { USD: 'US$', EUR: '€', ARS: '$', BOB: 'Bs', BRL: 'R$', CLP: '$', COP: '$', CRC: '₡', GTQ: 'Q', MXN: '$', PEN: 'S/', PYG: '₲', UYU: '$' };
export function formatPrice(p, lang = 'es') {
  const dec = CURRENCIES[p.cur] ? CURRENCIES[p.cur].dec : 2;
  const loc = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR';
  let n;
  try { n = new Intl.NumberFormat(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(p.amount); } catch (e) { n = p.amount.toFixed(dec); }
  return `${SYMBOL[p.cur] || p.cur} ${n}`;
}

// ---------- Catálogo ----------
const premium = list => list.filter(k => k.src.type === 'premium');
export const PREMIUM_SKINS = premium(SKINS), PREMIUM_TRAILS = premium(TRAILS), PREMIUM_NAMES = premium(NAME_STYLES);
const ids = list => list.map(k => k.id);
const sum = list => Math.round(list.reduce((a, k) => a + k.src.usd, 0) * 100) / 100;
const byRarity = (list, r) => list.filter(k => k.rarity === r);

// Packs: siempre más baratos que comprar por separado. Se ocultan si ya tenés algo de adentro.
export const PACKS = [
  {
    id: 'pack-inicio', name: 'Pack de Inicio', usd: 0.99, once: true, tag: 'Solo una vez',
    items: ['pionera', 'estela_pionera'], coins: 1500,
    desc: 'Skin y estela legendarias exclusivas + 1.500 destellos',
    // Mismo nivel de rareza en la tienda: una skin legendaria y una estela legendaria
    worth: 1.99 + 1.49,
  },
  {
    id: 'pack-mitico', name: 'Pack Mítico', usd: 5.99, tag: 'Ahorrás',
    items: ids([...byRarity(PREMIUM_SKINS, 'mitica'), ...byRarity(PREMIUM_TRAILS, 'mitica')]),
    desc: 'Todas las skins y estelas Míticas',
  },
  {
    id: 'pack-legendario', name: 'Pack Legendario', usd: 6.99, tag: 'Ahorrás',
    items: ids([...byRarity(PREMIUM_SKINS, 'legendaria'), ...byRarity(PREMIUM_TRAILS, 'legendaria'), ...PREMIUM_NAMES]),
    desc: 'Todas las skins, estelas y estilos de nombre Legendarios',
  },
  {
    id: 'pack-todo', name: 'Colección Completa', usd: 12.99, tag: 'Mejor valor', pass: true,
    items: ids([...PREMIUM_SKINS, ...PREMIUM_TRAILS, ...PREMIUM_NAMES]),
    desc: 'Pase Premium + todos los cosméticos de la Tienda Premium',
  },
];
for (const p of PACKS) if (!p.worth) p.worth = sum(p.items.map(id => [...SKINS, ...TRAILS, ...NAME_STYLES].find(k => k.id === id))) + (p.pass ? PASS_PRICE_USD : 0);
export const packById = id => PACKS.find(p => p.id === id);

// Todo lo que se puede comprar: { id: { title, usd } }
export function catalog() {
  const out = { pass: { title: 'Pase Premium · Temporada 1', usd: PASS_PRICE_USD } };
  for (const k of [...SKINS, ...TRAILS, ...NAME_STYLES]) if (k.src.type === 'premium') out[k.id] = { title: k.name, usd: k.src.usd };
  for (const p of PACKS) out[p.id] = { title: p.name, usd: p.usd };
  return out;
}

// Qué entrega cada compra
export function grantsOf(item) {
  const p = packById(item);
  if (!p) return { pass: item === 'pass', items: item === 'pass' ? [] : [item], coins: 0 };
  return { pass: !!p.pass, items: [...p.items], coins: p.coins || 0 };
}

// ¿Se puede comprar ahora? (packs de una vez y packs con algo ya comprado se ocultan)
export function packAvailable(p, owned, premiumPass, bought = {}) {
  if (p.once && bought[p.id]) return false;
  if (p.items.some(id => owned[id])) return false;
  if (p.pass && premiumPass) return false;
  return true;
}

// ---------- Medios de pago ----------
// Mercado Pago (cuenta argentina: cobra en pesos), dLocal Go (pagos locales en Latinoamérica, en la
// moneda de cada país: tarjetas, Pix, OXXO, PSE, efectivo…) y PayPal (todo el mundo, con o sin cuenta PayPal).
export const DLOCAL_COUNTRIES = ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'EC', 'GT', 'MX', 'PY', 'PE', 'UY'];
export const PAYPAL_CURRENCIES = ['USD', 'EUR'];

// enabled: { mp, dlocal, paypal } según lo que esté configurado en el servidor
export function methodsFor(item, countryId, enabled = {}, fxOver = {}) {
  const it = catalog()[item];
  if (!it) return [];
  const c = countryById(countryId), out = [];
  if (enabled.mp && c.id === 'AR') out.push({ id: 'mp', price: localPrice(it.usd, 'AR', fxOver) });
  if (enabled.dlocal && DLOCAL_COUNTRIES.includes(c.id)) out.push({ id: 'dlocal', price: localPrice(it.usd, c.id, fxOver) });
  if (enabled.paypal) out.push({ id: 'paypal', price: PAYPAL_CURRENCIES.includes(c.cur) ? localPrice(it.usd, c.id, fxOver) : { amount: it.usd, cur: 'USD' } });
  return out;
}
