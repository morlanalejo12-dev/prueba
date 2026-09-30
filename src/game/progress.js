// Progreso del jugador: niveles, títulos, logros, récords, racha, rango, destellos y colección.
// Funciones puras sobre un objeto `save`; el almacenamiento se inyecta para poder testearlo.
import { SKINS, TRAILS, isOwned } from './skins.js';
import { rankOf, prDelta, applyPR, TIER_PERKS } from './ranks.js';
import { progressMissions, seasonCoins, ensureMissions, MISSION_XP, missionReward } from './meta.js';

export const SAVE_KEY = 'cc-save-v3';
const LEGACY_KEY = 'cc-stats';

const DEFAULTS = {
  v: 4, rounds: 0, best: 0, bestScore: 0, outliers: 0, xp: 0, skin: 'ambar',
  sfx: true, music: true, vib: true, streak: 0, lastDay: '', ach: {}, records: [],
  // v0.4
  coins: 0, pr: 0, peakPR: 0, owned: {}, missions: null, daily: { last: '', next: 0 }, trail: 'basica',
  forksSeen: 0, forksWon: 0, pathStreak: 0, bestPathStreak: 0, rivalsBeaten: 0, shopSeen: '',
};

export { SKINS, TRAILS };

export const TITLES = [
  { lvl: 1, name: 'Chispa' },
  { lvl: 3, name: 'Destello' },
  { lvl: 5, name: 'Corriente' },
  { lvl: 8, name: 'Contracorriente' },
  { lvl: 12, name: 'Outlier' },
];

export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primera caída', desc: 'Jugá tu primera ronda.', test: () => true },
  { id: 'fork1', name: 'A contracorriente', desc: 'Sobreviví a una bifurcación.', test: s => s.forksOk >= 1 },
  { id: 'fork3', name: 'Mitad del camino', desc: 'Sobreviví a 3 bifurcaciones en una ronda.', test: s => s.forksOk >= 3 },
  { id: 'final', name: 'Hasta el final', desc: 'Llegá con vida al final de una ronda.', test: s => s.alive },
  { id: 'outlier', name: 'Outlier del minuto', desc: 'Sé el último en pie.', test: s => s.outlier },
  { id: 'top10', name: 'Top 10', desc: 'Terminá entre los 10 primeros.', test: s => s.rank <= 10 },
  { id: 'near5', name: 'Al filo', desc: 'Hacé 5 pasadas justas en una ronda.', test: s => s.near >= 5 },
  { id: 'combo3', name: 'En racha', desc: 'Encadená 3 pasadas justas seguidas.', test: s => s.maxCombo >= 3 },
  { id: 'orbs15', name: 'Coleccionista', desc: 'Juntá 15 chispas en una ronda.', test: s => s.orbs >= 15 },
  { id: 'gold', name: 'Fiebre del oro', desc: 'Sobreviví eligiendo un camino dorado.', test: s => s.feats.gold },
  { id: 'fog', name: 'A ciegas', desc: 'Sobreviví a una bifurcación con niebla.', test: s => s.feats.fog },
  { id: 'invert', name: 'Leíste la trampa', desc: 'Sobreviví a una inversión.', test: s => s.feats.invert },
  { id: 'streak3', name: 'Constante', desc: 'Jugá 3 días seguidos.', test: (s, save) => save.streak >= 3 },
  { id: 'veteran', name: 'Veterano', desc: 'Jugá 25 rondas.', test: (s, save) => save.rounds >= 25 },
  { id: 'path10', name: 'Imparable', desc: 'Sobreviví a 10 bifurcaciones seguidas, aunque sea entre rondas.', test: (s, save) => save.bestPathStreak >= 10 },
  { id: 'rival5', name: 'Némesis', desc: 'Ganale a 5 rivales.', test: (s, save) => save.rivalsBeaten >= 5 },
  { id: 'gold_rank', name: 'Liga de Oro', desc: 'Llegá a la liga Oro.', test: (s, save) => rankOf(save.peakPR).tier >= 2 },
  { id: 'dash_save', name: 'Último segundo', desc: 'Sobreviví a una bifurcación después de usar un impulso.', test: s => !!(s.feats && s.feats.dashSave) },
  { id: 'oracle', name: 'Oráculo', desc: 'Acertá 3 predicciones mientras mirás una ronda.', test: s => (s.predHits || 0) >= 3 },
];

// ---------- Niveles ----------
export const levelNeed = n => 120 + (n - 1) * 60; // XP para pasar del nivel n al siguiente

export function levelInfo(xp) {
  let level = 1, need = levelNeed(1);
  while (xp >= need) { xp -= need; level++; need = levelNeed(level); }
  return { level, into: xp, need };
}

export function titleOf(level) {
  let t = TITLES[0].name;
  for (const x of TITLES) if (level >= x.lvl) t = x.name;
  return t;
}

export const xpForRound = s => Math.round(s.score / 10) + s.forksOk * 15 + (s.outlier ? 150 : 0) + (s.alive ? 50 : 0);
export const coinsForRound = (s, tier = 0) =>
  Math.round((s.score / 40 + s.forksOk * 4 + (s.outlier ? 60 : 0) + (s.beatRival ? 10 : 0)) * (1 + TIER_PERKS[tier].coinBonus));

// Porcentaje histórico de bifurcaciones superadas
export const instinct = save => (save.forksSeen ? Math.round(save.forksWon / save.forksSeen * 100) : 0);

// ---------- Colección ----------
export function ownedCtx(save) {
  return { level: levelInfo(save.xp).level, peakTier: rankOf(save.peakPR).tier, ach: save.ach, owned: save.owned };
}
export const ownedSkins = save => { const ctx = ownedCtx(save); return SKINS.filter(k => isOwned(k, ctx)); };
export const ownedTrails = save => { const ctx = ownedCtx(save); return TRAILS.filter(k => isOwned(k, ctx)); };

// ---------- Fechas ----------
const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const yesterdayOf = d => { const y = new Date(d); y.setDate(y.getDate() - 1); return y; };

export function streakNow(save, now = new Date()) {
  const ok = save.lastDay === dayKey(now) || save.lastDay === dayKey(yesterdayOf(now));
  return ok ? save.streak : 0;
}

// ---------- Guardado ----------
export function localStore() {
  return {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  };
}

function parse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}

export function loadSave(store) {
  let data = parse(store.get(SAVE_KEY));
  if (!data) {
    const old = parse(store.get(LEGACY_KEY)); // guardado de la v0.2
    if (old) {
      data = {
        rounds: old.rounds, best: old.best, outliers: old.outliers, xp: old.xp, skin: old.skin,
        sfx: old.muted === undefined ? true : !old.muted, vib: old.vib, streak: old.streak, lastDay: old.lastDay,
      };
    }
  }
  const save = { ...DEFAULTS, ...(data || {}) };
  for (const k of ['rounds', 'best', 'bestScore', 'outliers', 'xp', 'streak', 'coins', 'pr', 'peakPR',
    'forksSeen', 'forksWon', 'pathStreak', 'bestPathStreak', 'rivalsBeaten']) {
    if (typeof save[k] !== 'number' || !isFinite(save[k])) save[k] = DEFAULTS[k];
  }
  for (const k of ['ach', 'owned']) if (!save[k] || typeof save[k] !== 'object') save[k] = {};
  if (!save.daily || typeof save.daily !== 'object') save.daily = { last: '', next: 0 };
  if (!Array.isArray(save.records)) save.records = [];
  if (!SKINS.some(k => k.id === save.skin)) save.skin = DEFAULTS.skin;
  if (!TRAILS.some(k => k.id === save.trail)) save.trail = DEFAULTS.trail;
  save.v = 4;
  return save;
}

export function writeSave(store, save) {
  store.set(SAVE_KEY, JSON.stringify(save));
}

export function resetSave(store) {
  const fresh = { ...DEFAULTS, ach: {}, records: [], owned: {}, daily: { last: '', next: 0 } };
  writeSave(store, fresh);
  return fresh;
}

// Suma XP y aplica las recompensas del pase por los niveles ganados
function addXP(save, xp) {
  const before = levelInfo(save.xp);
  save.xp += xp;
  const after = levelInfo(save.xp);
  save.coins += seasonCoins(before.level, after.level);
  return { before, after };
}

export function claimMission(save, index) {
  const m = save.missions && save.missions.list[index];
  if (!m || m.claimed || m.progress < m.goal) return null;
  m.claimed = true;
  const coins = missionReward(m);
  save.coins += coins;
  const lv = addXP(save, MISSION_XP);
  return { coins, xp: MISSION_XP, ...lv };
}

// ---------- Aplicar el resultado de una ronda ----------
export function applyRound(save, sum, now = new Date()) {
  const ownedBefore = new Set([...ownedSkins(save), ...ownedTrails(save)].map(k => k.id));
  const prevBest = save.best, first = save.rounds === 0;
  save.rounds++;
  save.best = Math.max(save.best, sum.pct);
  if (sum.outlier) save.outliers++;
  if (sum.beatRival) save.rivalsBeaten++;

  const today = dayKey(now);
  if (save.lastDay !== today) {
    save.streak = save.lastDay === dayKey(yesterdayOf(now)) ? save.streak + 1 : 1;
    save.lastDay = today;
  }

  // Racha de caminos: cuenta bifurcaciones superadas seguidas, aunque sea entre rondas
  save.forksSeen += sum.forksSeen;
  save.forksWon += sum.forksOk;
  save.pathStreak += sum.forksOk;
  save.bestPathStreak = Math.max(save.bestPathStreak, save.pathStreak);
  if (sum.forksSeen > sum.forksOk) save.pathStreak = 0; // caer en una bifurcación corta la racha (un muro no)

  // Rango
  const rankBefore = rankOf(save.pr);
  const delta = prDelta(sum);
  const prBefore = save.pr;
  save.pr = applyPR(save.pr, delta);
  save.peakPR = Math.max(save.peakPR, save.pr);
  const rankAfter = rankOf(save.pr);

  // XP, destellos y misiones
  const gain = xpForRound(sum);
  const predCoins = sum.predCoins || 0;
  const coins = coinsForRound(sum, rankBefore.tier) + predCoins;
  save.coins += coins;
  const lv = addXP(save, gain);
  const missionsDone = progressMissions(save, sum, today);
  ensureMissions(save, today);

  const newAch = ACHIEVEMENTS.filter(a => !save.ach[a.id] && a.test(sum, save));
  for (const a of newAch) save.ach[a.id] = today;

  const rec = { score: sum.score, rank: sum.rank, total: sum.total, pct: sum.pct, day: today };
  save.records.push(rec);
  save.records.sort((a, b) => b.score - a.score);
  save.records = save.records.slice(0, 5);
  const recordPos = save.records.indexOf(rec) + 1;
  save.bestScore = Math.max(save.bestScore, sum.score);

  const newSkins = ownedSkins(save).filter(k => !ownedBefore.has(k.id));
  const newTrails = ownedTrails(save).filter(k => !ownedBefore.has(k.id));
  const promoted = rankAfter.tier > rankBefore.tier || (rankAfter.tier === rankBefore.tier && rankAfter.div < rankBefore.div);

  return {
    gain, coins, predCoins, before: lv.before, after: lv.after, newAch, newSkins, newTrails, missionsDone,
    recordPos, recordCount: save.records.length, newBestPct: !first && sum.pct > prevBest,
    pr: { before: prBefore, after: save.pr, delta: save.pr - prBefore, raw: delta, rankBefore, rankAfter, promoted },
    pathStreak: save.pathStreak,
    missions: save.missions.list,
  };
}
