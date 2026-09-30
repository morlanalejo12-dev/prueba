// Progreso del jugador: niveles, títulos, estelas, logros, récords y racha.
// Funciones puras sobre un objeto `save`; el almacenamiento se inyecta para poder testearlo.

export const SAVE_KEY = 'cc-save-v3';
const LEGACY_KEY = 'cc-stats';

const DEFAULTS = {
  v: 3, rounds: 0, best: 0, bestScore: 0, outliers: 0, xp: 0, skin: 'ambar',
  sfx: true, music: true, vib: true, streak: 0, lastDay: '', ach: {}, records: [],
};

export const SKINS = [
  { id: 'ambar', name: 'Ámbar', lvl: 1, col: '#ffb547' },
  { id: 'menta', name: 'Menta', lvl: 2, col: '#5ef2c2' },
  { id: 'rosa', name: 'Rosa', lvl: 4, col: '#ff7ad9' },
  { id: 'hielo', name: 'Hielo', lvl: 6, col: '#8fd8ff' },
  { id: 'solar', name: 'Solar', lvl: 9, col: '#fff1a8' },
  { id: 'prisma', name: 'Prisma', lvl: 12, col: null }, // cambia de color con el tiempo
];

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

// ---------- Fechas ----------
const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yesterdayOf = d => { const y = new Date(d); y.setDate(y.getDate() - 1); return y; };

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
  for (const k of ['rounds', 'best', 'bestScore', 'outliers', 'xp', 'streak']) {
    if (typeof save[k] !== 'number' || !isFinite(save[k])) save[k] = DEFAULTS[k];
  }
  if (!save.ach || typeof save.ach !== 'object') save.ach = {};
  if (!Array.isArray(save.records)) save.records = [];
  if (!SKINS.some(k => k.id === save.skin)) save.skin = DEFAULTS.skin;
  save.v = 3;
  return save;
}

export function writeSave(store, save) {
  store.set(SAVE_KEY, JSON.stringify(save));
}

export function resetSave(store) {
  const fresh = { ...DEFAULTS, ach: {}, records: [] };
  writeSave(store, fresh);
  return fresh;
}

// ---------- Aplicar el resultado de una ronda ----------
export function applyRound(save, sum, now = new Date()) {
  const prevBest = save.best, first = save.rounds === 0;
  save.rounds++;
  save.best = Math.max(save.best, sum.pct);
  if (sum.outlier) save.outliers++;

  const today = dayKey(now);
  if (save.lastDay !== today) {
    save.streak = save.lastDay === dayKey(yesterdayOf(now)) ? save.streak + 1 : 1;
    save.lastDay = today;
  }

  const gain = xpForRound(sum);
  const before = levelInfo(save.xp);
  save.xp += gain;
  const after = levelInfo(save.xp);
  const unlockedSkins = SKINS.filter(k => k.lvl > before.level && k.lvl <= after.level);

  const newAch = ACHIEVEMENTS.filter(a => !save.ach[a.id] && a.test(sum, save));
  for (const a of newAch) save.ach[a.id] = today;

  const rec = { score: sum.score, rank: sum.rank, total: sum.total, pct: sum.pct, day: today };
  save.records.push(rec);
  save.records.sort((a, b) => b.score - a.score);
  save.records = save.records.slice(0, 5);
  const recordPos = save.records.indexOf(rec) + 1;
  save.bestScore = Math.max(save.bestScore, sum.score);

  return {
    gain, before, after, unlockedSkins, newAch, recordPos,
    recordCount: save.records.length,
    newBestPct: !first && sum.pct > prevBest,
  };
}
