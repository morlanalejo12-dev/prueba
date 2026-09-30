// Desafío del día, modo del finde, escudo de racha y premio de regreso.
import { hash01 } from '../util/rng.js';

const pad = n => String(n).padStart(2, '0');
const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ---------- Desafío del día: la misma ronda para todos ----------
export const challengeDay = (now = new Date()) => dk(now);
export function challengeSeed(day) {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return (h ^ 0x5a17) >>> 0;
}

// Registrar un intento; devuelve si es un nuevo mejor puntaje del día
export function recordChallenge(save, sum, day) {
  const c = save.challenge.day === day ? save.challenge : { day, best: 0, tries: 0, log: '', rank: 0, total: 0 };
  c.tries++;
  const better = sum.score > c.best;
  if (better) { c.best = sum.score; c.log = forkEmojis(sum); c.rank = sum.rank; c.total = sum.total; }
  save.challenge = c;
  return better;
}

export function forkEmojis(sum) {
  const log = sum.forkLog || [];
  let s = '';
  for (let i = 0; i < Math.max(6, log.length); i++) s += log[i] === 'ok' ? '🟩' : log[i] === 'lost' ? '🟥' : '⬛';
  return s;
}

export function challengeShareText(save) {
  const c = save.challenge, [y, m, d] = c.day.split('-');
  return `Contracorriente · Desafío ${d}/${m} 🌊\n${c.log}\n#${c.rank} de ${c.total} · ${c.best} pts (${c.tries} ${c.tries === 1 ? 'intento' : 'intentos'})\n¿Me ganás?`;
}

// ---------- Modo del finde: rota cada semana ----------
export const WEEKEND_MODES = [
  { id: 'inversion', name: 'Todo al revés', desc: 'Todas las bifurcaciones son inversión: cae el camino con MENOS gente.' },
  { id: 'niebla', name: 'Niebla total', desc: 'No ves a la multitud en ninguna bifurcación: jugá con el instinto.' },
  { id: 'turbo', name: 'Turbo', desc: 'Siempre 2 caminos y un 30% más de velocidad.' },
];
export const weekKey = (now = new Date()) => {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${pad(Math.ceil(((d - y0) / 864e5 + 1) / 7))}`;
};
export function weekendMode(now = new Date()) {
  const wd = now.getDay();
  if (wd !== 0 && wd !== 6) return null;
  const idx = Math.floor(hash01(Number(weekKey(now).replace(/\D/g, '')), 77) * WEEKEND_MODES.length);
  return WEEKEND_MODES[idx];
}

// ---------- Escudo de racha: si faltás un día, una vez por semana, la racha no se corta ----------
export function applyStreak(save, now = new Date()) {
  const today = dk(now), y1 = dk(addDays(now, -1)), y2 = dk(addDays(now, -2));
  if (save.lastDay === today) return { shield: false };
  let shield = false;
  if (save.lastDay === y1) save.streak++;
  else if (save.lastDay === y2 && save.shieldWeek !== weekKey(now) && save.streak > 0) { save.streak++; save.shieldWeek = weekKey(now); shield = true; }
  else save.streak = 1;
  save.lastDay = today;
  return { shield };
}
export function streakAlive(save, now = new Date()) {
  const today = dk(now), y1 = dk(addDays(now, -1)), y2 = dk(addDays(now, -2));
  if (save.lastDay === today || save.lastDay === y1) return save.streak;
  if (save.lastDay === y2 && save.shieldWeek !== weekKey(now)) return save.streak;
  return 0;
}

// ---------- Premio de regreso: después de 3 días o más sin jugar ----------
export function comebackReward(save, now = new Date()) {
  if (!save.rounds || !save.lastDay || save.lastComeback === dk(now)) return null;
  const [y, m, d] = save.lastDay.split('-').map(Number);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 864e5);
  if (days < 3) return null;
  const coins = 150 + 25 * Math.min(days, 10);
  save.coins += coins;
  save.lastComeback = dk(now);
  return { days, coins };
}
