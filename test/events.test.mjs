import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeSeed, recordChallenge, forkEmojis, challengeShareText, weekendMode, comebackReward, streakAlive } from '../src/game/events.js';
import { Round } from '../src/sim/round.js';
import { isUnlocked, newlyUnlocked, nextFeature } from '../src/game/unlocks.js';

test('desafío del día: misma semilla para todos ese día, otra al día siguiente', () => {
  assert.equal(challengeSeed('2026-09-30'), challengeSeed('2026-09-30'));
  assert.notEqual(challengeSeed('2026-09-30'), challengeSeed('2026-10-01'));
  const a = new Round({ seed: challengeSeed('2026-09-30'), demo: true }), b = new Round({ seed: challengeSeed('2026-09-30'), demo: true });
  a.runToEnd(); b.runToEnd();
  assert.equal(a.aliveTotal, b.aliveTotal);
});

test('desafío: guarda el mejor intento y arma el texto para compartir', () => {
  const save = { challenge: { day: '', best: 0, tries: 0, log: '' } };
  assert.equal(recordChallenge(save, { score: 500, rank: 40, total: 1201, forkLog: ['ok', 'lost'] }, '2026-09-30'), true);
  assert.equal(recordChallenge(save, { score: 300, rank: 90, total: 1201, forkLog: ['lost'] }, '2026-09-30'), false);
  assert.equal(save.challenge.best, 500);
  assert.equal(save.challenge.tries, 2);
  assert.equal(forkEmojis({ forkLog: ['ok', 'ok', 'lost'] }), '🟩🟩🟥⬛⬛⬛');
  assert.match(challengeShareText(save), /Desafío 30\/09[\s\S]*#40 de 1201/);
});

test('modo del finde: solo sábados y domingos, y cambia las bifurcaciones', () => {
  assert.equal(weekendMode(new Date(2026, 8, 30)), null, 'miércoles');
  assert.ok(weekendMode(new Date(2026, 9, 3)), 'sábado');
  const inv = new Round({ seed: 5, demo: true, mode: 'inversion' });
  assert.ok(inv.lvl.forks.slice(1).every(f => f.invert));
  const fog = new Round({ seed: 5, demo: true, mode: 'niebla' });
  assert.ok(fog.lvl.forks.slice(1).every(f => f.variant === 'fog'));
  const tur = new Round({ seed: 5, demo: true, mode: 'turbo' });
  assert.ok(tur.lvl.forks.every(f => f.k === 2));
  tur.step(1 / 60);
  assert.ok(tur.speed > new Round({ seed: 5, demo: true }).speed * 1.2);
});

test('primera bifurcación: 4 caminos, así la mayoría sobrevive aunque elija al azar', () => {
  for (let s = 1; s <= 5; s++) assert.equal(new Round({ seed: s, demo: true }).lvl.forks[0].k, 4);
});

test('premio de regreso y racha con escudo', () => {
  const save = { rounds: 5, lastDay: '2026-09-20', coins: 0, streak: 4, shieldWeek: '' };
  const r = comebackReward(save, new Date(2026, 8, 30));
  assert.ok(r && r.days === 10 && save.coins === r.coins);
  assert.equal(comebackReward(save, new Date(2026, 8, 30)), null, 'una vez por día');
  assert.equal(streakAlive({ lastDay: '2026-09-28', streak: 6, shieldWeek: '' }, new Date(2026, 8, 30)), 6, 'el escudo la mantiene viva');
  assert.equal(streakAlive({ lastDay: '2026-09-27', streak: 6, shieldWeek: '' }, new Date(2026, 8, 30)), 0);
});

test('menú progresivo: se habilita de a una sección', () => {
  assert.equal(isUnlocked({ rounds: 0 }, 'collection'), false);
  assert.equal(isUnlocked({ rounds: 0, ownerAll: true }, 'premium'), true);
  assert.deepEqual(newlyUnlocked(4, 5).map(f => f.id), ['online']);
  assert.equal(nextFeature({ rounds: 0 }).id, 'collection');
});
