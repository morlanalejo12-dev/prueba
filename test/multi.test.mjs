import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiRound } from '../src/sim/multi.js';
import { CFG } from '../src/config.js';
import { aimX } from '../src/sim/gates.js';

const humans = n => Array.from({ length: n }, (_, i) => ({ id: 'h' + i, name: 'Jugador ' + i, skin: 'ambar', trail: 'basica' }));

// Un "cliente" simple: esquiva muros apuntando al hueco y elige el camino menos poblado
function drive(R, h, seedPick) {
  const g = R.lvl.gates[h.ng], f = R.fork;
  let tx = h.x;
  if (f && h.y >= f.startY - 120 && h.laneFork !== f.i) {
    let m = 0;
    for (let k = 1; k < f.k; k++) if ((f.invert ? -1 : 1) * (f.intent[k] - f.intent[m]) < 0) m = k;
    if (seedPick) m = seedPick(f);
    tx = (f.lanes[m].x0 + f.lanes[m].x1) / 2;
  } else if (g && g.y - h.y < 200) {
    tx = aimX(g, R.tAt(h.y) + (g.y - h.y) / R.speed, h.x, 0.5);
  }
  const md = CFG.PLAYER_SPEED / 60;
  const nx = h.x + Math.max(-md, Math.min(md, tx - h.x));
  R.input(h.id, nx, R.pY - R.speed * 0.05);
}

test('multijugador: la ronda termina con un solo ganador y todos tienen resultado', () => {
  for (let s = 1; s <= 4; s++) {
    const R = new MultiRound({ seed: s * 7919, humans: humans(3) });
    let steps = 0;
    while (!R.ended && steps < 60000) {
      for (const h of R.humans) if (h.alive) drive(R, h);
      R.step(1 / 60);
      steps++;
    }
    assert.ok(R.ended, 'termina');
    assert.ok(R.aliveTotal <= 1 || R.pY >= R.lvl.endY);
    assert.ok(R.outlier && R.outlier.name);
    const st = R.standings();
    assert.equal(st.length, 3);
    for (const h of R.humans) {
      const sum = R.summaryFor(h);
      assert.ok(sum.rank >= 1 && sum.rank <= R.total, 'puesto válido ' + sum.rank);
      assert.ok(sum.score > 0);
    }
    const winners = R.humans.filter(h => h.rank === 1);
    assert.ok(winners.length <= 1);
  }
});

test('multijugador: quedarse quieto contra un muro mata al humano', () => {
  const R = new MultiRound({ seed: 42, humans: humans(1) });
  const h = R.humans[0];
  let steps = 0;
  while (h.alive && !R.ended && steps < 20000) { R.input(h.id, CFG.WALL + CFG.PR, R.pY); R.step(1 / 60); steps++; }
  assert.equal(h.alive, false);
  assert.ok(['wall', 'majority', 'inverted', 'lottery'].includes(h.why));
  assert.ok(h.ev.some(e => e.type === 'playerDied'));
});

test('multijugador: los humanos cuentan en la bifurcación y el impulso cambia de carril', () => {
  const R = new MultiRound({ seed: 99, humans: humans(2) });
  const [a] = R.humans;
  let dashed = false, steps = 0;
  while (!R.ended && steps < 60000 && R.cf < 2) {
    for (const h of R.humans) if (h.alive) drive(R, h, f => 0);
    const f = R.fork;
    if (f && a.alive && a.laneFork === f.i && !dashed && R.canDashH(a)) {
      const lane = a.lane;
      dashed = R.dash(a.id, lane === 0 ? 1 : -1);
      assert.ok(dashed);
      assert.notEqual(a.lane, lane);
      assert.equal(a.charges, CFG.DASH_START - 1);
    }
    R.step(1 / 60);
    steps++;
  }
  assert.ok(dashed, 'pudo usar el impulso');
  const res = R.gEvents.find(e => e.type === 'forkResolved');
  assert.ok(res && Array.isArray(res.collapsed));
});

test('multijugador: entradas lejos del futuro se limitan y la x no atraviesa paredes', () => {
  const R = new MultiRound({ seed: 5, humans: humans(1) });
  const h = R.humans[0];
  R.input(h.id, -500, 99999);
  assert.ok(h.y <= R.pY + R.speed * 0.31);
  assert.ok(h.x >= CFG.WALL);
});
