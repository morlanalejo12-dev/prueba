// Amigos con solicitudes: se guardan en el servidor para que lleguen aunque el otro esté desconectado.
// Cada código de amigo se protege con una clave que solo tiene su dueño (la primera que lo usa).
import { sha } from './accounts.js';
import { FRIEND_RE } from './friends.js';

const MAX_FRIENDS = 200, MAX_PENDING = 50;
const empty = () => ({ friends: [], in: [], out: [] });
const without = (list, id) => list.filter(x => (x.id || x) !== id);

export class Social {
  constructor(store, friends) { this.store = store; this.friends = friends; }

  // Verifica (o reclama) el código de amigo con su clave y actualiza el perfil público
  async claim(fid, key, prof) {
    if (!FRIEND_RE.test(fid || '') || !/^[A-Za-z0-9]{16,40}$/.test(key || '')) return false;
    const rec = await this.store.get('fid', fid);
    if (rec && rec.h !== sha(key)) return false;
    const next = { h: sha(key), name: prof.name, nameStyle: prof.nameStyle, skin: prof.skin, lvl: prof.lvl || 1, seen: Date.now() };
    if (!rec || rec.name !== next.name || rec.nameStyle !== next.nameStyle || rec.skin !== next.skin || rec.lvl !== next.lvl || Date.now() - (rec.seen || 0) > 3600e3) await this.store.set('fid', fid, next);
    return true;
  }

  async get(fid) { return { ...empty(), ...((await this.store.get('social', fid)) || {}) }; }
  async put(fid, s) { await this.store.set('social', fid, s); }

  async profile(fid) {
    const p = await this.store.get('fid', fid);
    return p ? { id: fid, name: p.name || 'Jugador', nameStyle: p.nameStyle || 'nm-blanco', skin: p.skin, lvl: p.lvl || 1 } : { id: fid, name: 'Jugador' };
  }

  // Estado completo para el jugador: amigos (con conexión), solicitudes recibidas y enviadas
  async state(fid) {
    const s = await this.get(fid);
    const live = id => {
      const c = this.friends.byFid.get(id);
      return c ? { online: true, name: c.name, nameStyle: c.nameStyle, skin: c.skin, room: c.room && !c.room.pub ? c.room.code : c.room ? 'GLOBAL' : null } : { online: false };
    };
    const friends = await Promise.all(s.friends.map(async id => ({ ...(await this.profile(id)), ...live(id) })));
    const inc = await Promise.all(s.in.map(async r => ({ ...(await this.profile(r.id)), at: r.at })));
    const out = await Promise.all(s.out.map(async r => ({ ...(await this.profile(r.id)), at: r.at })));
    return { t: 'social', friends, in: inc, out };
  }

  // Manda el estado actualizado a quien esté conectado con ese código
  async push(fid, extra) {
    const c = this.friends.byFid.get(fid);
    if (!c) return;
    c.send(JSON.stringify(await this.state(fid)));
    if (extra) c.send(JSON.stringify(extra));
  }

  async request(from, to) {
    if (!FRIEND_RE.test(to || '')) return 'El código tiene 6 letras o números.';
    if (from === to) return 'Ese es tu propio código.';
    if (!(await this.store.get('fid', to))) return 'No existe un jugador con ese código.';
    const a = await this.get(from), b = await this.get(to);
    if (a.friends.includes(to)) return 'Ya son amigos.';
    if (a.out.some(r => r.id === to)) return 'Ya le mandaste una solicitud.';
    // Si el otro ya te había mandado una, se aceptan las dos
    if (a.in.some(r => r.id === to)) return this.accept(from, to);
    if (a.friends.length >= MAX_FRIENDS) return 'Llegaste al máximo de amigos.';
    if (b.in.length >= MAX_PENDING) return 'Ese jugador tiene demasiadas solicitudes pendientes.';
    const at = Date.now();
    a.out = [...a.out, { id: to, at }].slice(-MAX_PENDING);
    b.in = [...b.in, { id: from, at }];
    await this.put(from, a);
    await this.put(to, b);
    const p = await this.profile(from);
    await this.push(to, { t: 'notif', kind: 'freq', from: p });
    return null;
  }

  async accept(me, id) {
    const a = await this.get(me), b = await this.get(id);
    if (!a.in.some(r => r.id === id)) return 'Esa solicitud ya no existe.';
    a.in = without(a.in, id); b.out = without(b.out, me);
    a.out = without(a.out, id); b.in = without(b.in, me);
    if (!a.friends.includes(id)) a.friends = [...a.friends, id].slice(-MAX_FRIENDS);
    if (!b.friends.includes(me)) b.friends = [...b.friends, me].slice(-MAX_FRIENDS);
    await this.put(me, a);
    await this.put(id, b);
    await this.push(id, { t: 'notif', kind: 'faccept', from: await this.profile(me) });
    return null;
  }

  async decline(me, id) {
    const a = await this.get(me), b = await this.get(id);
    a.in = without(a.in, id); b.out = without(b.out, me);
    await this.put(me, a);
    await this.put(id, b);
    await this.push(id);
    return null;
  }

  async cancel(me, id) {
    const a = await this.get(me), b = await this.get(id);
    a.out = without(a.out, id); b.in = without(b.in, me);
    await this.put(me, a);
    await this.put(id, b);
    await this.push(id);
    return null;
  }

  async remove(me, id) {
    const a = await this.get(me), b = await this.get(id);
    a.friends = a.friends.filter(x => x !== id); b.friends = b.friends.filter(x => x !== me);
    await this.put(me, a);
    await this.put(id, b);
    await this.push(id);
    return null;
  }

  // Avisar a los amigos conectados cuando alguien entra o sale (para la lista en vivo)
  async announce(fid) {
    const s = await this.get(fid);
    for (const id of s.friends) if (this.friends.byFid.has(id)) await this.push(id);
  }
}
