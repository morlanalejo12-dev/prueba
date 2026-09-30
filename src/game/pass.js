// Pase de temporada: 100 niveles. Del 1 al 20 son gratis; del 21 al 100 son del pase Premium.
// Cada premio se reclama a mano. Los cosméticos salen de los catálogos (src: { type: 'pass', lvl });
// los niveles sin cosmético dan destellos, que suben a medida que avanzás.
import { SKINS, TRAILS } from './skins.js';
import { MUSIC } from './music.js';
import { NAME_STYLES } from './names.js';

export const PASS_LEVELS = 100;
export const PASS_FREE = 20;
export const PASS_STEP = 250;          // XP de temporada por nivel
export const PASS_PRICE_USD = 3.99;

const KINDS = [['skin', SKINS], ['trail', TRAILS], ['music', MUSIC], ['name', NAME_STYLES]];

export const passCoins = lvl => (lvl <= PASS_FREE ? 50 + lvl * 5 : 80 + lvl * 4);

export const PASS = (() => {
  const byLvl = {};
  for (const [kind, list] of KINDS) {
    for (const item of list) if (item.src.type === 'pass') byLvl[item.src.lvl] = { kind, id: item.id, item };
  }
  const out = [];
  for (let lvl = 1; lvl <= PASS_LEVELS; lvl++) {
    out.push({ lvl, premium: lvl > PASS_FREE, reward: byLvl[lvl] || { kind: 'coins', amount: passCoins(lvl) } });
  }
  return out;
})();

export function passInfo(xp) {
  const level = Math.min(PASS_LEVELS, 1 + Math.floor(xp / PASS_STEP));
  const into = level >= PASS_LEVELS ? PASS_STEP : xp - (level - 1) * PASS_STEP;
  return { level, into, need: PASS_STEP, max: level >= PASS_LEVELS };
}

// Premios que ya se pueden reclamar
export function claimablePass(save) {
  const { level } = passInfo(save.passXp || 0);
  return PASS.filter(r => r.lvl <= level && !save.passClaimed[r.lvl] && (!r.premium || save.premiumPass));
}

// Reclamar un nivel. Si ya tenías el cosmético (por ejemplo, de una versión anterior), se cambia por destellos.
export function claimPass(save, lvl) {
  const r = PASS[lvl - 1];
  if (!r || save.passClaimed[lvl]) return null;
  if (lvl > passInfo(save.passXp || 0).level || (r.premium && !save.premiumPass)) return null;
  save.passClaimed[lvl] = true;
  const rw = r.reward;
  if (rw.kind === 'coins') { save.coins += rw.amount; return { kind: 'coins', amount: rw.amount }; }
  if (save.owned[rw.id] || save.ownerAll) { const amount = 150; save.coins += amount; return { kind: 'coins', amount, dup: rw.item }; }
  save.owned[rw.id] = true;
  return { kind: rw.kind, item: rw.item };
}
