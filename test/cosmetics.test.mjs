import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, TRAILS, RARITY } from '../src/game/skins.js';
import { MUSIC } from '../src/game/music.js';
import { NAME_STYLES } from '../src/game/names.js';
import { TRACKS } from '../src/audio/tracks.js';
import { loadSave, applyRound, ownedMusic, ownedNames } from '../src/game/progress.js';

const mem = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: k => m.delete(k) }; };

test('los id de todos los cosméticos son únicos (comparten el registro de compras)', () => {
  const ids = [...SKINS, ...TRAILS, ...MUSIC, ...NAME_STYLES].map(k => k.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('cada tema del catálogo existe, tiene rareza y se puede conseguir', () => {
  for (const m of MUSIC) {
    assert.ok(TRACKS[m.track], m.id);
    assert.ok(RARITY[m.rarity], m.id);
    assert.ok(['level', 'shop', 'rank', 'code'].includes(m.src.type));
    if (m.src.type === 'shop') assert.ok(m.src.price > 0);
  }
  assert.ok(MUSIC.filter(m => m.src.type !== 'code').length >= 7);
});

test('los temas generan notas válidas en todas las etapas', () => {
  for (const [id, tr] of Object.entries(TRACKS)) {
    let n = 0;
    const rec = (...a) => { n++; for (const v of a) if (typeof v === 'number') assert.ok(isFinite(v), id); };
    const E = new Proxy({ music: {} }, { get: (o, k) => (k in o ? o[k] : rec) });
    for (const [L, S] of [[0.2, 0], [1, 7]]) for (let s = 0; s < tr.bars * 16; s++) tr.step(E, s, 1, 0.1, L, S);
    assert.ok(n > tr.bars * 16, id);
  }
});

test('estilos de nombre: básicos, degradados y con efectos; los de nivel se desbloquean jugando', () => {
  const fx = new Set(NAME_STYLES.map(n => n.fx));
  for (const k of ['solid', 'grad', 'neon', 'fire', 'glitch', 'founder']) assert.ok(fx.has(k), k);
  const save = loadSave(mem());
  assert.equal(ownedNames(save).length, 1);
  assert.equal(ownedMusic(save).length, 1);
  save.xp = 5000;
  const rep = applyRound(save, { score: 500, pct: 60, rank: 400, total: 1201, forksOk: 1, forks: 6, near: 0, orbs: 5, alive: false, feats: {}, forksSeen: 2 });
  assert.ok(ownedNames(save).length > 1);
  assert.ok(Array.isArray(rep.newMusic) && Array.isArray(rep.newNames));
});
