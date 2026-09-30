// Cuentas: invitado (código de recuperación), email + contraseña y Google.
// Una cuenta guarda: hashes de sus claves de sesión, el progreso, y lo comprado (entitlements).
import crypto from 'node:crypto';

const ID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const rid = n => Array.from(crypto.randomBytes(n), b => ID_CHARS[b % ID_CHARS.length]).join('');
export const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const MAX_SESSIONS = 8;

export const normEmail = e => String(e || '').trim().toLowerCase();
export const validEmail = e => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, rec) {
  if (!rec) return false;
  const h = crypto.scryptSync(String(pw), rec.salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
}

export class Accounts {
  constructor(store) { this.store = store; }

  async get(id) { return /^[A-Z0-9]{8}$/.test(id || '') ? this.store.get('acct', id) : null; }
  async put(id, acct) { acct.updated = Date.now(); await this.store.set('acct', id, acct); }

  // Autentica con el id y un secreto de sesión (o el código de recuperación)
  async auth(id, secret) {
    const acct = await this.get(id);
    if (!acct || !secret) return null;
    const h = sha(secret), list = acct.hs || (acct.h ? [acct.h] : []);
    return list.includes(h) ? acct : null;
  }

  // Nueva clave de sesión para un dispositivo
  addSession(acct) {
    const secret = rid(12);
    acct.hs = [...(acct.hs || (acct.h ? [acct.h] : [])), sha(secret)].slice(-MAX_SESSIONS);
    delete acct.h;
    return secret;
  }

  async createGuest() {
    const id = rid(8), acct = { save: null, created: Date.now(), ent: { pass: false, items: {} } };
    const secret = this.addSession(acct);
    await this.put(id, acct);
    return { id, secret };
  }

  // Registro con email. Si viene una cuenta de invitado (id + secret), se le agrega el email.
  async register({ email, password, id, secret, name }) {
    email = normEmail(email);
    if (!validEmail(email)) return { error: 'Email inválido.' };
    if (String(password || '').length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' };
    if (await this.store.get('email', email)) return { error: 'Ya existe una cuenta con ese email. Iniciá sesión.' };
    let acct = id && secret ? await this.auth(id, secret) : null;
    if (acct && acct.email) acct = null;
    if (!acct) { id = rid(8); acct = { save: null, created: Date.now(), ent: { pass: false, items: {} } }; }
    acct.email = email;
    acct.pw = hashPassword(password);
    if (name) acct.name = String(name).slice(0, 16);
    const s = this.addSession(acct);
    await this.put(id, acct);
    await this.store.set('email', email, id);
    return { id, secret: s, email, save: acct.save, ent: acct.ent };
  }

  async login({ email, password }) {
    email = normEmail(email);
    const id = await this.store.get('email', email);
    const acct = id ? await this.get(id) : null;
    if (!acct || !checkPassword(password, acct.pw)) return { error: 'Email o contraseña incorrectos.' };
    const secret = this.addSession(acct);
    await this.put(id, acct);
    return { id, secret, email, save: acct.save, ent: acct.ent };
  }

  // Google: el token lo verifica Google (tokeninfo) y se comprueba que sea para nuestra app
  async google({ credential, id, secret }, clientId, fetchImpl = fetch) {
    if (!clientId) return { error: 'El inicio con Google no está configurado.' };
    const r = await fetchImpl('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential || ''));
    const info = r.ok ? await r.json() : null;
    if (!info || info.aud !== clientId || !info.sub || String(info.email_verified) !== 'true') return { error: 'No se pudo verificar tu cuenta de Google.' };
    let accId = await this.store.get('google', info.sub);
    let acct = accId ? await this.get(accId) : null;
    if (!acct) {
      // Si el email ya tiene cuenta, se vincula; si no, se usa la de invitado o una nueva
      const byEmail = info.email ? await this.store.get('email', normEmail(info.email)) : null;
      if (byEmail) { accId = byEmail; acct = await this.get(byEmail); }
      else if (id && secret && (acct = await this.auth(id, secret)) && !acct.google && !acct.email) accId = id;
      else { accId = rid(8); acct = { save: null, created: Date.now(), ent: { pass: false, items: {} } }; }
      acct.google = info.sub;
      if (!acct.email && info.email) { acct.email = normEmail(info.email); await this.store.set('email', acct.email, accId); }
      await this.store.set('google', info.sub, accId);
    }
    const s = this.addSession(acct);
    await this.put(accId, acct);
    return { id: accId, secret: s, email: acct.email, save: acct.save, ent: acct.ent };
  }

  async changePassword({ id, secret, password }) {
    const acct = await this.auth(id, secret);
    if (!acct || !acct.email) return { error: 'Cuenta inválida.' };
    if (String(password || '').length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' };
    acct.pw = hashPassword(password);
    await this.put(id, acct);
    return { ok: true };
  }

  // Cerrar sesión: se invalida la clave de ese dispositivo
  async logout({ id, secret }) {
    const acct = await this.auth(id, secret);
    if (!acct) return { ok: true };
    acct.hs = (acct.hs || []).filter(h => h !== sha(secret));
    await this.put(id, acct);
    return { ok: true };
  }

  // Olvidé mi contraseña: token de un solo uso válido 30 minutos
  async resetRequest(email) {
    email = normEmail(email);
    const id = await this.store.get('email', email);
    if (!id) return null;
    const token = rid(24);
    await this.store.set('reset', sha(token), { id, until: Date.now() + 30 * 60000 });
    return { token, email };
  }

  async resetConfirm({ token, password }) {
    if (String(password || '').length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' };
    const r = await this.store.get('reset', sha(token || ''));
    if (!r || r.until < Date.now()) return { error: 'El enlace venció o ya se usó. Pedí uno nuevo.' };
    await this.store.del('reset', sha(token));
    const acct = await this.get(r.id);
    if (!acct) return { error: 'La cuenta ya no existe.' };
    acct.pw = hashPassword(password);
    acct.hs = [];                       // por seguridad, se cierran todas las sesiones
    const secret = this.addSession(acct);
    await this.put(r.id, acct);
    return { id: r.id, secret, email: acct.email, save: acct.save, ent: acct.ent };
  }

  // Eliminar la cuenta y todos sus datos (derecho de supresión)
  async remove({ id, secret }) {
    const acct = await this.auth(id, secret);
    if (!acct) return { error: 'Cuenta inválida.' };
    if (acct.email) await this.store.del('email', acct.email);
    if (acct.google) await this.store.del('google', acct.google);
    await this.store.del('acct', id);
    return { ok: true };
  }

  async grant(id, item) {
    const acct = await this.get(id);
    if (!acct) return false;
    acct.ent = acct.ent || { pass: false, items: {} };
    if (item === 'pass') acct.ent.pass = true;
    else acct.ent.items[item] = true;
    await this.put(id, acct);
    return true;
  }
}

export { checkPassword, hashPassword };
