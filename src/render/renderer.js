// Dibujo del mundo en canvas 2D. Lee el estado de la ronda y de los efectos; no lo modifica.
import { CFG } from '../config.js';
import { clamp, fmt, TAU } from '../util/math.js';
import { hash01 } from '../util/rng.js';
import { gapsAt, altOpen, altPhase } from '../sim/gates.js';

const G = new Float64Array(4);

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.cx = canvas.getContext('2d', { alpha: false });
    const css = getComputedStyle(document.documentElement);
    const tok = n => css.getPropertyValue(n).trim();
    this.C = {
      ink: tok('--ink'), ink2: tok('--ink-2'), wall: tok('--wall'), grid: tok('--grid'), crowd: tok('--crowd'),
      spark: tok('--spark'), danger: tok('--danger'), gold: tok('--gold'), text: tok('--text'), muted: tok('--muted'),
    };
    this.FD = tok('--f-display');
    this.FM = tok('--f-mono');
    this.FB = tok('--f-body');
    this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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

  draw(R, fx, opts) {
    const { cx, C, dpr, scale } = this;
    const { W, WALL } = CFG;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = C.ink;
    cx.fillRect(0, 0, this.cw, this.ch);
    if (!R) return;

    const sh = this.reduceMotion ? 0 : fx.shake(9);
    cx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (this.offX + sh * scale), 0);
    const camY = R.pY - this.viewH * CFG.PLAYER_FRAC;
    const Y = y => y - camY;
    const viewH = this.viewH;

    cx.fillStyle = C.ink2;
    cx.fillRect(WALL, -20, W - 2 * WALL, viewH + 40);
    this.drawStreaks(camY);
    cx.strokeStyle = C.grid;
    cx.lineWidth = 1;
    for (let y = Math.floor(camY / 80) * 80; y < camY + viewH; y += 80) {
      cx.beginPath(); cx.moveTo(WALL, Y(y)); cx.lineTo(W - WALL, Y(y)); cx.stroke();
    }
    this.drawWalls(viewH);

    for (const f of R.lvl.forks) if (f.endY + 400 > camY && f.entryY - 60 < camY + viewH) this.drawFork(R, f, Y);
    for (const g of R.lvl.gates) {
      const gy = Y(g.y);
      if (gy > -30 && gy < viewH + 30) this.drawGate(g, R.t, gy);
    }
    this.drawOrbs(R, Y);

    const f = R.fork;
    const fogOn = !!(f && f.variant === 'fog' && R.pY >= f.startY - 100 && !f.resolved);
    this.drawCrowd(R, Y, fogOn ? 0.1 : 0.8);
    this.drawParticles(fx, Y);
    if (R.pAlive) this.drawPlayer(R, Y, opts.playerColor, opts.trail);
    if (fogOn) this.drawFog(R, Y);
    if (f && !R.demo) this.drawLabels(R, f, Y, fogOn);
    this.drawPops(fx, Y);
  }

  drawStreaks(camY) {
    const { cx, C } = this, { W, WALL } = CFG, span = this.viewH + 60;
    cx.fillStyle = C.crowd;
    for (let L = 0; L < 2; L++) {
      const fct = L ? 0.6 : 0.3, len = L ? 10 : 5;
      cx.globalAlpha = L ? 0.2 : 0.1;
      for (let i = 0; i < 34; i++) {
        const x = WALL + 4 + hash01(i, 7 + L) * (W - 2 * WALL - 8);
        let y = (hash01(i, 3 + L) * span * 5 - camY * fct) % span;
        if (y < 0) y += span;
        cx.fillRect(x, y - 30, L ? 1.4 : 1, len);
      }
    }
    cx.globalAlpha = 1;
  }

  drawWalls(viewH) {
    const { cx, C } = this, { W, WALL } = CFG;
    cx.fillStyle = C.wall;
    cx.fillRect(WALL - 3, -20, 3, viewH + 40);
    cx.fillRect(W - WALL, -20, 3, viewH + 40);
    cx.globalAlpha = 0.18;
    cx.fillRect(WALL - 9, -20, 6, viewH + 40);
    cx.fillRect(W - WALL + 3, -20, 6, viewH + 40);
    cx.globalAlpha = 1;
  }

  // Tramo de muro entre x0 y x1 con brillo y borde superior claro
  segment(x0, x1, gy, half) {
    if (x1 - x0 <= 0) return;
    const { cx, C } = this;
    cx.fillStyle = C.wall;
    cx.globalAlpha = 0.16;
    cx.fillRect(x0, gy - half - 5, x1 - x0, half * 2 + 10);
    cx.globalAlpha = 1;
    cx.fillRect(x0, gy - half, x1 - x0, half * 2);
    cx.fillStyle = C.crowd;
    cx.globalAlpha = 0.55;
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
      cx.fillStyle = C.crowd;
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
        // Aviso: la puerta abierta está por cerrarse
        cx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 30);
        cx.fillStyle = C.danger;
        cx.fillRect(a0, gy - half, 3, half * 2);
        cx.fillRect(z0 - 3, gy - half, 3, half * 2);
        cx.globalAlpha = 1;
      }
    }
  }

  drawOrbs(R, Y) {
    const { cx, C } = this, orbs = R.lvl.orbs;
    cx.fillStyle = C.gold;
    for (let k = Math.max(0, R.pOrb - 2); k < orbs.length; k++) {
      const o = orbs[k], oy = Y(o.y);
      if (oy > this.viewH + 20) break;
      if (o.taken || oy < -20) continue;
      const rr = 5 + Math.sin(R.t * 6 + o.y) * 0.8;
      cx.globalAlpha = 0.22;
      cx.beginPath(); cx.arc(o.x, oy, rr * 2.3, 0, TAU); cx.fill();
      cx.globalAlpha = 1;
      cx.save();
      cx.translate(o.x, oy);
      cx.rotate(R.t * 2 + o.y);
      cx.fillRect(-rr * 0.7, -rr * 0.7, rr * 1.4, rr * 1.4);
      cx.restore();
    }
  }

  drawCrowd(R, Y, alpha) {
    const { cx, C } = this, c = R.crowd;
    cx.fillStyle = C.crowd;
    cx.globalAlpha = alpha;
    for (let i = 0; i < R.n; i++) {
      if (c.alive[i]) cx.fillRect(c.x[i] - 1.3, Y(R.pY + c.yo[i]) - 1.3, 2.6, 2.6);
    }
    cx.globalAlpha = 1;
  }

  drawParticles(fx, Y) {
    const { cx } = this;
    for (let i = 0; i < fx.max; i++) {
      const l = fx.life[i];
      if (l <= 0) continue;
      const s = fx.size[i];
      cx.globalAlpha = l > 1 ? 1 : l;
      cx.fillStyle = fx.col[i];
      cx.fillRect(fx.x[i] - s / 2, Y(fx.y[i]) - s / 2, s, s);
    }
    cx.globalAlpha = 1;
  }

  drawPlayer(R, Y, color, tr) {
    const { cx, C } = this, P = CFG.PR, py = Y(R.pY);
    // Estela: últimas posiciones del jugador (pares x, y)
    cx.fillStyle = color;
    for (let k = 0; k < tr.length; k += 2) {
      const a = k / tr.length;
      cx.globalAlpha = a * 0.5;
      cx.beginPath(); cx.arc(tr[k], Y(tr[k + 1]), P * (0.3 + a * 0.6), 0, TAU); cx.fill();
    }
    cx.globalAlpha = 0.18 + Math.sin(R.t * 8) * 0.06;
    cx.beginPath(); cx.arc(R.px, py, P * 2.3, 0, TAU); cx.fill();
    cx.globalAlpha = 1;
    cx.beginPath(); cx.arc(R.px, py, P, 0, TAU); cx.fill();
    cx.fillStyle = C.text;
    cx.beginPath(); cx.arc(R.px, py, P * 0.4, 0, TAU); cx.fill();
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
    cx.fillStyle = C.wall;
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
        const tag = L.gold ? 'x2' : L.narrow ? 'ANGOSTO' : '';
        if (tag) {
          cx.fillStyle = L.gold ? C.gold : C.muted;
          cx.font = `700 11px ${FM}`;
          cx.fillText(tag, xm, y + 16);
        }
      } else {
        const y = clamp(Y(f.endY) - 26, 90, this.viewH - 30);
        cx.fillStyle = isHot ? C.danger : C.text;
        cx.font = `800 ${L.narrow ? 14 : big + 2}px ${FD}`;
        cx.fillText(fogOn ? '?' : fmt(f.counts[k]), xm, y);
      }
    }
    if (f.invert) {
      const y = inLane ? clamp(Y(f.endY) + 22, 110, this.viewH - 12) : Math.min(Y(f.entryY) - 78, this.viewH - 70);
      cx.fillStyle = C.gold;
      cx.font = `800 12px ${FD}`;
      cx.fillText('INVERSIÓN · CAE EL MÁS VACÍO', CFG.W / 2, y);
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
