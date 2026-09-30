import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelInfo, levelNeed, titleOf, applyRound, loadSave, writeSave, SAVE_KEY, ACHIEVEMENTS } from '../src/game/progress.js';

const memStore = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v) };
};

const sum = over => ({
  score: 500, rank: 300, total: 1201, pct: 75, forksOk: 1, forks: 6, near: 0, maxCombo: 0, orbs: 3,
  alive: false, outlier: false, why: 'majority', feats: { gold: false, fog: false, invert: false },
  forksSeen: 2, beatRival: false, rival: '@x', ...over,
});

test('niveles: los límites caen donde corresponde', () => {
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: levelNeed(1) });
  assert.equal(levelInfo(levelNeed(1) - 1).level, 1);
  assert.equal(levelInfo(levelNeed(1)).level, 2);
  assert.equal(levelInfo(levelNeed(1) + levelNeed(2)).level, 3);
});

test('títulos por nivel', () => {
  assert.equal(titleOf(1), 'Chispa');
  assert.equal(titleOf(4), 'Destello');
  assert.equal(titleOf(12), 'Outlier');
});

test('una ronda suma XP, desbloquea logros y guarda el récord', () => {
  const save = loadSave(memStore());
  const rep = applyRound(save, sum({ forksOk: 3, near: 5 }), new Date(2026, 8, 29));
  assert.ok(rep.gain > 0);
  const ids = rep.newAch.map(a => a.id);
  assert.ok(ids.includes('first') && ids.includes('fork3') && ids.includes('near5'));
  assert.equal(save.records.length, 1);
  assert.equal(rep.recordPos, 1);
  // Un logro no se vuelve a desbloquear
  const rep2 = applyRound(save, sum({ forksOk: 3 }), new Date(2026, 8, 29));
  assert.ok(!rep2.newAch.some(a => a.id === 'fork3'));
});

test('la racha sube en días consecutivos y se corta si se saltea uno', () => {
  const save = loadSave(memStore());
  applyRound(save, sum(), new Date(2026, 8, 1));
  applyRound(save, sum(), new Date(2026, 8, 2));
  applyRound(save, sum(), new Date(2026, 8, 3));
  assert.equal(save.streak, 3);
  assert.ok(save.ach.streak3);
  applyRound(save, sum(), new Date(2026, 8, 5));
  assert.equal(save.streak, 1);
});

test('los récords guardan solo los 5 mejores', () => {
  const save = loadSave(memStore());
  for (let i = 1; i <= 7; i++) applyRound(save, sum({ score: i * 100 }), new Date(2026, 8, 1));
  assert.equal(save.records.length, 5);
  assert.equal(save.records[0].score, 700);
  assert.equal(save.bestScore, 700);
});

test('migra el guardado de la v0.2 y tolera datos rotos', () => {
  const store = memStore({ 'cc-stats': JSON.stringify({ rounds: 4, xp: 300, skin: 'menta', muted: true }) });
  const save = loadSave(store);
  assert.equal(save.rounds, 4);
  assert.equal(save.skin, 'menta');
  assert.equal(save.sfx, false);
  writeSave(store, save);
  assert.ok(store.get(SAVE_KEY));
  const broken = loadSave(memStore({ [SAVE_KEY]: '{no es json' }));
  assert.equal(broken.rounds, 0);
  assert.equal(ACHIEVEMENTS.length, 19);
});

test('la racha de caminos sigue entre rondas y se corta al caer en una bifurcación', () => {
  const save = loadSave(memStore());
  applyRound(save, sum({ forksOk: 3, forksSeen: 3, alive: false, why: 'wall' }));
  assert.equal(save.pathStreak, 3); // chocó un muro: la racha sigue
  applyRound(save, sum({ forksOk: 2, forksSeen: 3 }));
  assert.equal(save.pathStreak, 0);
  assert.equal(save.bestPathStreak, 5);
});

test('una ronda da PR, destellos y avanza misiones', () => {
  const save = loadSave(memStore());
  const rep = applyRound(save, sum({ pct: 95, forksOk: 4, forksSeen: 5, orbs: 10 }), new Date(2026, 8, 29));
  assert.ok(rep.pr.delta > 0 && save.pr === rep.pr.after);
  assert.ok(rep.coins > 0 && save.coins >= rep.coins);
  assert.equal(save.missions.day, '2026-09-29');
  assert.equal(save.missions.list.length, 3);
});
