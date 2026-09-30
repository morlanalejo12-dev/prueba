// Dibujo del mundo en canvas 2D. Lee el estado de la ronda y de los efectos; no lo modifica.
// El fondo cambia de paleta en cada bifurcación superada y late con la música.
import { CFG } from '../config.js';
import { clamp, fmt, TAU } from '../util/math.js';
import { hash01 } from '../util/rng.js';
import { gapsAt, altOpen, altPhase } from '../sim/gates.js';
import { orbTier, ORB_TIERS } from '../sim/level.js';
import { SHAPE } from './fx.js';
import { skinById, trailById } from '../game/skins.js';
import { nameStyleById } from '../game/names.js';
import { drawName } from './names.js';

const G = new Float64Array(4);

// Color principal de una skin (las arcoíris cambian con el tiempo)
export const skinColor = (sk, t) => sk.col || `hsl(${Math.round((t * 90) % 360)} 95% 68%)`;

// Paletas por etapa: el túnel se enciende a medida que avanza la ronda. La última es la muerte súbita.
const THEMES = [
  { bg: '#151036', wall: '#7b6bff', glow: '#cbbfff', neb: '#6a4dff' },
  { bg: '#0f1a3d', wall: '#4f8dff', glow: '#9fd0ff', neb: '#2f6bff' },
  { bg: '#0b2830', wall: '#2fd6b0', glow: '#9ff5dd', neb: '#18b894' },
  { bg: '#26103a', wall: '#c75cff', glow: '#f0b8ff', neb: '#a23dff' },
  { bg: '#361025', wall: '#ff4f8b', glow: '#ffb3cf', neb: '#ff2d75' },
  { bg: '#33200a', wall: '#ffae3d', glow: '#ffe2a8', neb: '#ff8a1f' },
  { bg: '#2a060c', wall: '#ff2d55', glow: '#ffd166', neb: '#ff1f3d' },
];
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const THEME_RGB = THEMES.map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, hexRgb(v)])));
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// Paleta Fundador: oro → rojo → magenta → violeta → cian y vuelta (nunca pasa por el verde)
function novaHue(v) {
  const f = v - Math.floor(v), s = f < 0.5 ? f * 2 : 2 - f * 2;
  return (405 - s * 215) % 360;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.aMul = 1;       // opacidad extra al dibujar a otros jugadores
    this.cx = canvas.getContext('2d', { alpha: false });
    const css = getComputedStyle(document.documentElement);
    const tok = n => css.getPropertyValue(n).trim();
    this.C = {
      ink: tok('--ink'), ink2: tok('--ink-2'), wall: tok('--wall'), grid: tok('--grid'), crowd: tok('--crowd'),
      spark: tok('--spark'), danger: tok('--danger'), gold: tok('--gold'), text: tok('--text'), muted: tok('--muted'),
      mint: tok('--mint'),
    };
    this.FD = tok('--f-display');
    this.FM = tok('--f-mono');
    this.FB = tok('--f-body');
    this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Paleta actual (se interpola hacia la de la etapa) y efectos de fondo
    this.th = { bg: [...THEME_RGB[0].bg], wall: [...THEME_RGB[0].wall], glow: [...THEME_RGB[0].glow], neb: [...THEME_RGB[0].neb] };
    this.stage = 0;
    this.pulse = 0;
    this.stageFlash = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = window.innerWidth;
    this.ch = window.innerHeight;
    this.cv.width = Math.round(this.cw * this.dpr);
    this.cv.height = Math.round(this.ch * this.dpr);
    this.scale = Math.min(this.cw / CFG.W, this.ch / 600);
    this.offX = (this.cw - CFG.W * this.scale) / 2;
    this.viewH = this.ch / this.scale;
  }

  // Convierte una coordenada de pantalla a coordenada lógica del túnel
  toWorldX(clientX) { return (clientX - this.offX) / this.scale; }

  beat(strength = 1) { this.pulse = Math.max(this.pulse, strength); }

  setStage(n) {
    n = clamp(n, 0, THEMES.length - 1);
    if (n > this.stage) this.stageFlash = 1;
    this.stage = n;
  }

  updateTheme(dt) {
    this.time += dt;
    const target = THEME_RGB[this.stage], k = Math.min(1, dt * 2.2);
    for (const key of ['bg', 'wall', 'glow', 'neb']) {
      const a = this.th[key], b = target[key];
      for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k;
    }
    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    this.stageFlash = Math.max(0, this.stageFlash - dt * 0.9);
    this.wallCol = rgb(this.th.wall);
    this.glowCol = rgb(this.th.glow);
  }

  draw(R, fx, opts) {
    const { cx, C, dpr, scale } = this;
    const { W, WALL } = CFG;
    this.updateTheme(opts.dt || 0.016);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fuera del túnel (pantallas anchas): el mismo tono, más oscuro
    cx.fillStyle = rgb(this.th.bg.map(v => v * 0.45));
    cx.fillRect(0, 0, this.cw, this.ch);
    if (!R) return;

    const sh = this.reduceMotion ? 0 : fx.shake(9);
    cx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (this.offX + sh * scale), 0);
    const camY = R.pY - this.viewH * CFG.PLAYER_FRAC;
    const Y = y => y - camY;
    const viewH = this.viewH;

    this.drawBackdrop(R, camY);
    this.drawWalls(viewH);

    for (const f of R.lvl.forks) if (f.endY + 400 > camY && f.entryY - 60 < camY + viewH) this.drawFork(R, f, Y);
    for (const g of R.lvl.gates) {
      const gy = Y(g.y);
      if (gy > -30 && gy < viewH + 30) this.drawGate(g, R.t, gy);
    }
    this.drawOrbs(R, Y);

    const f = R.fork;
    const fogOn = !!(f && f.variant === 'fog' && R.pY >= f.startY - 100 && !f.resolved);
    this.drawCrowd(R, Y, fogOn ? 0.08 : R.demo ? 0.7 : 0.42);
    if (R.others && R.others.length) this.drawOthers(R, Y, opts.dt);
    this.drawRings(fx, Y);
    this.drawParticles(fx, Y);
    if (R.pAlive) this.drawPlayer(R, Y, opts);
    if (R.others) this.drawNames(R, Y, opts);
    if (fogOn) this.drawFog(R, Y);
    if (f && !R.demo) this.drawLabels(R, f, Y, fogOn);
    this.drawPops(fx, Y);
    if (this.stageFlash > 0 && !this.reduceMotion) {
      cx.fillStyle = rgb(this.th.glow, this.stageFlash * 0.18);
      cx.fillRect(WALL, -20, W - 2 * WALL, viewH + 40);
    }
  }

  // Fondo: degradé, nebulosas que respiran, estelas de velocidad y grilla que late con la música
  drawBackdrop(R, camY) {
    const { cx } = this, { W, WALL } = CFG, viewH = this.viewH, th = this.th, p = this.pulse;
    const grd = cx.createLinearGradient(0, 0, 0, viewH);
    grd.addColorStop(0, rgb(th.bg.map(v => v * 0.8)));
    grd.addColorStop(1, rgb(th.bg.map(v => Math.min(255, v * 1.25))));
    cx.fillStyle = grd;
    cx.fillRect(WALL, -20, W - 2 * WALL, viewH + 40);

    cx.save();
    cx.beginPath(); cx.rect(WALL, -20, W - 2 * WALL, viewH + 40); cx.clip();
    for (let i = 0; i < 3; i++) {
      const x = WALL + (0.2 + 0.6 * hash01(i, 91)) * (W - 2 * WALL) + Math.sin(this.time * 0.3 + i * 2) * 40;
      let y = (hash01(i, 92) * viewH * 3 - camY * 0.08) % (viewH * 1.5);
      if (y < 0) y += viewH * 1.5;
      const r = 150 + i * 40 + p * 20;
      const ng = cx.createRadialGradient(x, y - viewH * 0.2, 0, x, y - viewH * 0.2, r);
      ng.addColorStop(0, rgb(th.neb, 0.22 + p * 0.08 + this.stageFlash * 0.2));
      ng.addColorStop(1, rgb(th.neb, 0));
      cx.fillStyle = ng;
      cx.fillRect(x - r, y - viewH * 0.2 - r, r * 2, r * 2);
    }
    cx.restore();

    // Estelas de velocidad: más y más largas en cada etapa
    const span = viewH + 60, n = 30 + this.stage * 10, speedK = R.speed / 255;
    cx.fillStyle = this.glowCol;
    for (let L = 0; L < 2; L++) {
      const fct = L ? 0.6 : 0.3, len = (L ? 10 : 5) * speedK * (1 + this.stage * 0.25);
      cx.globalAlpha = (L ? 0.2 : 0.1) + p * 0.08;
      for (let i = 0; i < n; i++) {
        const x = WALL + 4 + hash01(i, 7 + L) * (W - 2 * WALL - 8);
        let y = (hash01(i, 3 + L) * span * 5 - camY * fct) % span;
        if (y < 0) y += span;
        cx.fillRect(x, y - 30, L ? 1.4 : 1, len);
      }
    }
    cx.globalAlpha = 1;

    cx.strokeStyle = rgb(th.wall, 0.07 + p * 0.1);
    cx.lineWidth = 1;
    for (let y = Math.floor(camY / 80) * 80; y < camY + viewH; y += 80) {
      cx.beginPath(); cx.moveTo(WALL, y - camY); cx.lineTo(W - WALL, y - camY); cx.stroke();
    }
  }

  drawWalls(viewH) {
    const { cx } = this, { W, WALL } = CFG, p = this.pulse;
    cx.fillStyle = this.wallCol;
    cx.fillRect(WALL - 3, -20, 3, viewH + 40);
    cx.fillRect(W - WALL, -20, 3, viewH + 40);
    cx.globalAlpha = 0.18 + p * 0.25;
    cx.fillRect(WALL - 9, -20, 6, viewH + 40);
    cx.fillRect(W - WALL + 3, -20, 6, viewH + 40);
    cx.globalAlpha = 1;
  }

  // Tramo de muro entre x0 y x1 con brillo y borde superior claro
  segment(x0, x1, gy, half) {
    if (x1 - x0 <= 0) return;
    const { cx } = this;
    cx.fillStyle = this.wallCol;
    cx.globalAlpha = 0.16 + this.pulse * 0.12;
    cx.fillRect(x0, gy - half - 5, x1 - x0, half * 2 + 10);
    cx.globalAlpha = 1;
    cx.fillRect(x0, gy - half, x1 - x0, half * 2);
    cx.fillStyle = this.glowCol;
    cx.globalAlpha = 0.6;
    cx.fillRect(x0, gy - half, x1 - x0, 1.5);
    cx.globalAlpha = 1;
  }

  drawGate(g, t, gy, half = 9) {
    const { cx, C } = this;
    const n = gapsAt(g, t, G);
    let a0 = G[0], z0 = G[1], a1 = G[2], z1 = G[3];
    if (n === 2 && a1 < a0) { [a0, a1] = [a1, a0]; [z0, z1] = [z1, z0]; }
    this.segment(g.lo, a0, gy, half);
    if (n === 2) { this.segment(z0, a1, gy, half); this.segment(z1, g.hi, gy, half); }
    else this.segment(z0, g.hi, gy, half);

    if (g.type === 'moving') {
      cx.fillStyle = this.glowCol;
      cx.fillRect(a0 - 3, gy - half, 3, half * 2);
      cx.fillRect(z0, gy - half, 3, half * 2);
    } else if (g.type === 'alt') {
      // Puerta cerrada en rojo, con una barra que muestra cuánto falta para que se abra
      const closedFirst = altOpen(g, t) === 1;
      const c = closedFirst ? g.c : g.c2, w = closedFirst ? g.gw : g.gw2;
      const ph = altPhase(g, t);
      cx.fillStyle = C.danger;
      cx.globalAlpha = 0.85;
      cx.fillRect(c - w / 2, gy - half + 3, w, half * 2 - 6);
      cx.globalAlpha = 1;
      cx.fillStyle = C.gold;
      cx.fillRect(c - w / 2, gy - 1.5, w * (1 - ph), 3);
      if (ph > 0.7) {
        cx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30);
        cx.fillStyle = C.danger;
        cx.fillRect(a0, gy - half, 3, half * 2);
        cx.fillRect(z0 - 3, gy - half, 3, half * 2);
        cx.globalAlpha = 1;
      }
    }
  }

  drawOrbs(R, Y) {
    const { cx } = this, orbs = R.lvl.orbs;
    for (let k = Math.max(0, R.pOrb - 2); k < orbs.length; k++) {
      const o = orbs[k], oy = Y(o.y);
      if (oy > this.viewH + 20) break;
      if (o.taken || oy < -20) continue;
      const ti = orbTier(R.lvl.forks, o), T = ORB_TIERS[ti];
      const col = T.col || `hsl(${Math.round((R.t * 120 + o.y) % 360)} 95% 70%)`;
      const rr = 5 + ti * 0.6 + Math.sin(R.t * 6 + o.y) * 0.8 + this.pulse;
      cx.fillStyle = col;
      cx.globalAlpha = 0.22 + ti * 0.04;
      cx.beginPath(); cx.arc(o.x, oy, rr * (2.3 + ti * 0.2), 0, TAU); cx.fill();
      cx.globalAlpha = 1;
      cx.save();
      cx.translate(o.x, oy);
      cx.rotate(R.t * (2 + ti * 0.6) + o.y);
      if (T.shape === 'diamond') cx.fillRect(-rr * 0.7, -rr * 0.7, rr * 1.4, rr * 1.4);
      else if (T.shape === 'hex') {
        cx.beginPath();
        for (let j = 0; j < 6; j++) cx.lineTo(Math.cos(j * TAU / 6) * rr, Math.sin(j * TAU / 6) * rr);
        cx.closePath(); cx.fill();
      } else if (T.shape === 'star') {
        cx.beginPath();
        for (let j = 0; j < 10; j++) { const rj = j % 2 ? rr * 0.45 : rr * 1.15; cx.lineTo(Math.cos(j * Math.PI / 5) * rj, Math.sin(j * Math.PI / 5) * rj); }
        cx.closePath(); cx.fill();
      } else {
        cx.beginPath(); cx.moveTo(0, -rr * 1.3); cx.lineTo(rr * 0.9, 0); cx.lineTo(0, rr * 1.3); cx.lineTo(-rr * 0.9, 0); cx.closePath(); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.globalAlpha = 0.7;
        cx.beginPath(); cx.moveTo(0, -rr * 1.3); cx.lineTo(rr * 0.35, 0); cx.lineTo(0, rr * 0.3); cx.closePath(); cx.fill();
      }
      cx.restore();
    }
    cx.globalAlpha = 1;
  }

  // Online: los demás jugadores reales, con su skin, su estela y su nombre con estilo
  drawOthers(R, Y, dt) {
    const y = Y(R.pY), P = CFG.PR;
    for (const o of R.others) {
      if (!o.alive) continue;
      const sk = skinById(o.skin), tr = trailById(o.trail);
      this.aMul = 0.72;
      this.drawPlayer({ px: o.x, pY: R.pY, t: R.t }, Y, { skin: sk, trail: tr, trailPts: o.pts || [], dt, aura: 'none' });
    }
    this.aMul = 1;
    this.cx.globalAlpha = 1;
  }

  // Nombres encima de todo (los demás y el tuyo)
  drawNames(R, Y, opts) {
    const y = Y(R.pY), P = CFG.PR;
    for (const o of R.others) if (o.alive) drawName(this.cx, o.name, o.x, y - P - 15, nameStyleById(o.nameStyle), R.t, 11, this.FB);
    if (R.pAlive && opts.myName) drawName(this.cx, opts.myName, R.px, y - P - 15, opts.myNameStyle, R.t, 11, this.FB);
  }

  drawCrowd(R, Y, alpha) {
    const { cx } = this, c = R.crowd;
    cx.fillStyle = this.glowCol;
    cx.globalAlpha = alpha;
    for (let i = 0; i < R.n; i++) {
      if (c.alive[i]) cx.fillRect(c.x[i] - 1.3, Y(R.pY + c.yo[i]) - 1.3, 2.6, 2.6);
    }
    cx.globalAlpha = 1;
    // El rival, marcado entre la multitud
    const i = R.rival;
    if (c.alive[i] && !R.demo) {
      const x = c.x[i], y = Y(R.pY + c.yo[i]);
      cx.strokeStyle = this.C.danger;
      cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(x, y, 5 + Math.sin(R.t * 6) * 1, 0, TAU); cx.stroke();
      cx.fillStyle = this.C.danger;
      cx.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
    }
  }

  drawRings(fx, Y) {
    const { cx } = this;
    for (const r of fx.rings) {
      const a = r.life / r.max;
      cx.strokeStyle = r.col;
      cx.globalAlpha = a;
      cx.lineWidth = r.w * a + 0.5;
      cx.beginPath(); cx.arc(r.x, Y(r.y), r.r, 0, TAU); cx.stroke();
    }
    cx.globalAlpha = 1;
  }

  drawParticles(fx, Y) {
    const { cx } = this;
    for (let i = 0; i < fx.max; i++) {
      const l = fx.life[i];
      if (l <= 0) continue;
      const s = fx.size[i], x = fx.x[i], y = Y(fx.y[i]);
      cx.globalAlpha = l > 1 ? 1 : l;
      cx.fillStyle = fx.col[i];
      switch (fx.shape[i]) {
        case SHAPE.CIRCLE:
          cx.beginPath(); cx.arc(x, y, s / 2, 0, TAU); cx.fill();
          break;
        case SHAPE.BUBBLE:
          cx.strokeStyle = fx.col[i];
          cx.lineWidth = 1.2;
          cx.beginPath(); cx.arc(x, y, s / 2, 0, TAU); cx.stroke();
          break;
        case SHAPE.STAR:
          cx.fillRect(x - s / 2, y - 0.6, s, 1.2);
          cx.fillRect(x - 0.6, y - s / 2, 1.2, s);
          break;
        default:
          cx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    cx.globalAlpha = 1;
  }

  drawPlayer(R, Y, opts) {
    const { cx } = this, P = CFG.PR, t = R.t;
    const sk = opts.skin, trail = opts.trail, tr = opts.trailPts, n = tr.length;
    const col = skinColor(sk, t), col2 = sk.col2 || col;
    const tc = trail.col || col, tc2 = trail.col2 || sk.col2 || tc;

    // ---- Estela ----
    const ribbon = (width, a1, c1, c2) => {
      cx.lineCap = 'round';
      for (let k = 2; k < n; k += 2) {
        const a = k / n;
        cx.strokeStyle = (k >> 1) % 2 ? c1 : c2;
        cx.globalAlpha = (a * a1) * this.aMul;
        cx.lineWidth = width * a;
        cx.beginPath(); cx.moveTo(tr[k - 2], Y(tr[k - 1])); cx.lineTo(tr[k], Y(tr[k + 1])); cx.stroke();
      }
    };
    switch (trail.type) {
      case 'supernova': this.drawSupernova(tr, n, Y, R, t, P); break;
      case 'ribbon': ribbon(P * 1.5, 0.75, tc, tc2); break;
      case 'comet':
        ribbon(P * 1.9, 0.35, tc, tc);
        ribbon(P * 1.1, 0.9, '#ffffff', tc);
        break;
      case 'void':
        ribbon(P * 1.8, 0.55, tc, tc);
        ribbon(P * 1.2, 1, tc2, tc2);
        break;
      case 'bolt': {
        cx.lineJoin = 'miter';
        for (const [w, a, c] of [[6, 0.25, tc], [2.2, 0.9, tc], [1, 1, tc2]]) {
          cx.strokeStyle = c; cx.globalAlpha = (a) * this.aMul; cx.lineWidth = w;
          cx.beginPath();
          for (let k = 0; k < n; k += 4) {
            const off = k === n - 2 ? 0 : (Math.random() - 0.5) * 10;
            cx.lineTo(tr[k] + off, Y(tr[k + 1]));
          }
          cx.lineTo(R.px, Y(R.pY));
          cx.stroke();
        }
        break;
      }
      case 'glitch':
        for (let k = 0; k < n; k += 2) {
          const a = k / n, off = (((k * 7919 + Math.floor(t * 18)) % 7) - 3) * 2.2, sz = P * (0.5 + a * 0.9);
          cx.globalAlpha = (a * 0.55) * this.aMul;
          cx.fillStyle = (k >> 1) % 2 ? tc : tc2;
          cx.fillRect(tr[k] + off - sz / 2, Y(tr[k + 1]) - sz / 2, sz, sz);
        }
        break;
      default: {
        // Puntos (las estelas de partículas también dejan un rastro suave)
        const rainbow = trail.type === 'rainbow';
        const soft = trail.type !== 'dots' && !rainbow ? 0.25 : 0.5;
        for (let k = 0; k < n; k += 2) {
          const a = k / n;
          cx.globalAlpha = (a * soft) * this.aMul;
          cx.fillStyle = rainbow ? `hsl(${Math.round((t * 90 + k * 9) % 360)} 95% 68%)` : tc;
          cx.beginPath(); cx.arc(tr[k], Y(tr[k + 1]), P * (0.3 + a * 0.6), 0, TAU); cx.fill();
        }
      }
    }
    cx.globalAlpha = (1) * this.aMul;
    const py = Y(R.pY);
    this.drawAura(R.px, py, P, t, opts.aura, opts.tierCol);
    this.drawShape(sk.shape, R.px, py, P, col, col2, t);
  }

  // Distinción de las ligas altas alrededor del jugador
  // Distinción de las ligas altas: discreta y pegada a la bola (nunca más de ~2 radios)
  drawAura(x, y, r, t, aura, col) {
    if (!aura || aura === 'none') return;
    const { cx } = this;
    cx.strokeStyle = col;
    cx.lineWidth = 1;
    const ring = (rad, rot, dash, a) => {
      cx.save(); cx.translate(x, y); cx.rotate(rot);
      cx.setLineDash(dash); cx.globalAlpha = a * this.aMul;
      cx.beginPath(); cx.arc(0, 0, rad, 0, TAU); cx.stroke();
      cx.restore();
    };
    ring(r * 1.7, t * 1.4, [4, 4], 0.55);
    if (aura === 'halo2' || aura === 'orbit' || aura === 'crown') ring(r * 1.95, -t * 0.9, [1.5, 5], 0.4);
    cx.setLineDash([]);
    cx.globalAlpha = 0.8 * this.aMul;
    if (aura === 'orbit' || aura === 'crown') {
      cx.fillStyle = col;
      for (let k = 0; k < 3; k++) {
        const a = t * 3 + k * TAU / 3;
        cx.beginPath(); cx.arc(x + Math.cos(a) * r * 1.95, y + Math.sin(a) * r * 1.95, 1.3, 0, TAU); cx.fill();
      }
    }
    if (aura === 'crown') {
      const cy = y - r * 1.85 + Math.sin(t * 4) * 0.6;
      cx.fillStyle = this.C.gold;
      cx.globalAlpha = 0.9 * this.aMul;
      cx.beginPath();
      cx.moveTo(x - 4.5, cy + 2.5); cx.lineTo(x - 4.5, cy - 1.5); cx.lineTo(x - 2.2, cy + 0.5); cx.lineTo(x, cy - 3);
      cx.lineTo(x + 2.2, cy + 0.5); cx.lineTo(x + 4.5, cy - 1.5); cx.lineTo(x + 4.5, cy + 2.5);
      cx.closePath(); cx.fill();
    }
    cx.globalAlpha = this.aMul;
  }

  // Estela Fundador: cinta de plasma que cicla oro → magenta → cian, con núcleo
  // incandescente y arcos eléctricos que chisporrotean alrededor.
  drawSupernova(tr, n, Y, R, t, P) {
    const { cx } = this;
    if (n < 4) return;
    cx.save();
    cx.lineCap = 'round';
    const hue = k => novaHue(t * 0.5 + (1 - k / n) * 0.9);
    for (const [wMul, alpha, light] of [[2.4, 0.14, 60], [1.5, 0.35, 62], [0.8, 0.9, 75]]) {
      for (let k = 2; k < n; k += 2) {
        const a = k / n;
        cx.strokeStyle = `hsl(${Math.round(hue(k))} 100% ${light}%)`;
        cx.globalAlpha = (alpha * a) * this.aMul;
        cx.lineWidth = P * wMul * (0.25 + a * 0.75) * (1 + 0.12 * Math.sin(t * 14 + k * 0.5));
        cx.beginPath(); cx.moveTo(tr[k - 2], Y(tr[k - 1])); cx.lineTo(tr[k], Y(tr[k + 1])); cx.stroke();
      }
    }
    // Núcleo blanco
    cx.strokeStyle = '#fffbe8';
    cx.globalAlpha = (0.95) * this.aMul;
    cx.lineWidth = 1.6;
    cx.beginPath();
    for (let k = Math.floor(n * 0.35) & ~1; k < n; k += 2) cx.lineTo(tr[k], Y(tr[k + 1]));
    cx.lineTo(R.px, Y(R.pY));
    cx.stroke();
    // Arcos eléctricos
    const flick = Math.floor(t * 20);
    for (let j = 0; j < 2; j++) {
      cx.strokeStyle = j ? '#ff9cf0' : '#9ff4ff';
      cx.globalAlpha = (0.7) * this.aMul;
      cx.lineWidth = 1;
      cx.beginPath();
      for (let k = n - 2; k > n * 0.3; k -= 4) {
        const s = Math.sin((k + flick * 13 + j * 71) * 12.9898) * 43758.5453;
        const off = ((s - Math.floor(s)) - 0.5) * P * 1.8 * (k / n);
        cx.lineTo(tr[k] + off, Y(tr[k + 1]));
      }
      cx.stroke();
    }
    cx.restore();
    cx.globalAlpha = (1) * this.aMul;
  }

  // Skin Fundador: un agujero negro con disco de acreción inclinado, anillo de fotones
  // y destellos. Se dibuja en dos mitades (atrás / adelante del horizonte) para dar volumen.
  drawSingularity(x, y, r, t) {
    const { cx } = this;
    const pulse = 1 + Math.sin(t * 5) * 0.08 + this.pulse * 0.25;
    cx.save();
    cx.translate(x, y);
    cx.globalCompositeOperation = 'lighter';
    // Halo
    const halo = cx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.1 * pulse);
    halo.addColorStop(0, 'rgba(255,209,102,0.45)');
    halo.addColorStop(0.4, 'rgba(180,140,255,0.22)');
    halo.addColorStop(1, 'rgba(255,94,209,0)');
    cx.fillStyle = halo;
    cx.beginPath(); cx.arc(0, 0, r * 2.1 * pulse, 0, TAU); cx.fill();
    // Destellos tipo lente
    cx.save();
    cx.rotate(t * 0.6);
    for (let k = 0; k < 4; k++) {
      cx.rotate(TAU / 4);
      const len = r * (k % 2 ? 1.7 : 2.2) * pulse;
      const g = cx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, 'rgba(255,241,200,0.8)');
      g.addColorStop(1, 'rgba(255,241,200,0)');
      cx.fillStyle = g;
      cx.beginPath(); cx.moveTo(0, -1.2); cx.lineTo(len, 0); cx.lineTo(0, 1.2); cx.closePath(); cx.fill();
    }
    cx.restore();
    // Disco de acreción (mitad trasera)
    const tilt = 0.34, RX = r * 1.65, spin = t * 3.2;
    const disk = (from, to) => {
      const seg = 18;
      for (let w = 0; w < 3; w++) {
        const rx = RX * (0.72 + w * 0.16);
        cx.lineWidth = w === 1 ? 2.6 : 1.4;
        for (let k = 0; k < seg; k++) {
          const a0 = from + (to - from) * k / seg, a1 = from + (to - from) * (k + 1) / seg;
          const h = novaHue((a0 + spin) / TAU + w * 0.15);
          cx.strokeStyle = `hsl(${Math.round(h)} 100% ${w === 1 ? 70 : 60}%)`;
          cx.globalAlpha = (0.55 + 0.45 * Math.sin(a0 * 3 + spin * 2 + w)) * this.aMul;
          cx.beginPath(); cx.ellipse(0, 0, rx, rx * tilt, -0.35, a0, a1); cx.stroke();
        }
      }
    };
    disk(Math.PI, TAU);
    // Anillo de fotones
    cx.globalAlpha = (1) * this.aMul;
    cx.shadowColor = '#ffd166';
    cx.shadowBlur = 12;
    cx.strokeStyle = '#fff1c2';
    cx.lineWidth = 2;
    cx.beginPath(); cx.arc(0, 0, r * 1.08, 0, TAU); cx.stroke();
    cx.shadowBlur = 0;
    // Horizonte de sucesos
    cx.globalCompositeOperation = 'source-over';
    const core = cx.createRadialGradient(0, 0, 0, 0, 0, r);
    core.addColorStop(0, '#000000');
    core.addColorStop(0.75, '#07030f');
    core.addColorStop(1, '#2a1650');
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(0, 0, r * 0.98, 0, TAU); cx.fill();
    // Brillo interno que gira
    cx.globalCompositeOperation = 'lighter';
    cx.strokeStyle = '#b48cff';
    cx.globalAlpha = (0.6) * this.aMul;
    cx.lineWidth = 1;
    cx.beginPath(); cx.arc(0, 0, r * 0.62, -t * 4, -t * 4 + 1.6); cx.stroke();
    // Disco (mitad delantera, pasa por delante del núcleo)
    disk(0, Math.PI);
    // Chispas en órbita
    cx.globalAlpha = (1) * this.aMul;
    for (let k = 0; k < 6; k++) {
      const a = t * (1.8 + k * 0.23) + k * TAU / 6, rr = RX * (0.95 + 0.25 * Math.sin(t * 2 + k));
      const sx = Math.cos(a) * rr, sy = Math.sin(a) * rr * tilt;
      const rx = sx * Math.cos(-0.35) - sy * Math.sin(-0.35), ry = sx * Math.sin(-0.35) + sy * Math.cos(-0.35);
      cx.fillStyle = k % 2 ? '#ff9cf0' : '#fff1a8';
      cx.beginPath(); cx.arc(rx, ry, 1.3 + (k % 3) * 0.4, 0, TAU); cx.fill();
    }
    cx.restore();
    cx.globalAlpha = (1) * this.aMul;
  }

  drawShape(shape, x, y, r, col, col2, t) {
    const { cx, C } = this;
    if (shape === 'singularity') { this.drawSingularity(x, y, r, t); return; }
    const core = col2 === col ? C.text : col2;
    cx.fillStyle = col;
    cx.globalAlpha = (0.18 + Math.sin(t * 8) * 0.06 + this.pulse * 0.1) * this.aMul;
    cx.beginPath(); cx.arc(x, y, r * 1.6, 0, TAU); cx.fill();
    cx.globalAlpha = (1) * this.aMul;
    cx.save();
    cx.translate(x, y);
    switch (shape) {
      case 'diamond':
        cx.rotate(Math.PI / 4 + Math.sin(t * 2) * 0.12);
        cx.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
        cx.fillStyle = core;
        cx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.7);
        break;
      case 'square':
        cx.rotate(t * 1.2);
        cx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        cx.fillStyle = core;
        cx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
        break;
      case 'hex':
        cx.rotate(t * 0.8);
        cx.beginPath();
        for (let k = 0; k < 6; k++) cx.lineTo(Math.cos(k * TAU / 6) * r * 1.05, Math.sin(k * TAU / 6) * r * 1.05);
        cx.closePath(); cx.fill();
        cx.fillStyle = core;
        cx.beginPath(); cx.arc(0, 0, r * 0.38, 0, TAU); cx.fill();
        break;
      case 'ring':
        cx.strokeStyle = col; cx.lineWidth = 3;
        cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
        cx.fillStyle = col2;
        cx.beginPath(); cx.arc(0, 0, r * 0.45, 0, TAU); cx.fill();
        break;
      case 'tri':
        cx.rotate(t * 1.6);
        cx.beginPath();
        for (let k = 0; k < 3; k++) cx.lineTo(Math.cos(k * TAU / 3 - Math.PI / 2) * r * 1.25, Math.sin(k * TAU / 3 - Math.PI / 2) * r * 1.25);
        cx.closePath(); cx.fill();
        cx.fillStyle = core;
        cx.beginPath(); cx.arc(0, 0, r * 0.3, 0, TAU); cx.fill();
        break;
      case 'cross':
        cx.rotate(Math.PI / 4 + Math.sin(t * 2.4) * 0.3);
        cx.fillRect(-r * 1.1, -r * 0.34, r * 2.2, r * 0.68);
        cx.fillRect(-r * 0.34, -r * 1.1, r * 0.68, r * 2.2);
        cx.fillStyle = core;
        cx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
        break;
      case 'crystal': {
        // Cristal facetado que gira y destella (legendaria)
        const sp = t * 1.1;
        for (let k = 0; k < 6; k++) {
          const a0 = sp + k * TAU / 6, a1 = a0 + TAU / 6;
          cx.fillStyle = k % 2 ? col : col2;
          cx.globalAlpha = (0.75 + 0.25 * Math.sin(t * 4 + k)) * this.aMul;
          cx.beginPath(); cx.moveTo(0, 0);
          cx.lineTo(Math.cos(a0) * r * 1.3, Math.sin(a0) * r * 1.3 * 0.8);
          cx.lineTo(Math.cos(a1) * r * 1.3, Math.sin(a1) * r * 1.3 * 0.8);
          cx.closePath(); cx.fill();
        }
        cx.globalAlpha = this.aMul;
        cx.strokeStyle = '#ffffff'; cx.lineWidth = 1;
        cx.beginPath();
        for (let k = 0; k < 6; k++) cx.lineTo(Math.cos(sp + k * TAU / 6) * r * 1.3, Math.sin(sp + k * TAU / 6) * r * 1.3 * 0.8);
        cx.closePath(); cx.stroke();
        const g = (t * 0.8) % 1;
        if (g < 0.25) {
          cx.fillStyle = '#ffffff';
          cx.globalAlpha = (1 - g * 4) * this.aMul;
          cx.fillRect(-r * 1.4, -0.6, r * 2.8, 1.2); cx.fillRect(-0.6, -r * 1.4, 1.2, r * 2.8);
          cx.globalAlpha = this.aMul;
        }
        break;
      }
      case 'plasma': {
        // Núcleo de plasma (mítica): esfera que late, anillos cruzados y arcos eléctricos
        const pl = 1 + Math.sin(t * 7) * 0.1;
        const grd = cx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4 * pl);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, col); grd.addColorStop(1, col2);
        cx.fillStyle = grd;
        cx.beginPath(); cx.arc(0, 0, r * 1.05 * pl, 0, TAU); cx.fill();
        cx.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) {
          cx.strokeStyle = k % 2 ? col2 : col;
          cx.beginPath(); cx.ellipse(0, 0, r * 1.5, r * 0.45, t * (1.5 + k * 0.4) + k * TAU / 3, 0, TAU); cx.stroke();
        }
        cx.strokeStyle = '#ffffff'; cx.lineWidth = 1;
        const f = Math.floor(t * 18);
        for (let k = 0; k < 3; k++) {
          const a0 = ((f * 7 + k * 13) % 17) / 17 * TAU;
          cx.beginPath(); cx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
          for (let j = 1; j <= 3; j++) {
            const rr = r * (1 + j * 0.17), aa = a0 + Math.sin(f * 3.1 + j * k) * 0.4;
            cx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
          }
          cx.stroke();
        }
        break;
      }
      case 'star':
        cx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = t * 1.5 + k * Math.PI / 5, rr = k % 2 ? r * 0.55 : r * 1.3;
          cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        cx.closePath(); cx.fill();
        cx.fillStyle = core;
        cx.beginPath(); cx.arc(0, 0, r * 0.3, 0, TAU); cx.fill();
        break;
      default:
        cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
        cx.fillStyle = core;
        cx.beginPath(); cx.arc(0, 0, r * 0.4, 0, TAU); cx.fill();
    }
    cx.restore();
  }

  drawFog(R, Y) {
    const { cx } = this, { W, WALL } = CFG, py = Y(R.pY);
    const grd = cx.createRadialGradient(R.px, py, 30, R.px, py, 190);
    grd.addColorStop(0, 'rgba(13,10,32,0)');
    grd.addColorStop(1, 'rgba(13,10,32,0.92)');
    cx.fillStyle = grd;
    cx.fillRect(WALL, -20, W - 2 * WALL, this.viewH + 40);
  }

  drawFork(R, f, Y) {
    const { cx, C } = this, { DIV, WALL, W } = CFG;
    const y0 = Y(f.entryY), y1 = Y(f.endY);
    for (const L of f.lanes) {
      if (!L.gold) continue;
      cx.fillStyle = C.gold;
      cx.globalAlpha = 0.14;
      cx.fillRect(L.x0, y0 - 40, L.x1 - L.x0, y1 - y0 + 40);
    }
    cx.globalAlpha = 1;
    if (f.resolved) {
      const flash = clamp(1 - (R.t - f.resolvedAt) * 0.8, 0, 1);
      for (const k of f.collapsed) {
        const L = f.lanes[k];
        cx.fillStyle = C.danger;
        cx.globalAlpha = 0.12 + flash * 0.45;
        cx.fillRect(L.x0, y0, L.x1 - L.x0, y1 - y0 + 220 * (1 - flash) + 20);
      }
      cx.globalAlpha = 1;
    }
    // Tu camino, remarcado mientras estás en los carriles
    if (!f.resolved && R.pAlive && !R.demo && R.cf === f.i && R.pLane >= 0) {
      const L = f.lanes[R.pLane];
      cx.strokeStyle = this.C.mint;
      cx.globalAlpha = 0.35 + this.pulse * 0.2;
      cx.lineWidth = 2;
      cx.strokeRect(L.x0 + 2, y0, L.x1 - L.x0 - 4, y1 - y0);
      cx.globalAlpha = 1;
    }
    cx.fillStyle = this.wallCol;
    for (let i = 0; i < f.k - 1; i++) {
      const xd = f.lanes[i].x1;
      cx.fillRect(xd, y0, DIV, y1 - y0);
      cx.beginPath(); cx.moveTo(xd, y0); cx.lineTo(xd + DIV / 2, y0 - 30); cx.lineTo(xd + DIV, y0); cx.fill();
    }
    if (f.ng) this.drawGate(f.ng, R.t, Y(f.ng.y), 8);
    if (!f.resolved) {
      cx.strokeStyle = f.invert ? C.gold : C.danger;
      cx.lineWidth = 2;
      cx.setLineDash([6, 6]);
      cx.beginPath(); cx.moveTo(WALL, y1); cx.lineTo(W - WALL, y1); cx.stroke();
      cx.setLineDash([]);
    }
  }

  drawLabels(R, f, Y, fogOn) {
    const { cx, C, FD, FM } = this;
    if (f.resolved || R.pY < f.startY - 100) return;
    const inLane = R.pY >= f.entryY;
    const src = inLane ? f.counts : f.intent;
    // El carril que se derrumbaría si terminara ahora: el más lleno (o el más vacío si hay inversión)
    let hot = -1;
    if (!fogOn) {
      hot = 0;
      for (let k = 1; k < f.k; k++) {
        if (f.invert ? src[k] < src[hot] : src[k] > src[hot]) hot = k;
      }
    }
    const big = f.k === 4 ? 16 : 20;
    cx.textAlign = 'center';
    for (let k = 0; k < f.k; k++) {
      const L = f.lanes[k], xm = (L.x0 + L.x1) / 2, isHot = k === hot;
      if (!inLane) {
        const y = Math.min(Y(f.entryY) - 44, this.viewH - 34);
        cx.fillStyle = isHot ? C.danger : C.text;
        cx.font = `800 ${L.narrow ? 14 : big}px ${FD}`;
        cx.fillText(fogOn ? '?' : Math.round(f.intent[k] * 100) + '%', xm, y);
        // Flecha de tendencia: hacia dónde se está moviendo la multitud
        const tr = f.trend ? f.trend[k] : 0;
        if (!fogOn && Math.abs(tr) > 0.012) {
          const up = tr > 0, ay = y - (L.narrow ? 24 : 30);
          // Que crezca un camino es malo si cae el más lleno, y bueno en una inversión
          cx.fillStyle = up !== !!f.invert ? C.danger : C.mint;
          cx.beginPath();
          if (up) { cx.moveTo(xm - 6, ay + 3); cx.lineTo(xm + 6, ay + 3); cx.lineTo(xm, ay - 5); }
          else { cx.moveTo(xm - 6, ay - 5); cx.lineTo(xm + 6, ay - 5); cx.lineTo(xm, ay + 3); }
          cx.fill();
          cx.font = `700 10px ${FM}`;
          cx.fillText((up ? '+' : '') + Math.round(tr * 100), xm, ay - 9);
        }
        // Proyección: cómo va a quedar si cada uno sigue hacia donde va
        let tagY = y + 16;
        if (!fogOn && f.proj) {
          let ph = 0;
          for (let j = 1; j < f.k; j++) if (f.invert ? f.proj[j] < f.proj[ph] : f.proj[j] > f.proj[ph]) ph = j;
          cx.fillStyle = k === ph ? C.danger : C.mint;
          cx.font = `700 11px ${FM}`;
          cx.fillText('→ ' + Math.round(f.proj[k] * 100) + '%', xm, y + 16);
          tagY = y + 30;
        }
        const tag = L.gold ? 'x2' : L.narrow ? 'ANGOSTO' : '';
        if (tag) {
          cx.fillStyle = L.gold ? C.gold : C.muted;
          cx.font = `700 11px ${FM}`;
          cx.fillText(tag, xm, tagY);
        }
      } else {
        const y = clamp(Y(f.endY) - 26, 90, this.viewH - 30);
        cx.fillStyle = isHot ? C.danger : C.text;
        cx.font = `800 ${L.narrow ? 14 : big + 2}px ${FD}`;
        cx.fillText(fogOn ? '?' : fmt(f.counts[k]), xm, y);
      }
    }
    const tag = f.invert ? 'INVERSIÓN · CAE EL MÁS VACÍO' : f.overtime ? 'MUERTE SÚBITA' : '';
    if (tag) {
      const y = inLane ? clamp(Y(f.endY) + 22, 110, this.viewH - 12) : Math.min(Y(f.entryY) - 78, this.viewH - 70);
      cx.fillStyle = f.invert ? C.gold : C.danger;
      cx.font = `800 12px ${FD}`;
      cx.fillText(tag, CFG.W / 2, y);
    }
    if (!inLane && Y(f.entryY) > this.viewH) {
      cx.fillStyle = C.muted;
      cx.font = `600 11px ${FM}`;
      cx.fillText('intención de la multitud', CFG.W / 2, this.viewH - 12);
    }
  }

  drawPops(fx, Y) {
    const { cx, FM } = this;
    cx.textAlign = 'center';
    cx.font = `700 13px ${FM}`;
    for (const p of fx.pops) {
      cx.globalAlpha = clamp(p.life * 1.4, 0, 1);
      cx.fillStyle = p.col;
      cx.fillText(p.text, clamp(p.x, 70, CFG.W - 70), Y(p.y) - 22 - (0.9 - p.life) * 40);
    }
    cx.globalAlpha = 1;
  }
}
