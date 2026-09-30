// Tarjeta de resultado para compartir (imagen 1080×1350, formato de historia/feed).
import { fmt, pctText } from '../util/math.js';

export function shareText(sum) {
  if (sum.outlier) return `Fui el Outlier del minuto en Contracorriente: el último en pie entre ${fmt(sum.total)} jugadores. ¿Me ganás?`;
  return `Quedé #${fmt(sum.rank)} de ${fmt(sum.total)} en Contracorriente: sobreviví a más que el ${pctText(sum.pct)} de los jugadores. ¿Me ganás?`;
}

export function renderShareCard(sum, { colors, fonts, playerColor, level, title, rank }) {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');

  // Fondo con túnel y multitud
  const bg = cx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, colors.ink2);
  bg.addColorStop(1, colors.ink);
  cx.fillStyle = bg;
  cx.fillRect(0, 0, W, H);
  cx.fillStyle = colors.wall;
  cx.fillRect(90, 0, 8, H);
  cx.fillRect(W - 98, 0, 8, H);
  cx.fillStyle = colors.crowd;
  let s = sum.score * 7 + 13;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 420; i++) {
    cx.globalAlpha = 0.12 + rnd() * 0.25;
    cx.fillRect(110 + rnd() * (W - 220), 120 + rnd() * 260, 6, 6);
  }
  cx.globalAlpha = 1;

  // Jugador
  cx.fillStyle = playerColor;
  cx.globalAlpha = 0.25;
  cx.beginPath(); cx.arc(W / 2, 250, 60, 0, Math.PI * 2); cx.fill();
  cx.globalAlpha = 1;
  cx.beginPath(); cx.arc(W / 2, 250, 26, 0, Math.PI * 2); cx.fill();

  cx.textAlign = 'center';
  cx.fillStyle = colors.text;
  cx.font = `800 64px ${fonts.display}`;
  cx.fillText('CONTRA', W / 2, 500);
  cx.fillStyle = colors.spark;
  cx.fillText('CORRIENTE', W / 2, 575);

  cx.fillStyle = colors.spark;
  cx.font = `800 220px ${fonts.display}`;
  cx.fillText(sum.outlier ? '#1' : '#' + fmt(sum.rank), W / 2, 830);
  cx.fillStyle = colors.muted;
  cx.font = `700 48px ${fonts.mono}`;
  cx.fillText(`de ${fmt(sum.total)} jugadores`, W / 2, 900);

  cx.fillStyle = colors.text;
  cx.font = `700 50px ${fonts.body}`;
  cx.fillText(sum.outlier ? 'Outlier del minuto' : `Sobreviví a más que el ${pctText(sum.pct)}`, W / 2, 1010);

  cx.fillStyle = colors.muted;
  cx.font = `600 32px ${fonts.body}`;
  cx.fillText(`${sum.forksOk}/${sum.forks} caminos · ${fmt(sum.score)} puntos · ${rank || `Nivel ${level} ${title}`}`, W / 2, 1080);

  cx.fillStyle = colors.gold;
  cx.font = `800 40px ${fonts.display}`;
  cx.fillText('¿ME GANÁS?', W / 2, 1230);

  return cv.toDataURL('image/png');
}
