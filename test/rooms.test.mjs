import test from 'node:test';
import assert from 'node:assert/strict';
import { Lobby, Room, nextMinute, cleanName } from '../server/rooms.js';

const fakePlayer = id => {
  const inbox = [];
  return { id, name: id, skin: 'ambar', trail: 'basica', inbox, send: s => inbox.push(JSON.parse(s)) };
};

function runRoom(room, t0, maxMs = 400000, drive) {
  let now = t0;
  while (now - t0 < maxMs) {
    now += 16;
    if (drive && room.round && room.phase === 'playing') drive(room.round);
    room.tick(now, 16);
    if (room.phase === 'lobby' && room.roundNo > 0 && !room.round) break;
  }
  return now;
}

test('sala privada: el anfitrión empieza, llegan instantáneas, eventos y resultados', () => {
  const lobby = new Lobby();
  const room = lobby.create();
  assert.match(room.code, /^[A-Z]{4}$/);
  const a = fakePlayer('a'), b = fakePlayer('b');
  room.add(a); room.add(b);
  assert.equal(room.host, 'a');
  assert.equal(room.requestStart('b', 0), false);
  assert.equal(room.requestStart('a', 0), true);
  const start = a.inbox.find(m => m.t === 'start');
  assert.ok(start && start.level.forks.length && start.humans.length === 2);
  assert.equal(Buffer.from(start.yo, 'base64').length, start.n);
  runRoom(room, 0, 400000, R => { for (const h of R.humans) R.input(h.id, 200, R.pY); });
  for (const p of [a, b]) {
    assert.ok(p.inbox.some(m => m.t === 's' && m.me), 'instantáneas');
    assert.ok(p.inbox.some(m => m.t === 'ev' && m.g.some(e => e.type === 'forkAnnounce')), 'eventos');
    const end = p.inbox.find(m => m.t === 'end');
    assert.ok(end && end.sum && end.standings.length === 2, 'resultado');
  }
  assert.equal(room.phase, 'lobby');
  lobby.leave(room, 'a'); lobby.leave(room, 'b');
  assert.equal(lobby.get(room.code), undefined);
});

test('sala global: arranca sola al comenzar el minuto si hay jugadores', () => {
  const t0 = 60000 * 1000 + 20000;
  const room = new Room('GLOBAL', { pub: true, now: t0 });
  assert.equal(room.startAt % 60000, 0);
  room.tick(t0 + 1000, 16);
  assert.equal(room.phase, 'lobby');
  const p = fakePlayer('x');
  room.add(p);
  let now = t0;
  while (room.phase === 'lobby' && now < t0 + 70000) { now += 100; room.tick(now, 100); }
  assert.equal(room.phase, 'countdown');
  assert.ok(room.startAt - now <= 3000);
  assert.equal(nextMinute(59000, 0), 60000);
  assert.equal(cleanName('  <b>Ana</b>  '), 'bAna/b');
});

test('sala: los cambios de perfil llegan a todos en vivo', () => {
  const lobby = new Lobby();
  const room = lobby.create();
  const a = fakePlayer('a'), b = fakePlayer('b');
  room.add(a); room.add(b);
  b.skin = 'singularidad'; b.trail = 'supernova'; b.nameStyle = 'nm-fundador';
  room.profileChanged(b);
  const last = a.inbox.filter(m => m.t === 'room').at(-1);
  const pb = last.players.find(p => p.id === 'b');
  assert.deepEqual([pb.skin, pb.trail, pb.nameStyle], ['singularidad', 'supernova', 'nm-fundador']);
});

test('amigos: presencia en línea e invitación a la sala privada', async () => {
  const { Friends } = await import('../server/friends.js');
  const fr = new Friends(), lobby = new Lobby();
  const a = { ...fakePlayer('a'), name: 'Ana', nameStyle: 'nm-blanco' }, b = { ...fakePlayer('b'), name: 'Beto' };
  a.inbox = []; a.send = s => a.inbox.push(JSON.parse(s));
  b.inbox = []; b.send = s => b.inbox.push(JSON.parse(s));
  fr.register(a, 'AAAAAA'); fr.register(b, 'BBBBBB');
  const pres = fr.presence(['BBBBBB', 'ZZZZZZ', 'mal']);
  assert.deepEqual(pres.map(p => [p.id, p.online]), [['BBBBBB', true], ['ZZZZZZ', false]]);
  assert.ok(fr.invite(a, 'BBBBBB'), 'sin sala privada no se puede invitar');
  const room = lobby.create(); room.add(a); a.room = room;
  assert.equal(fr.invite(a, 'BBBBBB', 10000), null);
  const inv = b.inbox.find(m => m.t === 'invited');
  assert.equal(inv.code, room.code);
  assert.equal(inv.from, 'Ana');
  fr.unregister(b);
  assert.equal(fr.presence(['BBBBBB'])[0].online, false);
});
