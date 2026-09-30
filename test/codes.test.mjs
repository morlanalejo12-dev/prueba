import test from 'node:test';
import assert from 'node:assert/strict';
import { redeemCode, normalizeCode } from '../src/game/codes.js';
import { loadSave, ownedCtx, levelInfo, MAX_LEVEL, claimableAch, ACHIEVEMENTS } from '../src/game/progress.js';
import { isOwned, SKINS, TRAILS } from '../src/game/skins.js';
import { MUSIC } from '../src/game/music.js';
import { NAME_STYLES } from '../src/game/names.js';
import { passInfo, claimablePass } from '../src/game/pass.js';
import { rankOf } from '../src/game/ranks.js';

const mem = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: k => m.delete(k) }; };

test('normaliza códigos', () => {
  assert.equal(normalizeCode(' a4qz xgt '), 'A4QZXGT');
  assert.equal(normalizeCode('h84-bvdj'), 'H84BVDJ');
});

test('los códigos viejos ya no funcionan; BIENVENIDA sí, una sola vez', () => {
  const save = loadSave(mem());
  for (const c of ['OWNER12', 'OWNER13', 'OWNER14', 'DKO01', 'OWNERSTODO12']) assert.equal(redeemCode(save, c).ok, false, c);
  const c0 = save.coins;
  assert.ok(redeemCode(save, 'bienvenida').ok);
  assert.equal(save.coins, c0 + 250);
  assert.equal(redeemCode(save, 'BIENVENIDA').ok, false);
});

test('código de dueños: absolutamente todo al máximo', () => {
  const save = loadSave(mem());
  const r = redeemCode(save, 'A4QZXGT');
  assert.ok(r.ok);
  assert.equal(levelInfo(save.xp).level, MAX_LEVEL);
  assert.equal(passInfo(save.passXp).level, 100);
  assert.ok(save.premiumPass);
  assert.equal(claimablePass(save).length, 0, 'pase reclamado completo');
  assert.equal(rankOf(save.peakPR).tier, 6, 'liga Leyenda');
  assert.equal(Object.keys(save.ach).length, ACHIEVEMENTS.length);
  assert.equal(claimableAch(save).length, 0);
  const ctx = ownedCtx(save);
  for (const k of [...SKINS, ...TRAILS, ...MUSIC, ...NAME_STYLES]) assert.ok(isOwned(k, ctx), k.id);
  assert.ok(redeemCode(save, 'A4QZXGT').ok, 'se puede volver a usar');
});

test('código de reinicio: lo aplica el juego y se puede repetir', () => {
  const save = loadSave(mem());
  const r = redeemCode(save, 'H84BVDJ');
  assert.ok(r.ok);
  assert.equal(r.reward.kind, 'reset');
  assert.ok(redeemCode(save, 'H84BVDJ').ok);
});
