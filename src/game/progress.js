// Progreso del jugador: niveles, títulos, logros, récords, racha, rango, destellos y colección.
// Funciones puras sobre un objeto `save`; el almacenamiento se inyecta para poder testearlo.
import { SKINS, TRAILS, isOwned } from './skins.js';
import { MUSIC } from './music.js';
import { NAME_STYLES } from './names.js';
import { rankOf, prDelta, applyPR, TIER_PERKS, LEGEND_PR } from './ranks.js';
import { progressMissions, ensureMissions, MISSION_XP, missionReward } from './meta.js';
import { passInfo, claimablePass, PASS_STEP, PASS_LEVELS } from './pass.js';
import { FEATURES } from './unlocks.js';
import { applyStreak, streakAlive } from './events.js';

export const SAVE_KEY = 'cc-save-v3';
const LEGACY_KEY = 'cc-stats';

const DEFAULTS = {
  v: 4, rounds: 0, best: 0, bestScore: 0, outliers: 0, xp: 0, skin: 'ambar',
  sfx: true, music: true, vib: true, streak: 0, lastDay: '', ach: {}, records: [],
  // v0.4
  coins: 0, pr: 0, peakPR: 0, owned: {}, missions: null, daily: { last: '', next: 0 }, trail: 'basica',
  forksSeen: 0, forksWon: 0, pathStreak: 0, bestPathStreak: 0, rivalsBeaten: 0, shopSeen: '',
  // v0.7
  codes: {}, name: '', server: '', relTouch: true, track: 'mus-corriente', nameStyle: 'nm-blanco',
  // v0.9
  passXp: 0, passClaimed: {}, premiumPass: false, achClaimed: {}, ownerAll: false, notif: true,
  friendId: '', friends: [],
  // v0.11
  titleSel: 0,
  // v0.12
  seenFeat: {}, shieldWeek: '', shieldUsed: false, lastSeen: '', challenge: { day: '', best: 0, tries: 0, log: '' }, cloud: null,
};

// Lo que cada jugador tenía con las reglas anteriores a la v0.9 (por nivel, liga o logro) se conserva
const LEGACY = {
  level: { menta: 2, coral: 3, rosa: 4, hielo: 6, luna: 8, solar: 9, prisma: 12, nebula: 16, chispas: 5, arcoiris: 10, burbujas: 14,
    'mus-cascada': 3, 'mus-chip': 7, 'nm-menta': 2, 'nm-ambar': 4, 'nm-cielo': 5, 'nm-lavanda': 8, 'nm-arcoiris': 10, 'nm-hielo': 15 },
  rank: { cristal: 4, fenix: 5, eclipse: 6, constelacion: 4, brasas: 5, vacio: 6, 'nm-oro': 4, 'nm-galaxia': 6 },
  ach: { soln: 'path10', corona: 'outlier', boreal: 'rival5' },
};

const FRIEND_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newFriendId = () => Array.from({ length: 6 }, () => FRIEND_CHARS[Math.floor(Math.random() * FRIEND_CHARS.length)]).join('');

export { SKINS, TRAILS, MUSIC, NAME_STYLES };

// Títulos de cuenta: del básico al más épico, a medida que subís hasta el nivel 120
export const MAX_LEVEL = 120;
export const TITLES = [
  { lvl: 1, name: 'Chispa' }, { lvl: 3, name: 'Destello' }, { lvl: 5, name: 'Gota' }, { lvl: 8, name: 'Arroyo' },
  { lvl: 12, name: 'Corriente' }, { lvl: 16, name: 'Remolino' }, { lvl: 20, name: 'Contracorriente' }, { lvl: 25, name: 'Oleaje' },
  { lvl: 30, name: 'Rompeolas' }, { lvl: 35, name: 'Marejada' }, { lvl: 40, name: 'Outlier' }, { lvl: 45, name: 'Vórtice' },
  { lvl: 50, name: 'Torrente' }, { lvl: 55, name: 'Tormenta viva' }, { lvl: 60, name: 'Maremoto' }, { lvl: 65, name: 'Ciclón' },
  { lvl: 70, name: 'Leviatán' }, { lvl: 75, name: 'Titán de las mareas' }, { lvl: 80, name: 'Señor del abismo' },
  { lvl: 85, name: 'Voz del océano' }, { lvl: 90, name: 'Tsunami' }, { lvl: 95, name: 'Emperador del torrente' },
  { lvl: 100, name: 'Leyenda eterna' }, { lvl: 105, name: 'Mito de la corriente' }, { lvl: 110, name: 'Deidad del caos' },
  { lvl: 115, name: 'Origen de las mareas' }, { lvl: 120, name: 'Soberano Absoluto de la Corriente' },
];

// Distintivo de cuenta: cambia cada 10 niveles (se dibuja alrededor del nivel)
export const LEVEL_BADGES = [
  { lvl: 1, name: 'Novato', col: '#a69ecb' },
  { lvl: 10, name: 'Gota', col: '#8fd8ff' },
  { lvl: 20, name: 'Onda', col: '#5ef2c2' },
  { lvl: 30, name: 'Remolino', col: '#2fd68a' },
  { lvl: 40, name: 'Espiral', col: '#ffb547' },
  { lvl: 50, name: 'Marea', col: '#ff8f70' },
  { lvl: 60, name: 'Tormenta', col: '#ff7ad9' },
  { lvl: 70, name: 'Vórtice', col: '#b48cff' },
  { lvl: 80, name: 'Maremoto', col: '#ff5470' },
  { lvl: 90, name: 'Abismo', col: '#3d9bff' },
  { lvl: 100, name: 'Corona del Mar', col: '#ffd166' },
  { lvl: 110, name: 'Eclipse Oceánico', col: '#ff5ed1' },
  { lvl: 120, name: 'Soberano', col: '#fff1c2' },
];
export function levelBadgeOf(level) {
  let t = 0;
  for (let i = 0; i < LEVEL_BADGES.length; i++) if (level >= LEVEL_BADGES[i].lvl) t = i;
  return { tier: t, ...LEVEL_BADGES[t] };
}

// reward: destellos que se reclaman a mano, y a veces un cosmético (item)
export const ACHIEVEMENTS = [
  { id: 'first', name: 'Primera caída', desc: 'Jugá tu primera ronda.', test: () => true, coins: 50 },
  { id: 'fork1', name: 'A contracorriente', desc: 'Sobreviví a una bifurcación.', test: s => s.forksOk >= 1, coins: 50 },
  { id: 'fork3', name: 'Mitad del camino', desc: 'Sobreviví a 3 bifurcaciones en una ronda.', test: s => s.forksOk >= 3, coins: 100 },
  { id: 'final', name: 'Hasta el final', desc: 'Llegá con vida al final de una ronda.', test: s => s.alive, coins: 150 },
  { id: 'outlier', name: 'Outlier del minuto', desc: 'Sé el último en pie.', test: s => s.outlier, coins: 250, item: 'corona' },
  { id: 'top10', name: 'Top 10', desc: 'Terminá entre los 10 primeros.', test: s => s.rank <= 10, coins: 150 },
  { id: 'near5', name: 'Al filo', desc: 'Hacé 5 pasadas justas en una ronda.', test: s => s.near >= 5, coins: 100 },
  { id: 'combo3', name: 'En racha', desc: 'Encadená 3 pasadas justas seguidas.', test: s => s.maxCombo >= 3, coins: 100 },
  { id: 'orbs15', name: 'Coleccionista', desc: 'Juntá 15 chispas en una ronda.', test: s => s.orbs >= 15, coins: 75 },
  { id: 'gold', name: 'Fiebre del oro', desc: 'Sobreviví eligiendo un camino dorado.', test: s => s.feats.gold, coins: 75 },
  { id: 'fog', name: 'A ciegas', desc: 'Sobreviví a una bifurcación con niebla.', test: s => s.feats.fog, coins: 75 },
  { id: 'invert', name: 'Leíste la trampa', desc: 'Sobreviví a una inversión.', test: s => s.feats.invert, coins: 100 },
  { id: 'streak3', name: 'Constante', desc: 'Jugá 3 días seguidos.', test: (s, save) => save.streak >= 3, coins: 150 },
  { id: 'veteran', name: 'Veterano', desc: 'Jugá 25 rondas.', test: (s, save) => save.rounds >= 25, coins: 200 },
  { id: 'path10', name: 'Imparable', desc: 'Sobreviví a 10 bifurcaciones seguidas, aunque sea entre rondas.', test: (s, save) => save.bestPathStreak >= 10, coins: 200, item: 'soln' },
  { id: 'rival5', name: 'Némesis', desc: 'Ganale a 5 rivales.', test: (s, save) => save.rivalsBeaten >= 5, coins: 150, item: 'boreal' },
  { id: 'gold_rank', name: 'Liga de Oro', desc: 'Llegá a la liga Oro.', test: (s, save) => rankOf(save.peakPR).tier >= 2, coins: 200 },
  { id: 'dash_save', name: 'Último segundo', desc: 'Sobreviví a una bifurcación después de usar un impulso.', test: s => !!(s.feats && s.feats.dashSave), coins: 100 },
  { id: 'oracle', name: 'Oráculo', desc: 'Acertá 3 predicciones mientras mirás una ronda.', test: s => (s.predHits || 0) >= 3, coins: 100 },
];

export const achItem = a => (a.item ? [...SKINS, ...TRAILS].find(k => k.id === a.item) : null);
export const claimableAch = save => ACHIEVEMENTS.filter(a => save.ach[a.id] && !save.achClaimed[a.id]);

export function claimAchievement(save, id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a || !save.ach[id] || save.achClaimed[id]) return null;
  save.achClaimed[id] = true;
  save.coins += a.coins;
  const item = achItem(a);
  if (item) save.owned[item.id] = true;
  return { coins: a.coins, item };
}

// ---------- Niveles ----------
export const levelNeed = n => 100 + (n - 1) * 25; // XP para pasar del nivel n al siguiente

export function levelInfo(xp) {
  let level = 1, need = levelNeed(1);
  while (xp >= need && level < MAX_LEVEL) { xp -= need; level++; need = levelNeed(level); }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: need, need, max: true };
  return { level, into: xp, need };
}

// En el nivel máximo se puede lucir el título de cualquier nivel
export function displayTitle(save) {
  const lvl = levelInfo(save.xp).level;
  if (lvl >= MAX_LEVEL && save.titleSel) {
    const t = TITLES.find(x => x.lvl === save.titleSel);
    if (t) return t.name;
  }
  return titleOf(lvl);
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
  return { level: levelInfo(save.xp).level, peakTier: rankOf(save.peakPR).tier, ach: save.ach, owned: save.owned, all: !!save.ownerAll };
}
export const ownedSkins = save => { const ctx = ownedCtx(save); return SKINS.filter(k => isOwned(k, ctx)); };
export const ownedTrails = save => { const ctx = ownedCtx(save); return TRAILS.filter(k => isOwned(k, ctx)); };
export const ownedMusic = save => { const ctx = ownedCtx(save); return MUSIC.filter(k => isOwned(k, ctx)); };
export const ownedNames = save => { const ctx = ownedCtx(save); return NAME_STYLES.filter(k => isOwned(k, ctx)); };
const allOwned = save => [...ownedSkins(save), ...ownedTrails(save), ...ownedMusic(save), ...ownedNames(save)];

// ---------- Fechas ----------
const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const yesterdayOf = d => { const y = new Date(d); y.setDate(y.getDate() - 1); return y; };

export const streakNow = (save, now = new Date()) => streakAlive(save, now);

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
  for (const k of ['passXp']) if (typeof save[k] !== 'number' || !isFinite(save[k])) save[k] = 0;
  for (const k of ['ach', 'owned', 'codes', 'passClaimed', 'achClaimed', 'seenFeat']) if (!save[k] || typeof save[k] !== 'object') save[k] = {};
  if (!save.daily || typeof save.daily !== 'object') save.daily = { last: '', next: 0 };
  if (!Array.isArray(save.records)) save.records = [];
  if (typeof save.name !== 'string') save.name = '';
  if (typeof save.server !== 'string') save.server = '';
  if (!Array.isArray(save.friends)) save.friends = [];
  save.friends = save.friends.filter(f => f && typeof f.id === 'string').slice(0, 100);
  if (typeof save.friendId !== 'string' || !/^[A-Z0-9]{6}$/.test(save.friendId)) save.friendId = newFriendId();
  // Migración a la v0.9: conservar lo conseguido con las reglas viejas y los logros ya ganados
  if (data && (data.v || 0) < 5) {
    const lvl = levelInfo(save.xp).level, tier = rankOf(save.peakPR).tier;
    for (const [id, n] of Object.entries(LEGACY.level)) if (lvl >= n) save.owned[id] = true;
    for (const [id, n] of Object.entries(LEGACY.rank)) if (tier >= n) save.owned[id] = true;
    for (const [id, a] of Object.entries(LEGACY.ach)) if (save.ach[a]) save.owned[id] = true;
    for (const a of ACHIEVEMENTS) if (save.ach[a.id]) save.achClaimed[a.id] = true;
    save.passXp = save.xp;
  }
  if (!SKINS.some(k => k.id === save.skin)) save.skin = DEFAULTS.skin;
  if (!TRAILS.some(k => k.id === save.trail)) save.trail = DEFAULTS.trail;
  if (!MUSIC.some(k => k.id === save.track)) save.track = DEFAULTS.track;
  if (!NAME_STYLES.some(k => k.id === save.nameStyle)) save.nameStyle = DEFAULTS.nameStyle;
  // v0.12: quien ya jugaba no ve como "nuevas" las secciones que ya conocía
  if (data && (data.v || 0) < 6) for (const f of FEATURES) if (save.rounds >= f.rounds) save.seenFeat[f.id] = true;
  if (!save.challenge || typeof save.challenge !== 'object') save.challenge = { ...DEFAULTS.challenge };
  save.v = 6;
  return save;
}

export function writeSave(store, save) {
  store.set(SAVE_KEY, JSON.stringify(save));
}

// keep: ajustes que se conservan (sonido, control, servidor); todo lo demás vuelve a cero
export function resetSave(store, keep = {}) {
  const fresh = { ...DEFAULTS, ...keep, ach: {}, records: [], owned: {}, codes: {}, passClaimed: {}, achClaimed: {}, friends: [], friendId: newFriendId(), daily: { last: '', next: 0 } };
  writeSave(store, fresh);
  return fresh;
}

export const levelCoinsAt = l => 20 + l * 2;
const xpToLevel = n => { let x = 0; for (let l = 1; l < n; l++) x += levelNeed(l); return x; };

// Dueños: absolutamente todo al máximo (cuenta 120, pase 100 reclamado, Leyenda, logros y cosméticos)
export function unlockEverything(save) {
  save.ownerAll = true;
  save.premiumPass = true;
  save.xp = Math.max(save.xp, xpToLevel(MAX_LEVEL));
  save.passXp = Math.max(save.passXp || 0, PASS_STEP * (PASS_LEVELS - 1));
  for (let l = 1; l <= PASS_LEVELS; l++) save.passClaimed[l] = true;
  for (const k of [...SKINS, ...TRAILS, ...MUSIC, ...NAME_STYLES]) save.owned[k.id] = true;
  const today = dayKey(new Date());
  for (const a of ACHIEVEMENTS) { if (!save.ach[a.id]) save.ach[a.id] = today; save.achClaimed[a.id] = true; }
  save.pr = Math.max(save.pr, LEGEND_PR + 500);
  save.peakPR = Math.max(save.peakPR, save.pr);
  save.coins = Math.max(save.coins, 0) + 50000;
  return save;
}

// Suma XP al nivel del jugador y al pase de temporada (los premios del pase se reclaman a mano)
function addXP(save, xp) {
  const before = levelInfo(save.xp), passBefore = passInfo(save.passXp).level;
  save.xp += xp;
  save.passXp += xp;
  const after = levelInfo(save.xp), passAfter = passInfo(save.passXp).level;
  // Cada nivel de cuenta da destellos (y a veces un cosmético o un distintivo nuevo)
  let levelCoins = 0;
  for (let l = before.level + 1; l <= after.level; l++) levelCoins += levelCoinsAt(l);
  save.coins += levelCoins;
  return { before, after, passBefore, passAfter, levelCoins };
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
  const ownedBefore = new Set(allOwned(save).map(k => k.id));
  const prevBest = save.best, first = save.rounds === 0;
  save.rounds++;
  save.best = Math.max(save.best, sum.pct);
  if (sum.outlier) save.outliers++;
  if (sum.beatRival) save.rivalsBeaten++;

  const today = dayKey(now);
  const shield = applyStreak(save, now).shield;

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
  const newMusic = ownedMusic(save).filter(k => !ownedBefore.has(k.id));
  const newNames = ownedNames(save).filter(k => !ownedBefore.has(k.id));
  const promoted = rankAfter.tier > rankBefore.tier || (rankAfter.tier === rankBefore.tier && rankAfter.div < rankBefore.div);

  return {
    gain, coins, predCoins, levelCoins: lv.levelCoins, before: lv.before, after: lv.after, passBefore: lv.passBefore, passAfter: lv.passAfter,
    passClaimable: claimablePass(save).length, shieldUsed: shield, achClaimable: claimableAch(save).length, newAch, newSkins, newTrails, newMusic, newNames, missionsDone,
    recordPos, recordCount: save.records.length, newBestPct: !first && sum.pct > prevBest,
    pr: { before: prBefore, after: save.pr, delta: save.pr - prBefore, raw: delta, rankBefore, rankAfter, promoted },
    pathStreak: save.pathStreak,
    missions: save.missions.list,
  };
}
