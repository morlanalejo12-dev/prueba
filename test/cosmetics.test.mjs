import test from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, TRAILS, RARITY, FREE_RARITIES, isOwned } from '../src/game/skins.js';
import { MUSIC } from '../src/game/music.js';
import { NAME_STYLES } from '../src/game/names.js';
import { TRACKS } from '../src/audio/tracks.js';
import { PASS, PASS_FREE, passInfo, claimPass, claimablePass, PASS_STEP } from '../src/game/pass.js';
import { loadSave, applyRound, ownedCtx, claimAchievement, claimableAch, SAVE_KEY } from '../src/game/progress.js';
import { redeemCode } from '../src/game/codes.js';
import { orbTier, ORB_TIERS } from '../src/sim/level.js';

const mem = (init) => { const m = new Map(init ? [[SAVE_KEY, JSON.stringify(init)]] : []); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: k => m.delete(k) }; };
const ALL = [...SKINS, ...TRAILS, ...MUSIC, ...NAME_STYLES];
const sum = { score: 800, pct: 60, rank: 400, total: 1201, forksOk: 2, forks: 6, near: 0, orbs: 5, alive: false, feats: {}, forksSeen: 3 };

test('cada cosmético es único: id y nombre distintos, y una sola forma de conseguirlo', () => {
  const ids = ALL.map(k => k.id), names = ALL.map(k => k.name);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(names).size, names.length);
  for (const k of ALL) assert.ok(k.src && typeof k.src.type === 'string', k.id);
});

test('calidades: gratis hasta Épica; Legendaria y Mítica solo de pago; Fundador solo por código', () => {
  const free = ['default', 'level', 'shop', 'rank', 'ach', 'daily'];
  for (const k of ALL) {
    assert.ok(RARITY[k.rarity], k.id);
    const s = k.src;
    if (free.includes(s.type) || (s.type === 'pass' && s.lvl <= PASS_FREE)) assert.ok(FREE_RARITIES.includes(k.rarity), `${k.id} es gratis y ${k.rarity}`);
    if (k.rarity === 'legendaria' || k.rarity === 'mitica') assert.ok(s.type === 'premium' || s.type === 'offer' || (s.type === 'pass' && s.lvl > PASS_FREE), k.id);
    if (k.rarity === 'fundador') assert.equal(s.type, 'code', k.id);
    if (s.type === 'code') assert.equal(k.rarity, 'fundador', k.id);
  }
});

test('pase: 100 niveles, 20 gratis, variado y con una Mítica en el nivel 100', () => {
  assert.equal(PASS.length, 100);
  assert.equal(PASS.filter(r => !r.premium).length, 20);
  const kinds = new Set(PASS.map(r => r.reward.kind));
  for (const k of ['skin', 'trail', 'music', 'name', 'coins']) assert.ok(kinds.has(k), k);
  const last = PASS[99].reward;
  assert.equal(last.kind, 'skin');
  assert.equal(last.item.rarity, 'mitica');
  const lvls = ALL.filter(k => k.src.type === 'pass').map(k => k.src.lvl);
  assert.equal(new Set(lvls).size, lvls.length, 'un solo cosmético por nivel');
  const acc = ALL.filter(k => k.src.type === 'level').map(k => k.src.lvl);
  assert.equal(new Set(acc).size, acc.length, 'un solo cosmético por nivel de cuenta');
});

test('pase: los premios se reclaman a mano y los niveles Premium piden el pase', () => {
  const save = loadSave(mem());
  assert.equal(passInfo(save.passXp).level, 1);
  applyRound(save, sum);
  save.passXp = PASS_STEP * 25;
  assert.equal(isOwned(SKINS.find(k => k.id === 'menta'), ownedCtx(save)), false, 'no se reclama sola');
  const ready = claimablePass(save);
  assert.equal(ready.length, 20, 'sin Premium solo los 20 gratis');
  const r = claimPass(save, 2);
  assert.equal(r.item.id, 'menta');
  assert.ok(isOwned(r.item, ownedCtx(save)));
  assert.equal(claimPass(save, 2), null, 'una sola vez');
  assert.equal(claimPass(save, 22), null, 'nivel Premium bloqueado');
  save.premiumPass = true;
  assert.ok(claimPass(save, 22));
  assert.equal(claimPass(save, 30), null, 'todavía no llegó al 30');
});

test('logros: el premio se reclama a mano', () => {
  const save = loadSave(mem());
  const coins0 = save.coins;
  applyRound(save, sum);
  assert.ok(claimableAch(save).length >= 1);
  const c = save.coins;
  const r = claimAchievement(save, 'first');
  assert.ok(r && r.coins > 0);
  assert.equal(save.coins, c + r.coins);
  assert.equal(claimAchievement(save, 'first'), null);
  assert.ok(save.coins > coins0);
});

test('migración: lo conseguido con las reglas viejas se conserva', () => {
  const old = { v: 4, xp: 5000, peakPR: 1300, ach: { outlier: '2026-09-01', first: '2026-09-01' }, owned: {} };
  const save = loadSave(mem(old));
  const own = id => isOwned(ALL.find(k => k.id === id), ownedCtx(save));
  assert.ok(own('menta') && own('prisma') && own('corona') && own('cristal'));
  assert.equal(claimableAch(save).length, 0, 'los logros viejos ya cuentan como reclamados');
  assert.ok(/^[A-Z0-9]{6}$/.test(save.friendId));
});


test('cada tema existe y los generativos dan notas válidas en todas las etapas', () => {
  for (const m of MUSIC) assert.ok(TRACKS[m.track], m.id);
  const v = TRACKS.voltaje;
  assert.equal(v.sample, 'dko');
  for (const [a, z] of Object.values(v.sections)) {
    const bars = (z - a) / (240 / v.bpm);
    assert.ok(Math.abs(bars - Math.round(bars)) < 0.02, 'el loop dura compases enteros');
  }
  for (const [id, tr] of Object.entries(TRACKS)) {
    if (tr.sample) continue;
    let n = 0;
    const rec = (...a) => { n++; for (const x of a) if (typeof x === 'number') assert.ok(isFinite(x), id); };
    const E = new Proxy({ music: {} }, { get: (o, k) => (k in o ? o[k] : rec) });
    for (const [L, S] of [[0.2, 0], [1, 7]]) for (let s = 0; s < tr.bars * 16; s++) tr.step(E, s, 1, 0.1, L, S);
    assert.ok(n > tr.bars * 16, id);
  }
});

test('las chispas valen más a medida que avanza la ronda', () => {
  const forks = [{ endY: 100 }, { endY: 200 }, { endY: 300 }, { endY: 400 }, { endY: 500 }, { endY: 600 }];
  const tiers = [50, 250, 450, 650].map(y => orbTier(forks, { y }));
  assert.deepEqual(tiers, [0, 1, 2, 3]);
  for (let i = 1; i < ORB_TIERS.length; i++) assert.ok(ORB_TIERS[i].mult > ORB_TIERS[i - 1].mult);
});
