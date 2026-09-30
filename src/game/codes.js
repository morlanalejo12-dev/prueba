// Códigos promocionales. Se guardan sólo como hash (cyrb53) para que no aparezcan
// en texto plano al inspeccionar el juego.
import { skinById, trailById } from './skins.js';

export function cyrb53(str, seed = 0x5eed) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const CODES = {
  n1co6pem7o: { kind: 'skin', id: 'singularidad' },
  k0jdfhewdk: { kind: 'trail', id: 'supernova' },
  ozmy39to6l: { kind: 'coins', amount: 250 },
};

export const normalizeCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Devuelve { ok, error?, reward? }. Si sale bien, modifica save (owned / coins / codes).
export function redeemCode(save, input) {
  const code = normalizeCode(input);
  if (code.length < 4) return { ok: false, error: 'Escribí un código.' };
  const h = cyrb53(code);
  const reward = CODES[h];
  if (!reward) return { ok: false, error: 'Código inválido.' };
  if (!save.codes || typeof save.codes !== 'object') save.codes = {};
  if (save.codes[h]) return { ok: false, error: 'Ya canjeaste este código.' };
  save.codes[h] = Date.now();
  if (reward.kind === 'coins') {
    save.coins += reward.amount;
    return { ok: true, reward: { ...reward } };
  }
  const item = reward.kind === 'skin' ? skinById(reward.id) : trailById(reward.id);
  save.owned = { ...save.owned, [item.id]: true };
  if (reward.kind === 'skin') save.skin = item.id; else save.trail = item.id;
  return { ok: true, reward: { ...reward, item } };
}
