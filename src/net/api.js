// Cliente de la API HTTP del servidor (cuentas, tablas y estadísticas).
// Si no hay servidor o conexión, todo falla en silencio: el juego sigue funcionando local.
import { serverUrl } from './client.js';

export function apiBase(custom) {
  const ws = serverUrl(custom);
  return ws ? ws.replace(/^ws/, 'http').replace(/\/ws\/?$/, '') : '';
}

async function call(base, method, path, body, ms = 8000) {
  if (!base) throw new Error('sin servidor');
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl && setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(base + path, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined, signal: ctl && ctl.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.error || 'error'), { status: res.status });
    return json;
  } finally { if (t) clearTimeout(t); }
}

export const Api = base => ({
  createAccount: () => call(base, 'POST', '/api/account', {}),
  uploadSave: (id, secret, save) => call(base, 'PUT', '/api/save', { id, secret, save }),
  restore: code => call(base, 'POST', '/api/restore', { code }),
  submitScore: data => call(base, 'POST', '/api/score', data),
  board: (b, ids) => call(base, 'GET', `/api/board?b=${encodeURIComponent(b)}&ids=${ids.join(',')}`),
  events: (device, events) => call(base, 'POST', '/api/events', { device, events }, 5000),
  config: () => call(base, 'GET', '/api/config', null, 25000),
  register: data => call(base, 'POST', '/api/register', data, 25000),
  login: data => call(base, 'POST', '/api/login', data, 25000),
  google: data => call(base, 'POST', '/api/google', data, 25000),
  me: (id, secret) => call(base, 'POST', '/api/me', { id, secret }),
  logout: (id, secret) => call(base, 'POST', '/api/logout', { id, secret }),
  remove: (id, secret) => call(base, 'POST', '/api/delete', { id, secret }),
  password: (id, secret, password) => call(base, 'POST', '/api/password', { id, secret, password }),
  resetRequest: email => call(base, 'POST', '/api/reset/request', { email }),
  resetConfirm: (token, password) => call(base, 'POST', '/api/reset/confirm', { token, password }),
  checkout: (id, secret, item) => call(base, 'POST', '/api/pay/checkout', { id, secret, item }, 20000),
});
