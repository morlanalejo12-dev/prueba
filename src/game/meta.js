// Sistemas de retorno: misiones diarias, recompensa por día jugado, tienda rotativa y pase de temporada.
// Todo es determinista por fecha, así dos jugadores ven las mismas misiones y ofertas el mismo día.
import { fmt } from '../util/math.js';
import { SKINS, TRAILS, SHOP_SKINS, SHOP_TRAILS } from './skins.js';

export const SEASON = { number: 1, name: 'Primera corriente', maxLevel: 20 };

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

// ---------- Misiones diarias ----------
export const MISSION_POOL = [
  { id: 'orbs', text: n => `Juntá ${n} chispas`, targets: [25, 40], stat: s => s.orbs, reward: 80 },
  { id: 'forks', text: n => `Sobreviví a ${n} bifurcaciones`, targets: [4, 7], stat: s => s.forksOk, reward: 100 },
  { id: 'near', text: n => `Hacé ${n} pasadas justas`, targets: [4, 8], stat: s => s.near, reward: 90 },
  { id: 'rounds', text: n => `Jugá ${n} rondas`, targets: [3, 5], stat: () => 1, reward: 70 },
  { id: 'rival', text: n => `Ganale a tu rival ${n} ${n === 1 ? 'vez' : 'veces'}`, targets: [1, 2], stat: s => (s.beatRival ? 1 : 0), reward: 90 },
  { id: 'top', text: n => `Superá al ${n}% en una ronda`, targets: [75, 90], single: true, stat: (s, n) => (s.pct >= n ? 1 : 0), reward: 120 },
  { id: 'score', text: n => `Hacé ${fmt(n)} puntos en una ronda`, targets: [900, 1400], single: true, stat: (s, n) => (s.score >= n ? 1 : 0), reward: 120 },
  { id: 'gold', text: () => 'Sobreviví en un camino dorado', targets: [1], single: true, stat: s => (s.feats.gold ? 1 : 0), reward: 110 },
];
export const MISSION_XP = 40;

export function dailyMissions(day) {
  const h = hashStr('mis' + day);
  const idx = [];
  for (let k = 0; idx.length < 3; k++) {
    const i = (h + k * 7 + (k * k * 3)) % MISSION_POOL.length;
    if (!idx.includes(i)) idx.push(i);
  }
  return idx.map((i, k) => {
    const m = MISSION_POOL[i];
    const n = m.targets[(h >>> (k * 3)) % m.targets.length];
    return { id: m.id, n, goal: m.single ? 1 : n, progress: 0, claimed: false };
  });
}

export function missionText(m) { return MISSION_POOL.find(p => p.id === m.id).text(m.n); }
export function missionReward(m) { return MISSION_POOL.find(p => p.id === m.id).reward; }

export function ensureMissions(save, day) {
  if (!save.missions || save.missions.day !== day) save.missions = { day, list: dailyMissions(day) };
  return save.missions.list;
}

// Suma el resultado de una ronda. Devuelve las misiones que se completaron ahora.
export function progressMissions(save, sum, day) {
  const done = [];
  for (const m of ensureMissions(save, day)) {
    if (m.claimed || m.progress >= m.goal) continue;
    const t = MISSION_POOL.find(p => p.id === m.id);
    m.progress = Math.min(m.goal, m.progress + t.stat(sum, m.n));
    if (m.progress >= m.goal) done.push(m);
  }
  return done;
}

export const claimableMissions = save => (save.missions ? save.missions.list.filter(m => !m.claimed && m.progress >= m.goal).length : 0);

// ---------- Recompensa diaria (7 días; si te salteás uno, vuelve al día 1) ----------
export const DAILY_REWARDS = [50, 75, 100, 125, 150, 200, 'aurora'];

export function dailyState(save, today, yesterday) {
  const d = save.daily;
  const available = d.last !== today;
  const index = d.last === yesterday || d.last === today ? d.next : 0;
  return { available, index: available ? index : (d.next + 6) % 7 };
}

export function claimDaily(save, today, yesterday) {
  const st = dailyState(save, today, yesterday);
  if (!st.available) return null;
  const reward = DAILY_REWARDS[st.index];
  let coins = 0, skin = null;
  if (typeof reward === 'number') coins = reward;
  else if (save.owned[reward]) coins = 400;
  else { save.owned[reward] = true; skin = reward; }
  save.coins += coins;
  save.daily = { last: today, next: (st.index + 1) % 7 };
  return { index: st.index, coins, skin };
}

// ---------- Tienda rotativa: 2 skins y 2 estelas por día, una en oferta ----------
function pick(pool, h, n) {
  // Recorre el catálogo con un paso lineal; el límite evita bucles si el catálogo es chico
  const out = [];
  for (let k = 0; out.length < n && k < pool.length * 4; k++) {
    const it = pool[(h + k) % pool.length];
    if (!out.includes(it)) out.push(it);
  }
  return out;
}

export function shopOffers(day) {
  const h = hashStr('shop' + day);
  const items = [
    ...pick(SHOP_SKINS, h % 997, 2).map(item => ({ kind: 'skin', item })),
    ...pick(SHOP_TRAILS, (h >>> 9) % 997, 2).map(item => ({ kind: 'trail', item })),
  ];
  const saleIdx = h % items.length;
  return items.map(({ kind, item }, i) => {
    const full = item.src.price;
    const price = i === saleIdx ? Math.round(full * 0.75 / 10) * 10 : full;
    return { id: item.id, kind, price, sale: i === saleIdx, full };
  });
}

export function buySkin(save, offer) {
  if (save.owned[offer.id] || save.coins < offer.price) return false;
  save.coins -= offer.price;
  save.owned[offer.id] = true;
  return true;
}

// ---------- Pase de temporada (gratis, se avanza subiendo de nivel) ----------
export function seasonTrack() {
  const out = [];
  for (let lvl = 2; lvl <= SEASON.maxLevel; lvl++) {
    const sk = SKINS.find(k => k.src.type === 'level' && k.src.lvl === lvl);
    const tr = TRAILS.find(k => k.src.type === 'level' && k.src.lvl === lvl);
    if (sk) out.push({ lvl, type: 'skin', skin: sk.id });
    else if (tr) out.push({ lvl, type: 'trail', trail: tr.id });
    else out.push({ lvl, type: 'coins', coins: 40 + lvl * 10 });
  }
  return out;
}

// Destellos que dan los niveles del pase entre dos niveles (excluye el inicial)
export function seasonCoins(fromLevel, toLevel) {
  return seasonTrack().filter(r => r.type === 'coins' && r.lvl > fromLevel && r.lvl <= toLevel)
    .reduce((a, r) => a + r.coins, 0);
}

export function msToMidnight(now = new Date()) {
  const m = new Date(now); m.setHours(24, 0, 0, 0);
  return m - now;
}
