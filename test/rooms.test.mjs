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

test('sala global: cola continua, arranca a los 10 s o al juntarse 8', () => {
  const t0 = 1_000_000;
  const room = new Room('GLOBAL', { pub: true, now: t0 });
  room.tick(t0 + 1000, 16);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.startAt, 0, 'sin jugadores no hay cuenta regresiva');
  room.add(fakePlayer('x'));
  room.tick(t0 + 2000, 16);
  assert.equal(room.startAt, t0 + 12000);
  let now = t0 + 2000;
  while (room.phase === 'lobby' && now < t0 + 20000) { now += 100; room.tick(now, 100); }
  assert.equal(room.phase, 'countdown');
  assert.ok(now <= t0 + 9100, 'empieza la cuenta regresiva 3 s antes');
  const full = new Room('GLOBAL', { pub: true, now: t0 });
  for (let i = 0; i < 8; i++) full.add(fakePlayer('p' + i));
  full.tick(t0, 16);
  full.tick(t0 + 16, 16);
  assert.equal(full.phase, 'countdown', 'con 8 jugadores arranca enseguida');
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

test('API: cuenta en la nube, recuperación, tablas y estadísticas', async () => {
  const { makeApi } = await import('../server/api.js');
  const { MemoryStore } = await import('../server/store.js');
  const { Readable } = await import('node:stream');
  const api = makeApi(new MemoryStore());
  const call = async (method, path, body) => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    req.method = method;
    let code = 0, out = '';
    const res = { writeHead: c => { code = c; }, end: s => { out = s; } };
    await api(req, res, new URL(path, 'http://x'));
    return { code, json: JSON.parse(out || '{}') };
  };
  const acc = (await call('POST', '/api/account', {})).json;
  assert.match(acc.id, /^[A-Z0-9]{8}$/);
  assert.equal((await call('PUT', '/api/save', { id: acc.id, secret: acc.secret, save: { xp: 99 } })).json.ok, true);
  assert.equal((await call('PUT', '/api/save', { id: acc.id, secret: 'MAL', save: {} })).code, 401);
  const rest = (await call('POST', '/api/restore', { code: `${acc.id}-${acc.secret}` })).json;
  assert.equal(rest.save.xp, 99);
  assert.equal((await call('POST', '/api/restore', { code: 'AAAAAAAA-BBBB' })).code, 404);
  await call('POST', '/api/score', { board: 'daily-2026-09-30', pid: 'AAAAAA', name: 'Ana', score: 500 });
  await call('POST', '/api/score', { board: 'daily-2026-09-30', pid: 'BBBBBB', name: 'Beto', score: 800 });
  await call('POST', '/api/score', { board: 'daily-2026-09-30', pid: 'AAAAAA', name: 'Ana', score: 300 });
  const b = (await call('GET', '/api/board?b=daily-2026-09-30&ids=AAAAAA')).json;
  assert.equal(b.top[0].name, 'Beto');
  assert.equal(b.ranks.AAAAAA, 2);
  assert.equal(b.top[1].score, 500, 'se guarda el mejor puntaje');
  await call('POST', '/api/events', { device: 'dev1', events: [{ e: 'session' }, { e: 'round', alive: false, fork: 0, why: 'majority' }] });
  const st = (await call('GET', '/api/stats')).json;
  assert.equal(st.dias[0].rounds, 1);
  assert.equal(st.dias[0].deathFork['0'], 1);
  assert.equal(st.jugadores, 1);
});
