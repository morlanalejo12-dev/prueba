// Extrae los textos en español del código (para mantener los diccionarios de traducción).
// Uso: node scripts/i18n-extract.mjs > textos.json
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!p.includes('i18n')) walk(p); } else if (/\.(js|html)$/.test(f)) files.push(p); } })('src');

function literals(src) {
  const out = [];
  let i = 0, prev = '';
  const n = src.length;
  function readTemplate() { // i apunta después de `
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += src[i + 1]; i += 2; continue; }
      if (c === '`') { i++; return s; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2; let depth = 1;
        while (i < n && depth) {
          const d = src[i];
          if (d === '{') depth++;
          else if (d === '}') { depth--; if (!depth) break; }
          else if (d === '`') { i++; out.push(readTemplate()); continue; }
          else if (d === "'" || d === '"') { i++; out.push(readQuoted(d)); continue; }
          i++;
        }
        i++; s += '{}'; continue;
      }
      s += c; i++;
    }
    return s;
  }
  function readQuoted(q) { let s = ''; while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; } i++; return s; }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { i++; out.push(readQuoted(c)); prev = 'v'; continue; }
    if (c === '`') { i++; out.push(readTemplate()); prev = 'v'; continue; }
    if (c === '/') {
      // ¿regex? si lo anterior no es un valor
      if (!/[\w)\]]/.test(prev)) { i++; let cls = false; while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; i++; } i++; while (/[a-z]/.test(src[i] || '')) i++; prev = 'v'; continue; }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

const htmlText = s => s.replace(/<[^>]*>/g, '\n').split('\n').map(x => x.trim()).filter(Boolean);
const WORD = /[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]{2,}/;
function keep(s) {
  s = s.trim();
  if (!WORD.test(s)) return false;
  if (/^(https?:|\.\/|\/|#|data:|M\d|rgba?\(|hsla?\(|var\(|linear-gradient|radial-gradient|translate|scale|cubic-bezier)/.test(s)) return false;
  if (/^[a-z0-9_:.\-]+$/.test(s)) return /[áéíóúñ]/.test(s); // ids y clases
  if (/^[a-z0-9_\-]+( [a-z0-9_\-]+)+$/.test(s)) return false;  // "btn btn-primary"
  if (/^[\w-]+=/.test(s) || /[{};]\s*$/.test(s) && /:/.test(s)) return false;       // CSS
  if (/^(bold|italic|\d+px|[0-9.]+ )/.test(s)) return false;
  if (/^[A-Z_]+$/.test(s)) return false;
  if (/^[a-z]+[A-Z]\w*$/.test(s)) return false;             // camelCase
  return true;
}

const set = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let list;
  if (f.endsWith('.html')) {
    const body = src.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    list = [...htmlText(body), ...[...body.matchAll(/(?:placeholder|aria-label|title|content)="([^"]+)"/g)].map(m => m[1])];
  } else list = literals(src).flatMap(s => (/<[a-z]/i.test(s) ? htmlText(s) : [s]));
  for (let s of list) { s = s.trim(); if (keep(s) && !set.has(s)) set.set(s, f); }
}
console.log(JSON.stringify([...set.keys()], null, 0));
