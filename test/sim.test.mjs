import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Round, pickCollapse } from '../src/sim/round.js';
import { makeGate, gapsAt, clearance, altOpen } from '../src/sim/gates.js';
import { CFG } from '../src/config.js';

test('la misma semilla produce la misma ronda', () => {
  const a = new Round({ seed: 1234, demo: true });
  const b = new Round({ seed: 1234, demo: true });
  a.runToEnd(); b.runToEnd();
  assert.equal(a.aliveBots, b.aliveBots);
  assert.equal(a.t, b.t);
  assert.equal(a.outlier.name, b.outlier.name);
});

test('colapsa el camino más poblado', () => {
  assert.deepEqual(pickCollapse([10, 40, 5], false, () => 0), [1]);
});

test('en una inversión colapsa el camino menos poblado', () => {
  assert.deepEqual(pickCollapse([10, 40, 5], true, () => 0), [2]);
  assert.deepEqual(pickCollapse([0, 40, 5], true, () => 0), [2]); // los vacíos no cuentan
});

test('si hay un solo camino ocupado, resiste', () => {
  assert.deepEqual(pickCollapse([0, 12, 0], false, () => 0), []);
});

test('si todos empatan, cae uno solo', () => {
  assert.equal(pickCollapse([7, 7], false, () => 0.9).length, 1);
});

test('las puertas se alternan cada período', () => {
  const g = makeGate(0, 'alt', 80, 100);
  g.c2 = 300; g.gw2 = 80; g.period = 1; g.ph = 0;
  const out = new Float64Array(4);
  assert.equal(altOpen(g, 0.5), 0);
  assert.equal(gapsAt(g, 0.5, out), 1);
  assert.equal((out[0] + out[1]) / 2, 100);
  assert.equal(altOpen(g, 1.5), 1);
  gapsAt(g, 1.5, out);
  assert.equal((out[0] + out[1]) / 2, 300);
  assert.ok(clearance(g, 100, 8, 0.5) > 0);
  assert.ok(clearance(g, 100, 8, 1.5) < 0);
});

test('el muro doble deja pasar por cualquiera de sus huecos', () => {
  const g = makeGate(0, 'double', 60, 100);
  g.c2 = 300; g.gw2 = 40;
  assert.ok(clearance(g, 100, 8, 0) > 0);
  assert.ok(clearance(g, 300, 8, 0) > 0);
  assert.ok(clearance(g, 200, 8, 0) < 0);
});

test('balance: cada bifurcación elimina a una parte razonable y la ronda dura lo esperado', () => {
  const rounds = 12;
  let kills = 0, forks = 0, dur = 0, survivors = 0;
  for (let s = 1; s <= rounds; s++) {
    const R = new Round({ seed: s * 7919, demo: true });
    let cf = 0;
    while (!R.ended) {
      const prev = R.aliveBots;
      R.step(1 / 60);
      if (R.cf !== cf) {
        if (!R.lvl.forks[cf].invert && prev > 0) { kills += (prev - R.aliveBots) / prev; forks++; }
        cf = R.cf;
      }
    }
    dur += R.t;
    survivors += R.aliveBots;
  }
  const avgKill = kills / forks, avgDur = dur / rounds, avgSurv = survivors / rounds;
  assert.ok(avgKill > 0.35 && avgKill < 0.7, `mortalidad por bifurcación ${avgKill.toFixed(2)}`);
  assert.ok(avgDur > 33 && avgDur < 55, `duración ${avgDur.toFixed(1)} s`);
  assert.ok(avgSurv >= 1 && avgSurv < 60, `sobrevivientes ${avgSurv.toFixed(1)}`);
});

test('un jugador que no se mueve choca con algún muro', () => {
  const R = new Round({ seed: 42 });
  let guard = 0;
  while (R.pAlive && !R.ended && guard++ < 20000) R.step(1 / 120);
  assert.equal(R.pAlive, false);
  assert.ok(R.rank >= 1 && R.rank <= CFG.BOTS + 1);
});
