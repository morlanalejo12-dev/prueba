// Traducción de la interfaz. El juego se escribe en español; al elegir otro idioma, este módulo
// traduce cada texto que aparece en pantalla (y lo que se dibuja en el canvas) usando el diccionario.
//  - Coincidencia exacta: "Jugar" → "Jogar".
//  - Con partes variables: "Nivel {}" traduce "Nivel 12"; cada parte variable también se traduce
//    si está en el diccionario (por ejemplo "5 jugadores" → "5 jogadores").
//  - Los elementos con data-noi18n (nombres de jugadores, países) no se tocan.
import { DICT } from './dict.js';

const IDX = { pt: 0, en: 1 };
let lang = 'es';
let exact = null;          // Map español → traducción
let patterns = [];         // [{ re, out }]
const cache = new Map();
const LETTER = /[A-Za-zÁÉÍÓÚáéíóúñÑüÜ]/;

function build(l) {
  const i = IDX[l];
  exact = new Map();
  patterns = [];
  if (i === undefined) { exact = null; return; }
  for (const [es, tr] of Object.entries(DICT)) {
    const out = tr[i];
    if (out === undefined || out === null) continue;
    if (es.includes('{}')) {
      // Solo si queda texto fijo suficiente (evita que "{} {}" coincida con cualquier cosa)
      if (es.replace(/\{\}/g, '').replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, '').length < 2) continue;
      const re = new RegExp('^' + es.split('{}').map(p => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 's');
      patterns.push({ re, out, n: (es.match(/\{\}/g) || []).length });
    } else exact.set(es, out);
  }
  // Primero los patrones más largos (más específicos)
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
}

// Traduce un texto (conserva los espacios de los bordes)
export function t(s) {
  if (!exact || typeof s !== 'string' || !LETTER.test(s)) return s;
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  const core = m[2];
  let out = exact.get(core);
  if (out === undefined) {
    for (const p of patterns) {
      const r = p.re.exec(core);
      if (!r) continue;
      const parts = r.slice(1).map(x => t(x));
      let k = 0;
      // {1} {2} permiten cambiar el orden; {} va en orden
      out = p.out.replace(/\{(\d?)\}/g, (_, d) => (d ? parts[+d - 1] : parts[k++]) ?? '');
      break;
    }
  }
  // Textos compuestos con " · " o " + ": se traduce cada parte
  if (out === undefined) {
    if (core.startsWith('· ')) { const r = t(core.slice(2)); if (r !== core.slice(2)) out = '· ' + r; }
    if (out === undefined) for (const sep of [' · ', ' + ']) {
      if (!core.includes(sep)) continue;
      const parts = core.split(sep), tp = parts.map(x => t(x));
      if (tp.some((x, i) => x !== parts[i])) { out = tp.join(sep); break; }
    }
  }
  // Varias oraciones juntas: se traduce cada una
  if (out === undefined && /[.!?] \S/.test(core)) {
    const parts = core.split(/(?<=[.!?]) (?=\S)/);
    if (parts.length > 1) { const tp = parts.map(x => t(x)); if (tp.some((x, i) => x !== parts[i])) out = tp.join(' '); }
  }
  const res = out === undefined ? s : m[1] + out + m[3];
  if (cache.size > 8000) cache.clear();
  cache.set(s, res);
  if (out === undefined && typeof window !== 'undefined' && window.__i18nMiss) window.__i18nMiss.add(core);
  return res;
}

export const getLang = () => lang;

// ---------- DOM ----------
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const textSrc = new WeakMap();   // nodo de texto → { src, out }
const attrSrc = new WeakMap();   // elemento → { attr: { src, out } }

function skip(node) {
  const e = node.nodeType === 1 ? node : node.parentElement;
  if (!e) return true;
  if (e.closest('script,style,[data-noi18n]')) return true;
  return false;
}
function doText(node) {
  const cur = node.data;
  const rec = textSrc.get(node);
  const src = rec && cur === rec.out ? rec.src : cur;
  const out = t(src);
  textSrc.set(node, { src, out });
  if (out !== cur) node.data = out;
}
function doAttrs(e) {
  let rec = attrSrc.get(e);
  for (const a of ATTRS) {
    if (!e.hasAttribute(a)) continue;
    const cur = e.getAttribute(a);
    if (!rec) { rec = {}; attrSrc.set(e, rec); }
    const r = rec[a];
    const src = r && cur === r.out ? r.src : cur;
    const out = t(src);
    rec[a] = { src, out };
    if (out !== cur) e.setAttribute(a, out);
  }
}
function walk(root) {
  if (root.nodeType === 3) { if (!skip(root)) doText(root); return; }
  if (root.nodeType !== 1 || skip(root)) return;
  doAttrs(root);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === 1 && n.matches('script,style,[data-noi18n]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = it.nextNode();
  while (n) { if (n.nodeType === 3) doText(n); else doAttrs(n); n = it.nextNode(); }
}

let observer = null;
function observe() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') { if (!skip(m.target)) doText(m.target); }
      else if (m.type === 'attributes') { if (!skip(m.target)) doAttrs(m.target); }
      else for (const n of m.addedNodes) walk(n);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// Texto dibujado en el canvas (HUD del túnel, carteles, tarjeta para compartir)
let canvasPatched = false;
function patchCanvas() {
  if (canvasPatched || typeof CanvasRenderingContext2D === 'undefined') return;
  canvasPatched = true;
  const P = CanvasRenderingContext2D.prototype;
  for (const fn of ['fillText', 'strokeText', 'measureText']) {
    const orig = P[fn];
    P[fn] = function (text, ...rest) { return orig.call(this, typeof text === 'string' ? t(text) : text, ...rest); };
  }
}

let baseTitle = null;
export function setLang(l) {
  lang = ['es', 'pt', 'en'].includes(l) ? l : 'es';
  build(lang);
  cache.clear();
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  // En español no hace falta nada, salvo que antes se haya traducido algo
  if (lang === 'es' && !observer) return;
  if (baseTitle === null) baseTitle = document.title;
  document.title = t(baseTitle);
  patchCanvas();
  observe();
  walk(document.body);
}
