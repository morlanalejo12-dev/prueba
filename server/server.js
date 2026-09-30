// Servidor de Contracorriente: sirve el juego (dist/site) y el modo online por WebSocket en /ws.
// Uso: npm run build && npm start   (puerto: variable PORT, por defecto 8080)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Lobby, GLOBAL, PROTOCOL, cleanName } from './rooms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'site');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: lobby.rooms.size, players: clients.size }));
    return;
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (file === ROOT || file.endsWith(path.sep)) file = path.join(ROOT, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('No encontrado'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300' });
    res.end(data);
  });
});

const lobby = new Lobby();
const clients = new Map();
let nextId = 1;

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', ws => {
  const id = 'p' + (nextId++).toString(36);
  const me = {
    id, name: 'Jugador', skin: 'ambar', trail: 'basica', nameStyle: 'nm-blanco', room: null,
    send: s => { if (ws.readyState === 1 && ws.bufferedAmount < 1 << 20) ws.send(s); },
  };
  clients.set(id, me);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const leave = () => { if (me.room) { lobby.leave(me.room, id); me.room = null; } };
  const setProfile = m => {
    me.name = cleanName(m.name) || me.name || 'Jugador ' + id.slice(1).toUpperCase();
    if (me.name === 'Jugador') me.name = 'Jugador ' + id.slice(1).toUpperCase();
    me.skin = String(m.skin || me.skin).slice(0, 24);
    me.trail = String(m.trail || me.trail).slice(0, 24);
    me.nameStyle = String(m.nameStyle || me.nameStyle).slice(0, 24);
  };
  const err = msg => me.send(JSON.stringify({ t: 'err', msg }));

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'hello':
        if (m.v !== PROTOCOL) { err('Actualizá el juego: la versión no coincide con el servidor.'); return; }
        setProfile(m);
        me.send(JSON.stringify({ t: 'welcome', id, now: Date.now() }));
        break;
      case 'join': {
        leave();
        let room;
        if (m.create) room = lobby.create();
        else room = lobby.get(m.code || GLOBAL);
        if (!room) { err(m.create ? 'No se pudo crear la sala. Probá de nuevo.' : 'No existe una sala con ese código.'); return; }
        if (!room.add(me)) { err('La sala está llena.'); return; }
        me.room = room;
        break;
      }
      case 'profile':
        if (Date.now() - (me.lastProfile || 0) < 250) return;
        me.lastProfile = Date.now();
        setProfile(m);
        if (me.room) me.room.profileChanged(me);
        break;
      case 'leave': leave(); break;
      case 'start': if (me.room && !me.room.requestStart(id)) err('Solo el anfitrión puede empezar la ronda.'); break;
      case 'in': if (me.room) me.room.input(id, +m.x, +m.y); break;
      case 'dash': if (me.room) me.room.dash(id, +m.d); break;
      case 'ping': me.send(JSON.stringify({ t: 'pong', c: m.c, s: Date.now() })); break;
      default: break;
    }
  });

  ws.on('close', () => { leave(); clients.delete(id); });
});

// Mantener vivas las conexiones (y cerrar las muertas)
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignorar */ }
  }
}, 20000);

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  lobby.tick(now, now - last);
  last = now;
}, 1000 / 60);

server.listen(PORT, () => {
  const has = fs.existsSync(path.join(ROOT, 'index.html'));
  console.log(`Contracorriente online en http://localhost:${PORT}${has ? '' : '  (falta dist/site: corré npm run build)'}`);
});
