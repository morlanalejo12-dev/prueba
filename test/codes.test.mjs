import test from 'node:test';
import assert from 'node:assert/strict';
import { redeemCode, normalizeCode } from '../src/game/codes.js';
import { loadSave, ownedCtx } from '../src/game/progress.js';
import { isOwned, skinById, trailById, RARITY_ORDER } from '../src/game/skins.js';

const mem = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: k => m.delete(k) }; };

test('normaliza códigos', () => {
  assert.equal(normalizeCode(' owner 12 '), 'OWNER12');
  assert.equal(normalizeCode('owner-13'), 'OWNER13');
});

test('OWNER12 da la skin Singularidad y la equipa, una sola vez', () => {
  const save = loadSave(mem());
  assert.equal(isOwned(skinById('singularidad'), ownedCtx(save)), false);
  const r = redeemCode(save, 'owner12');
  assert.ok(r.ok);
  assert.equal(r.reward.item.id, 'singularidad');
  assert.equal(save.skin, 'singularidad');
  assert.ok(isOwned(skinById('singularidad'), ownedCtx(save)));
  const again = redeemCode(save, 'OWNER12');
  assert.equal(again.ok, false);
});

test('OWNER13 da la estela Supernova', () => {
  const save = loadSave(mem());
  const r = redeemCode(save, 'OWNER13');
  assert.ok(r.ok);
  assert.equal(save.trail, 'supernova');
  assert.ok(isOwned(trailById('supernova'), ownedCtx(save)));
});

test('códigos inválidos y de monedas', () => {
  const save = loadSave(mem());
  assert.equal(redeemCode(save, 'OWNER14').ok, false);
  assert.equal(redeemCode(save, '').ok, false);
  const c0 = save.coins;
  assert.ok(redeemCode(save, 'bienvenida').ok);
  assert.equal(save.coins, c0 + 250);
  assert.equal(RARITY_ORDER.at(-1), 'fundador');
});
