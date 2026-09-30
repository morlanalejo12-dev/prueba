// Íconos SVG en línea y emblemas de liga.
import { TIERS } from '../game/ranks.js';

export const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  coin: '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l7.5 9.5-7.5 9.5L4.5 12z" fill="currentColor" stroke="none"/><path d="M12 6.5l4.3 5.5L12 17.5 7.7 12z" fill="#fff" fill-opacity="0.35" stroke="none"/></svg>',
  gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l7-7M16 5h3v3"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-4.3-4-6.3-4.5-10.3-2.6 1.8-4 4.4-3.6 7.2C9 10.8 8.3 9.6 8 8.3 6.3 9.9 5.5 12.2 5.5 14.8 5.5 18.4 8 21 12 21z"/></svg>',
  swords: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l9 9M4 4v4M4 4h4M20 4l-9 9M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3M9 15l-2 2M15 15l2 2"/></svg>',
};

const INNER = [
  '<path d="M16 26l8-6 8 6"/>',
  '<path d="M16 22l8-6 8 6M16 30l8-6 8 6"/>',
  '<path d="M16 19l8-6 8 6M16 26l8-6 8 6M16 33l8-6 8 6"/>',
  '<path d="M24 13l8 11-8 11-8-11z"/>',
  '<path d="M16 19h16l4 6-12 12-12-12z"/><path d="M16 19l8 18 8-18"/>',
  '<path d="M24 12.5l3.3 6.7 7.4 1.1-5.4 5.2 1.3 7.3L24 29.3l-6.6 3.5 1.3-7.3-5.4-5.2 7.4-1.1z"/>',
  '<path d="M14 32l2-14 5 6 3-9 3 9 5-6 2 14z"/>',
];

export function emblem(tier, size = 44) {
  const c = TIERS[tier].col;
  return `<svg class="emblem" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">`
    + `<path d="M24 3l18 7v13c0 11-7.6 19.4-18 22C13.6 42.4 6 34 6 23V10z" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="2"/>`
    + `<g fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${INNER[tier]}</g></svg>`;
}

// Vista previa de una estela con CSS
export function trailPreview(tr, skinCol = '#ffb547') {
  const el = document.createElement('i');
  el.className = 'tr tr-' + tr.type;
  el.style.setProperty('--c', tr.col || skinCol);
  el.style.setProperty('--c2', tr.col2 || tr.col || skinCol);
  return el;
}

// Vista previa de una skin con CSS (forma + colores)
export function skinPreview(sk) {
  const el = document.createElement('i');
  el.className = 'sk sk-' + sk.shape;
  el.style.setProperty('--c', sk.col || '#ff7ad9');
  el.style.setProperty('--c2', sk.col2 || sk.col || '#8fd8ff');
  if (!sk.col) el.classList.add('sk-rainbow');
  return el;
}

// Nombre con su estilo (color, degradado o efecto)
export function nameTag(text, style) {
  const el = document.createElement('span');
  el.className = 'nm nm-' + style.fx;
  el.textContent = text;
  el.dataset.text = text;
  style.cols.forEach((c, i) => el.style.setProperty('--c' + (i + 1), c));
  return el;
}

// Ícono de nota musical para los temas
export const MUSIC_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';

// Distintivo de nivel de cuenta. deco=true dibuja solo los adornos (para rodear el anillo del perfil).
// Cada 10 niveles suma algo: olas, más olas, rayos, gema, corona y, en el 120, un halo animado.
export function levelEmblem(level, badge, size = 44, deco = false) {
  const t = badge.tier, c = badge.col, gold = '#ffd166';
  const gid = 'lg' + t + (deco ? 'd' : '') + Math.random().toString(36).slice(2, 7);
  const stroke = t >= 10 ? `url(#${gid})` : c;
  let s = `<svg class="lvl-emblem${t >= 12 ? ' lb-max' : ''}" viewBox="0 0 60 60" width="${size}" height="${size}" aria-hidden="true">`;
  s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold}"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="${t >= 11 ? '#8fd8ff' : gold}"/></linearGradient></defs>`;
  // Olas a los costados (1 a 3 pares)
  const waves = t >= 1 ? Math.min(3, 1 + Math.floor((t - 1) / 3)) : 0;
  for (let i = 0; i < waves; i++) {
    const y = 44 - i * 7, w = 1.8;
    s += `<path d="M${9 - i} ${y} q4 -6 8 0" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
    s += `<path d="M${43 + i} ${y} q4 -6 8 0" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  // Rayos
  if (t >= 4) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 + Math.PI / 8, r1 = 24, r2 = 28;
      s += `<line x1="${30 + Math.cos(a) * r1}" y1="${30 + Math.sin(a) * r1}" x2="${30 + Math.cos(a) * r2}" y2="${30 + Math.sin(a) * r2}" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  // Gema o corona arriba
  if (t >= 10) s += `<path d="M20 9 L22 2 L26 6 L30 0 L34 6 L38 2 L40 9 Z" fill="url(#${gid})" stroke="#fff4" stroke-width="0.6"/>`;
  else if (t >= 7) s += `<path d="M30 1 L35 6 L30 11 L25 6 Z" fill="${c}"/>`;
  // Halo máximo
  if (t >= 12) s += `<circle class="lb-halo" cx="30" cy="30" r="27" fill="none" stroke="url(#${gid})" stroke-width="1.2" stroke-dasharray="3 4"/>`;
  if (!deco) {
    s += `<circle cx="30" cy="30" r="17" fill="#120e2a" stroke="${stroke}" stroke-width="${2 + t * 0.15}"/>`;
    s += `<text stroke="none" x="30" y="35" text-anchor="middle" font-size="${level >= 100 ? 13 : 15}" font-weight="800" fill="${t >= 10 ? gold : c}" font-family="system-ui, sans-serif">${level}</text>`;
  }
  return s + '</svg>';
}
