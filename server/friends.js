// Amigos: cada jugador tiene un código de amigo (6 caracteres) que guarda en su dispositivo.
// El servidor solo sabe quién está conectado ahora y reenvía invitaciones a salas privadas.
export const FRIEND_RE = /^[A-Z0-9]{6}$/;

export class Friends {
  constructor() { this.byFid = new Map(); }

  register(client, fid) {
    if (!FRIEND_RE.test(fid || '')) return;
    if (client.friendId && this.byFid.get(client.friendId) === client) this.byFid.delete(client.friendId);
    client.friendId = fid;
    this.byFid.set(fid, client);
  }

  unregister(client) {
    if (client.friendId && this.byFid.get(client.friendId) === client) this.byFid.delete(client.friendId);
  }

  presence(ids) {
    const list = [];
    for (const id of (Array.isArray(ids) ? ids : []).slice(0, 100)) {
      if (!FRIEND_RE.test(id)) continue;
      const c = this.byFid.get(id);
      list.push(c
        ? { id, online: true, name: c.name, skin: c.skin, nameStyle: c.nameStyle, room: c.room ? c.room.code : null }
        : { id, online: false });
    }
    return list;
  }

  // Invitar a un amigo a tu sala privada
  invite(from, toFid, now = Date.now()) {
    if (!from.room || from.room.pub) return 'Creá una sala privada para invitar.';
    if (now - (from.lastInvite || 0) < 800) return 'Esperá un momento antes de invitar de nuevo.';
    const to = this.byFid.get(toFid);
    if (!to) return 'Tu amigo no está conectado.';
    from.lastInvite = now;
    to.send(JSON.stringify({ t: 'invited', from: from.name, fromId: from.friendId, nameStyle: from.nameStyle, code: from.room.code }));
    return null;
  }
}
