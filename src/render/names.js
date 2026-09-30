// Nombres con estilo dibujados en el canvas (etiquetas sobre los jugadores online)
const TAU = Math.PI * 2;

function cycleGrad(cx, cols, x0, w, phase) {
  const g = cx.createLinearGradient(x0 - w, 0, x0 + w * 2, 0);
  const n = cols.length * 3;
  for (let i = 0; i <= n; i++) {
    const p = ((i / n) + phase) % 1;
    g.addColorStop(i / n, cols[Math.floor(p * cols.length * 3) % cols.length]);
  }
  return g;
}

// Dibuja el nombre centrado en (x, y). font: tamaño en px
export function drawName(cx, text, x, y, style, t, size = 11, family = 'sans-serif') {
  const c = style.cols;
  cx.save();
  cx.font = `800 ${size}px ${family}`;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  const w = cx.measureText(text).width, x0 = x - w / 2;
  switch (style.fx) {
    case 'grad':
      cx.fillStyle = cycleGrad(cx, c, x0, w, t * 0.25);
      cx.fillText(text, x, y);
      break;
    case 'toxic':
      cx.shadowColor = c[1]; cx.shadowBlur = 6 + Math.sin(t * 5) * 4;
      cx.fillStyle = c[0]; cx.fillText(text, x, y);
      break;
    case 'neon': {
      const on = Math.sin(t * 23) > -0.85 || Math.sin(t * 3.1) > 0;
      cx.shadowColor = c[0]; cx.shadowBlur = on ? 12 : 3;
      cx.fillStyle = on ? c[1] : c[0]; cx.fillText(text, x, y);
      cx.fillText(text, x, y);
      break;
    }
    case 'glitch': {
      const j = Math.floor(t * 12) % 7 === 0 ? 2.5 : 1;
      cx.globalAlpha = 0.8;
      cx.fillStyle = c[1]; cx.fillText(text, x - j, y);
      cx.fillStyle = c[2]; cx.fillText(text, x + j, y + (j > 1 ? 1 : 0));
      cx.globalAlpha = 1;
      cx.fillStyle = c[0]; cx.fillText(text, x, y);
      break;
    }
    case 'frost':
    case 'shine': {
      const g = cx.createLinearGradient(x0, 0, x0 + w, 0);
      const p = (t * 0.6) % 1.6 - 0.3;
      g.addColorStop(0, c[0]);
      g.addColorStop(Math.min(1, Math.max(0, p - 0.12)), c[0]);
      g.addColorStop(Math.min(1, Math.max(0, p)), c[1]);
      g.addColorStop(Math.min(1, Math.max(0, p + 0.12)), c[2] || c[0]);
      g.addColorStop(1, c[2] || c[0]);
      cx.shadowColor = style.fx === 'frost' ? c[1] : c[0]; cx.shadowBlur = 6;
      cx.fillStyle = g; cx.fillText(text, x, y);
      break;
    }
    case 'fire': {
      const g = cx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
      g.addColorStop(0, c[0]); g.addColorStop(0.5, c[1]); g.addColorStop(1, c[2]);
      cx.shadowColor = c[2]; cx.shadowBlur = 8 + Math.sin(t * 17) * 3 + Math.sin(t * 7) * 2;
      cx.fillStyle = g; cx.fillText(text, x, y);
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.4 + i / 3) % 1;
        cx.globalAlpha = 1 - ph;
        cx.fillStyle = c[1];
        cx.fillRect(x0 + ((i * 0.37 + 0.2) % 1) * w, y - size / 2 - ph * 10, 1.6, 1.6);
      }
      break;
    }
    case 'galaxy':
    case 'founder': {
      const founder = style.fx === 'founder';
      cx.shadowColor = c[0];
      cx.shadowBlur = founder ? 10 + Math.sin(t * 4) * 5 : 6;
      cx.fillStyle = cycleGrad(cx, c, x0, w, t * (founder ? 0.45 : 0.2));
      cx.fillText(text, x, y);
      if (founder) {
        // Brillo que recorre el nombre
        const p = (t * 0.7) % 1.4 - 0.2;
        const g = cx.createLinearGradient(x0, 0, x0 + w, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(Math.min(1, Math.max(0, p - 0.08)), 'rgba(255,255,255,0)');
        g.addColorStop(Math.min(1, Math.max(0, p)), 'rgba(255,255,255,0.9)');
        g.addColorStop(Math.min(1, Math.max(0, p + 0.08)), 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        cx.shadowBlur = 0;
        cx.fillStyle = g; cx.fillText(text, x, y);
        // Corona
        cx.fillStyle = '#ffd166';
        cx.shadowColor = '#ffd166'; cx.shadowBlur = 8;
        const cxr = x0 - 9, cy = y + Math.sin(t * 3) * 0.8;
        cx.beginPath();
        cx.moveTo(cxr - 5, cy + 3); cx.lineTo(cxr - 5, cy - 3); cx.lineTo(cxr - 2.5, cy); cx.lineTo(cxr, cy - 4.5);
        cx.lineTo(cxr + 2.5, cy); cx.lineTo(cxr + 5, cy - 3); cx.lineTo(cxr + 5, cy + 3); cx.closePath(); cx.fill();
      }
      // Destellos alrededor
      cx.shadowBlur = 0;
      const n = founder ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const a = t * (1.3 + i * 0.2) + i * TAU / n;
        const sx = x + Math.cos(a) * (w / 2 + 6), sy = y + Math.sin(a) * (size * 0.8);
        const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 2);
        cx.globalAlpha = tw;
        cx.fillStyle = i % 2 ? '#ffffff' : c[i % c.length];
        cx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      break;
    }
    default:
      cx.fillStyle = c[0];
      cx.fillText(text, x, y);
  }
  cx.restore();
}
