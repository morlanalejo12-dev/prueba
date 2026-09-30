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
  assert.ok(avgDur > 33 && avgDur < 80, `duración ${avgDur.toFixed(1)} s`);
  assert.ok(avgSurv <= 1, `sobrevivientes ${avgSurv.toFixed(1)}`);
});

test('muerte súbita: la ronda sigue hasta que queda uno solo', () => {
  for (let s = 1; s <= 8; s++) {
    const R = new Round({ seed: s * 31337, demo: true });
    R.runToEnd();
    assert.ok(R.aliveTotal <= 1, `quedaron ${R.aliveTotal}`);
    assert.ok(R.outlier && R.outlier.name);
  }
});

test('un jugador que no se mueve choca con algún muro', () => {
  const R = new Round({ seed: 42 });
  let guard = 0;
  while (R.pAlive && !R.ended && guard++ < 20000) R.step(1 / 120);
  assert.equal(R.pAlive, false);
  assert.ok(R.rank >= 1 && R.rank <= CFG.BOTS + 1);
});

// Avanza hasta estar dentro de los carriles de la bifurcación actual, sin chocar muros
function toLanes(R) {
  const kp = R.killPlayer.bind(R);
  R.killPlayer = (why, s) => { if (why !== 'wall') kp(why, s); };
  const f = R.fork;
  R.setTarget((f.lanes[0].x0 + f.lanes[0].x1) / 2);
  while (R.pY < f.entryY + 20) R.step(1 / 120);
  return f;
}

test('impulso: cambia de carril, gasta una carga y solo una vez por bifurcación', () => {
  const R = new Round({ seed: 99 });
  const f = toLanes(R);
  assert.equal(R.pLane, 0);
  assert.equal(R.charges, CFG.DASH_START);
  assert.equal(R.dash(-1), false); // no hay carril a la izquierda
  assert.equal(R.dash(1), true);
  assert.equal(R.pLane, 1);
  assert.ok(R.px > f.lanes[1].x0 && R.px < f.lanes[1].x1);
  assert.equal(R.charges, CFG.DASH_START - 1);
  assert.equal(R.dash(-1), false); // ya se usó en esta bifurcación
});

test('impulso: juntar chispas recarga cargas hasta el máximo', () => {
  const R = new Round({ seed: 5 });
  for (let i = 0; i < CFG.ORBS_PER_DASH * 4; i++) R.takeOrb({ x: 0, y: 0 });
  assert.equal(R.charges, CFG.DASH_MAX);
});

test('partida guiada: el jugador nuevo no cae en las bifurcaciones protegidas', () => {
  for (let s = 1; s <= 6; s++) {
    const R = new Round({ seed: s * 101, guided: 3 });
    const kp = R.killPlayer.bind(R);
    R.killPlayer = (why, x) => { if (why !== 'wall') kp(why, x); };
    // Se queda siempre en el camino con más gente: sin protección caería
    while (R.cf < 3 && R.pAlive && !R.ended) {
      const f = R.fork;
      if (f && R.pY >= f.startY - 120 && R.pLane < 0) {
        let m = 0;
        for (let k = 1; k < f.k; k++) if (f.intent[k] > f.intent[m]) m = k;
        R.setTarget((f.lanes[m].x0 + f.lanes[m].x1) / 2);
      }
      R.step(1 / 120);
    }
    assert.ok(R.pAlive, `semilla ${s}: cayó en la bifurcación ${R.cf}`);
  }
});
