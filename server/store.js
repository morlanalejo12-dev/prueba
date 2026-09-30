// Almacenamiento clave/valor del servidor (cuentas, tablas y estadísticas).
//  - Si existen SUPABASE_URL y SUPABASE_KEY, usa una tabla "kv" en Supabase (persistente).
//    SQL: create table kv (ns text, key text, value jsonb, updated timestamptz default now(), primary key (ns, key));
//  - Si no, guarda en un archivo JSON (DATA_DIR, por defecto ./data). En el plan gratis de
//    Render ese disco se borra en cada despliegue: sirve para probar, no para producción.
import fs from 'node:fs';
import path from 'node:path';

export class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'store.json');
    fs.mkdirSync(dir, { recursive: true });
    try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.data = {}; }
    this.timer = null;
  }
  ns(n) { return this.data[n] || (this.data[n] = {}); }
  async get(n, k) { return this.ns(n)[k] ?? null; }
  async set(n, k, v) { this.ns(n)[k] = v; this.flush(); }
  async del(n, k) { delete this.ns(n)[k]; this.flush(); }
  async list(n) { return Object.entries(this.ns(n)).map(([key, value]) => ({ key, value })); }
  flush() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const tmp = this.file + '.tmp';
      fs.writeFile(tmp, JSON.stringify(this.data), err => { if (!err) fs.rename(tmp, this.file, () => {}); });
    }, 500);
  }
}

// Memoria (para tests)
export class MemoryStore {
  constructor() { this.data = {}; }
  ns(n) { return this.data[n] || (this.data[n] = {}); }
  async get(n, k) { return this.ns(n)[k] ?? null; }
  async set(n, k, v) { this.ns(n)[k] = v; }
  async del(n, k) { delete this.ns(n)[k]; }
  async list(n) { return Object.entries(this.ns(n)).map(([key, value]) => ({ key, value })); }
}

export class SupabaseStore {
  constructor(url, key) {
    this.url = url.replace(/\/$/, '') + '/rest/v1/kv';
    this.h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }
  async get(n, k) {
    const r = await fetch(`${this.url}?ns=eq.${encodeURIComponent(n)}&key=eq.${encodeURIComponent(k)}&select=value`, { headers: this.h });
    const rows = r.ok ? await r.json() : [];
    return rows.length ? rows[0].value : null;
  }
  async set(n, k, v) {
    await fetch(this.url, { method: 'POST', headers: { ...this.h, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ ns: n, key: k, value: v, updated: new Date().toISOString() }) });
  }
  async del(n, k) {
    await fetch(`${this.url}?ns=eq.${encodeURIComponent(n)}&key=eq.${encodeURIComponent(k)}`, { method: 'DELETE', headers: this.h });
  }
  async list(n) {
    const r = await fetch(`${this.url}?ns=eq.${encodeURIComponent(n)}&select=key,value`, { headers: this.h });
    return r.ok ? r.json() : [];
  }
}

export function makeStore() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) return new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return new FileStore(process.env.DATA_DIR || path.resolve('data'));
}
