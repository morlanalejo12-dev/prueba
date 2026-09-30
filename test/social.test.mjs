import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../server/store.js';
import { Friends } from '../server/friends.js';
import { Social } from '../server/social.js';

const client = fid => ({ name: 'J' + fid, nameStyle: 'nm-blanco', skin: 'ambar', lvl: 3, inbox: [], room: null, send(s) { this.inbox.push(JSON.parse(s)); } });

test('solicitudes de amistad: enviar, aceptar, rechazar y eliminar', async () => {
  const fr = new Friends(), so = new Social(new MemoryStore(), fr);
  const a = client('AAAAAA'), b = client('BBBBBB'), c = client('CCCCCC');
  const KA = 'k'.repeat(20), KB = 'q'.repeat(20), KC = 'z'.repeat(20);
  assert.ok(await so.claim('AAAAAA', KA, a));
  assert.ok(await so.claim('BBBBBB', KB, b));
  assert.ok(await so.claim('CCCCCC', KC, c));
  assert.equal(await so.claim('AAAAAA', 'otraclaveotraclave', a), false, 'nadie puede robar un código');
  fr.register(a, 'AAAAAA'); fr.register(b, 'BBBBBB');

  assert.equal(await so.request('AAAAAA', 'ZZZZZZ'), 'No existe un jugador con ese código.');
  assert.equal(await so.request('AAAAAA', 'AAAAAA'), 'Ese es tu propio código.');
  assert.equal(await so.request('AAAAAA', 'BBBBBB'), null);
  assert.ok(await so.request('AAAAAA', 'BBBBBB'), 'no se repite');
  const n = b.inbox.find(m => m.t === 'notif');
  assert.equal(n.kind, 'freq'); assert.equal(n.from.id, 'AAAAAA');
  let sb = await so.state('BBBBBB');
  assert.equal(sb.in.length, 1); assert.equal(sb.friends.length, 0);

  assert.equal(await so.accept('BBBBBB', 'AAAAAA'), null);
  const sa = await so.state('AAAAAA');
  assert.deepEqual(sa.friends.map(f => f.id), ['BBBBBB']);
  assert.equal(sa.friends[0].online, true);
  assert.equal(sa.out.length, 0);
  assert.ok(a.inbox.some(m => m.t === 'notif' && m.kind === 'faccept'));

  // Rechazar
  await so.request('CCCCCC', 'AAAAAA');
  await so.decline('AAAAAA', 'CCCCCC');
  assert.equal((await so.state('AAAAAA')).in.length, 0);
  assert.equal((await so.state('CCCCCC')).out.length, 0);
  // Solicitud cruzada: se aceptan solas
  await so.request('CCCCCC', 'AAAAAA');
  assert.equal(await so.request('AAAAAA', 'CCCCCC'), null);
  assert.equal((await so.state('CCCCCC')).friends.length, 1);
  // Eliminar
  await so.remove('AAAAAA', 'BBBBBB');
  assert.equal((await so.state('BBBBBB')).friends.length, 0);
});
