// Efectos visuales: partículas en un pool preasignado (sin crear objetos por cuadro),
// textos flotantes y temblor de cámara por "trauma" (se acumula y decae suave).

export class Fx {
  constructor(max = 900) {
    this.max = max;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.col = new Array(max).fill('#fff');
    this.head = 0;
    this.pops = [];
    this.trauma = 0;
    this.shakeT = 0;
  }

  reset() {
    this.life.fill(0);
    this.pops.length = 0;
    this.trauma = 0;
  }

  spawn(x, y, vx, vy, life, col, size = 3) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.col[i] = col; this.size[i] = size;
  }

  burst(x, y, n, col, speed, size = 3) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 0.35 + Math.random() * 0.4, col, size);
    }
  }

  fall(xy, col) {
    for (let k = 0; k < xy.length; k += 2) {
      this.spawn(xy[k], xy[k + 1], (Math.random() - 0.5) * 60, 40 + Math.random() * 120, 0.7 + Math.random() * 0.6, col, 3);
    }
  }

  pop(x, y, text, col) {
    this.pops.push({ x, y, text, col, life: 0.9 });
    if (this.pops.length > 12) this.pops.shift();
  }

  addTrauma(v) { this.trauma = Math.min(1, this.trauma + v); }

  // Desplazamiento de cámara: proporcional al cuadrado del trauma (sacudidas chicas se sienten suaves)
  shake(maxPx) {
    const s = this.trauma * this.trauma * maxPx;
    return s ? (Math.sin(this.shakeT * 53) + Math.sin(this.shakeT * 31.7)) * 0.5 * s : 0;
  }

  update(dt) {
    this.shakeT += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.vy[i] += 420 * dt;
      this.life[i] -= dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      this.pops[i].life -= dt;
      if (this.pops[i].life <= 0) this.pops.splice(i, 1);
    }
  }
}
