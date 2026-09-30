import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOf, tierFloor, applyPR, prDelta, MASTER_PR, LEGEND_PR } from '../src/game/ranks.js';
import { dailyMissions, ensureMissions, progressMissions, dailyState, claimDaily, shopOffers, buySkin, DAILY_REWARDS } from '../src/game/meta.js';
import { SKINS, TRAILS, isOwned } from '../src/game/skins.js';
import { claimMission } from '../src/game/progress.js';

const baseSave = () => ({ coins: 0, owned: {}, daily: { last: '', next: 0 }, missions: null, xp: 0 });
const sum = over => ({ score: 500, pct: 60, forksOk: 1, near: 0, orbs: 5, feats: { gold: false }, beatRival: false, ...over });

test('rangos: divisiones III, II, I y ligas altas', () => {
  assert.equal(rankOf(0).label, 'Bronce III');
  assert.equal(rankOf(99).label, 'Bronce III');
  assert.equal(rankOf(100).label, 'Bronce II');
  assert.equal(rankOf(299).label, 'Bronce I');
  assert.equal(rankOf(300).label, 'Plata III');
  assert.equal(rankOf(MASTER_PR).label, 'Maestro');
  assert.equal(rankOf(LEGEND_PR + 50).label, 'Leyenda');
});

test('protección de liga: no se baja de liga, sí de división', () => {
  assert.equal(tierFloor(450), 300);
  assert.equal(applyPR(310, -20), 300);
  assert.equal(applyPR(480, -20), 460);
  assert.equal(applyPR(0, -20), 0);
});

test('los PR por ronda están acotados', () => {
  assert.equal(prDelta({ pct: 0, forksOk: 0, outlier: false, beatRival: false, alive: false }), -20);
  assert.equal(prDelta({ pct: 100, forksOk: 6, outlier: true, beatRival: true, alive: true }), 50);
});

test('misiones: iguales para todos el mismo día y distintas entre sí', () => {
  const a = dailyMissions('2026-10-01'), b = dailyMissions('2026-10-01');
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(m => m.id)).size, 3);
});

test('misiones: se completan y se reclaman una sola vez', () => {
  const save = baseSave();
  const list = ensureMissions(save, '2026-10-01');
  for (let i = 0; i < 10; i++) progressMissions(save, sum({ orbs: 40, forksOk: 7, near: 8, beatRival: true, pct: 95, score: 2000, feats: { gold: true } }), '2026-10-01');
  assert.ok(list.every(m => m.progress >= m.goal));
  const r = claimMission(save, 0);
  assert.ok(r && r.coins > 0);
  assert.equal(claimMission(save, 0), null);
});

test('recompensa diaria: avanza día a día y se reinicia si se saltea uno', () => {
  const save = baseSave();
  assert.equal(claimDaily(save, 'd1', 'd0').coins, DAILY_REWARDS[0]);
  assert.equal(claimDaily(save, 'd1', 'd0'), null);
  assert.equal(claimDaily(save, 'd2', 'd1').coins, DAILY_REWARDS[1]);
  assert.equal(dailyState(save, 'd9', 'd8').index, 0);
  // El día 7 da una skin
  save.daily = { last: 'd6', next: 6 };
  const r = claimDaily(save, 'd7', 'd6');
  assert.equal(r.skin, 'aurora');
  assert.ok(save.owned.aurora);
});

test('tienda: dos skins y dos estelas por día, una rebajada, y compra', () => {
  const offers = shopOffers('2026-10-01');
  assert.equal(new Set(offers.map(o => o.id)).size, 4);
  assert.equal(offers.filter(o => o.kind === 'trail').length, 2);
  assert.equal(offers.filter(o => o.sale).length, 1);
  const save = baseSave();
  assert.equal(buySkin(save, offers[0]), false);
  save.coins = 5000;
  assert.equal(buySkin(save, offers[0]), true);
  assert.equal(buySkin(save, offers[0]), false);
  assert.ok(save.coins < 5000);
});

test('dueños de skins según su origen', () => {
  const ctx = { level: 4, peakTier: 2, ach: { outlier: '2026-10-01' }, owned: { rosa: true } };
  const own = id => isOwned(SKINS.find(k => k.id === id), ctx);
  assert.ok(own('ambar'), 'la inicial siempre es tuya');
  assert.ok(own('rosa') && !own('hielo'), 'las del pase son tuyas cuando las reclamás');
  assert.ok(own('laurel') && !own('glaciar'), 'las de liga, por la liga máxima');
  assert.ok(!own('corona'), 'la del logro se reclama a mano');
  assert.ok(!own('brasa'));
  const ownT = id => isOwned(TRAILS.find(k => k.id === id), ctx);
  assert.ok(ownT('plata') && !ownT('rayo') && !ownT('chispas'));
  assert.ok(isOwned(SKINS.find(k => k.id === 'quasar'), { ...ctx, all: true }), 'el código de dueños desbloquea todo');
});
