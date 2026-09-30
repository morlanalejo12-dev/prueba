// Conexión con el servidor online (WebSocket). Reintenta sola si se corta y estima el
// desfase de reloj con el servidor para mostrar las cuentas regresivas bien.
import { CFG } from '../config.js';

export const PROTOCOL = 1;

// Dónde está el servidor: el mismo sitio si el juego se abrió desde él, o la dirección configurada
export function serverUrl(custom) {
  const raw = (custom || '').trim();
  if (raw) {
    let u = raw.replace(/^http/, 'ws');
    if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
    if (!/\/ws\/?$/.test(u)) u = u.replace(/\/$/, '') + '/ws';
    return u;
  }
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && !/claude|anthropic/.test(location.hostname)) {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  return CFG.ONLINE_URL || '';
}

export class NetClient {
  constructor(onMessage, onStatus) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.ws = null;
    this.status = 'off';      // off | connecting | on | error
    this.offset = 0;          // hora del servidor - hora local (ms)
    this.rtt = 0;
    this.hello = null;
    this.pingT = 0;
  }

  get serverNow() { return Date.now() + this.offset; }

  setStatus(s, msg) { this.status = s; if (this.onStatus) this.onStatus(s, msg); }

  connect(url, hello) {
    this.close();
    this.hello = hello;
    if (!url) { this.setStatus('error', 'Falta la dirección del servidor.'); return; }
    if (typeof WebSocket === 'undefined') { this.setStatus('error', 'Tu navegador no permite el modo online.'); return; }
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.setStatus('error', 'Dirección de servidor inválida.'); return; }
    this.ws = ws;
    this.setStatus('connecting');
    const timeout = setTimeout(() => { if (this.ws === ws && ws.readyState !== 1) { ws.close(); this.setStatus('error', 'No se pudo conectar con el servidor.'); } }, 9000);
    ws.onopen = () => {
      clearTimeout(timeout);
      this.send({ t: 'hello', v: PROTOCOL, ...hello });
      this.ping();
      this.pingT = setInterval(() => this.ping(), 5000);
    };
    ws.onmessage = e => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'welcome') { this.id = m.id; this.offset = m.now - Date.now(); this.setStatus('on'); }
      if (m.t === 'pong') {
        const now = Date.now();
        this.rtt = now - m.c;
        this.offset = m.s + this.rtt / 2 - now;
        return;
      }
      if (m.t === 'room' || m.t === 'start') this.offset = this.offset * 0.7 + (m.now - Date.now()) * 0.3;
      this.onMessage(m);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      clearInterval(this.pingT);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.status === 'connecting') this.setStatus('error', 'No se pudo conectar con el servidor. Revisá la dirección o probá en un rato.');
      else if (this.status !== 'error') this.setStatus('error', 'Se cortó la conexión con el servidor.');
    };
    ws.onerror = () => {};
  }

  ping() { this.send({ t: 'ping', c: Date.now() }); }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  close() {
    clearInterval(this.pingT);
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch (e) { /* nada */ } }
    this.status = 'off';
  }
}
