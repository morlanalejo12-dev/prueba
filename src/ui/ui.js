// Capa de interfaz DOM: HUD, carteles, feed, avisos, menú, resultados y ventanas.
// No conoce la simulación por dentro: recibe datos ya calculados y avisa acciones por callbacks.
import { CFG } from '../config.js';
import { fmt, pctText, easeOutCubic } from '../util/math.js';
import { levelInfo, titleOf, displayTitle, streakNow, instinct, ownedSkins, ownedTrails, ownedMusic, ownedNames, claimableAch, levelBadgeOf } from '../game/progress.js';
import { claimablePass, passInfo } from '../game/pass.js';
import { isUnlocked, nextFeature } from '../game/unlocks.js';
import { challengeDay, weekendMode } from '../game/events.js';
import { SKINS, TRAILS, skinById } from '../game/skins.js';
import { MUSIC } from '../game/music.js';
import { NAME_STYLES, nameStyleById } from '../game/names.js';
import { TIERS, rankOf } from '../game/ranks.js';
import { claimableMissions, dailyState, missionText } from '../game/meta.js';
import { ICON, emblem, nameTag, skinPreview, MUSIC_ICON, levelEmblem } from './icons.js';
import { buildModal, TITLES_BY_KIND } from './modals.js';

export const $ = id => document.getElementById(id);

const RING = 106.8; // circunferencia del anillo de nivel (r = 17)
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const WHY_TEXT = {
  wall: 'Chocaste contra un muro.',
  majority: 'Caíste por elegir el camino de la mayoría.',
  inverted: 'Caíste en la inversión: elegiste el camino más vacío.',
  alive: 'Llegaste al final con vida.',
  lottery: 'En la muerte súbita nadie se separó y la corriente te llevó.',
};

export function createUI(h) {
  let bannerTok = 0, hintTimer = 0, lastInputKeyboard = false;
  window.addEventListener('keydown', () => { lastInputKeyboard = true; }, true);
  window.addEventListener('pointerdown', () => { lastInputKeyboard = false; }, true);

  $('coinIcon').innerHTML = ICON.coin;
  $('rCoinIcon').innerHTML = ICON.coin;
  $('icMissions').innerHTML = ICON.target;
  $('icShop').innerHTML = ICON.gift;
  $('icMusic').innerHTML = MUSIC_ICON;

  // ---------- Carteles, pistas, destellos, avisos y feed ----------
  function banner(title, sub, kind, ms) {
    const el = $('banner'), my = ++bannerTok;
    $('bTitle').textContent = title;
    $('bSub').textContent = sub || '';
    el.className = 'banner ' + (kind || '');
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => { if (bannerTok === my) el.hidden = true; }, ms);
  }
  function hideBanner() { bannerTok++; $('banner').hidden = true; }

  function hint(text, ms = 2800) {
    const el = $('hint');
    el.textContent = text;
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { el.hidden = true; }, ms);
  }
  function hideHint() { clearTimeout(hintTimer); $('hint').hidden = true; }

  function flash(color) {
    if (reduceMotion) return;
    const el = $('flash');
    el.style.background = color;
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }

  function toast(kicker, title) {
    if (h.quiet && h.quiet()) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ICON.trophy}<div><small></small><b></b></div>`;
    el.querySelector('small').textContent = kicker;
    el.querySelector('b').textContent = title;
    $('toasts').append(el);
    setTimeout(() => el.remove(), 3700);
  }

  // Feed en vivo: `parts` alterna texto normal y resaltado, empezando por texto normal
  function feed(kind, ...parts) {
    if (h.quiet && h.quiet()) return;
    const box = $('feed');
    box.hidden = false;
    const p = document.createElement('p');
    if (kind) p.className = kind;
    p.innerHTML = parts.map((t, i) => (i % 2 ? `<b>${esc(t)}</b>` : esc(t))).join('');
    box.append(p);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => p.remove(), 3900);
  }
  function clearFeed() { $('feed').innerHTML = ''; $('feed').hidden = true; }

  // ---------- HUD ----------
  const forkDots = [];
  for (let i = 0; i < CFG.FORKS; i++) {
    const d = document.createElement('i');
    $('hForks').append(d);
    forkDots.push(d);
  }
  const otLabel = document.createElement('b');
  otLabel.className = 'ot-label';
  otLabel.hidden = true;
  $('hForks').append(otLabel);
  let hudKey = '';
  function hud(R) {
    const key = `${R.aliveTotal}|${Math.floor(R.score)}|${R.cf}|${R.combo}|${R.pAlive}|${R.rivalAlive}`;
    if (key === hudKey) return;
    hudKey = key;
    $('hAlive').textContent = fmt(R.aliveTotal);
    $('hScore').textContent = fmt(R.score);
    const cb = $('hCombo');
    cb.hidden = R.combo < 2;
    cb.textContent = `x${R.combo}`;
    forkDots.forEach((d, k) => { d.className = R.forkLog[k] || (k === R.cf && R.pAlive ? 'now' : ''); });
    const ot = R.cf >= CFG.FORKS && !R.ended;
    otLabel.hidden = !ot;
    if (ot) otLabel.textContent = `Súbita ${R.cf - CFG.FORKS + 1}`;
    $('hForks').classList.toggle('ot', ot);
    $('hRival').classList.toggle('down', !R.rivalAlive);
    const pips = $('hDashPips');
    if (pips.children.length !== CFG.DASH_MAX) {
      pips.innerHTML = '';
      for (let i = 0; i < CFG.DASH_MAX; i++) pips.append(document.createElement('i'));
    }
    [...pips.children].forEach((p, i) => p.classList.toggle('on', i < R.charges));
  }

  // Botones de impulso: solo aparecen dentro de los carriles, si hay carga y carril vecino
  let dashKey = '';
  function dashButtons(R) {
    const f = R.fork, can = !!(R.canDash && R.canDash());
    const l = can && R.pLane > 0, r = can && f && R.pLane < f.k - 1;
    const key = `${l}|${r}`;
    $('hDash').classList.toggle('ready', can);
    if (key === dashKey) return;
    dashKey = key;
    $('dashL').hidden = !l;
    $('dashR').hidden = !r;
  }
  function hideDash() { dashKey = ''; $('dashL').hidden = true; $('dashR').hidden = true; }

  // Predicciones mientras mirás: elegir qué camino cae en la próxima bifurcación
  const LANES = ['A', 'B', 'C', 'D'];
  let predKey = '';
  function predict(R, pred, stats) {
    const f = R.fork;
    const open = !R.pAlive && !R.ended && f && !f.resolved && R.pY >= f.startY - 150;
    const mine = open && pred && pred.fork === f.i ? pred.lane : -1;
    const locked = open && R.pY >= f.endY - 60;
    const key = `${open}|${f && f.i}|${mine}|${locked}|${stats.hits}`;
    if (key === predKey) return;
    predKey = key;
    $('predict').hidden = !open;
    if (!open) return;
    $('predictTitle').textContent = f.invert ? '¿Qué camino cae? (inversión)' : '¿Qué camino cae?';
    const box = $('predictBtns');
    box.innerHTML = '';
    for (let k = 0; k < f.k; k++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = LANES[k];
      b.setAttribute('aria-pressed', String(mine === k));
      b.disabled = mine >= 0 || locked;
      b.addEventListener('click', () => h.onPredict(k));
      box.append(b);
    }
    const prize = 5 + f.k * 5;
    $('predictInfo').textContent = mine >= 0 ? `Elegiste ${LANES[mine]}: si acertás, +${prize} destellos.`
      : locked ? 'Ya se cerraron las predicciones.'
      : `Acertá y ganás ${prize} destellos. Llevás ${stats.hits} ${stats.hits === 1 ? 'acierto' : 'aciertos'}.`;
  }
  function setRival(name, rankLabel, label = 'Rival') {
    $('hRival').querySelector('.lbl').textContent = label;
    $('hRivalName').textContent = name;
    $('hRivalRank').textContent = rankLabel;
  }

  // Online: sin "Otra ronda" ni "Ver resultado" (la ronda la maneja el servidor)
  function setOnlineMode(on) {
    $('spectActions').hidden = on;
    document.body.classList.toggle('is-online', on);
  }

  // Tabla de la sala al final de una ronda online
  function renderStandings(list, myId) {
    const box = $('rStandings');
    box.innerHTML = '';
    box.hidden = !list || list.length < 1;
    if (box.hidden) return;
    const head = document.createElement('p');
    head.className = 'lbl';
    head.textContent = 'Tu sala';
    box.append(head);
    const ol = document.createElement('ol');
    for (const p of list.slice(0, 12)) {
      const li = document.createElement('li');
      if (p.id === myId) li.className = 'me';
      const n = document.createElement('b'); n.textContent = '#' + fmt(p.rank);
      const nm = document.createElement('span');
      if (p.lvl) { const lv = document.createElement('span'); lv.innerHTML = levelEmblem(p.lvl, levelBadgeOf(p.lvl), 22); nm.append(lv.firstChild); }
      nm.append(skinPreview(skinById(p.skin)), nameTag(p.name, nameStyleById(p.nameStyle)));
      if (p.id === myId) nm.append(' (vos)');
      const sc = document.createElement('em'); sc.textContent = fmt(p.score) + ' pts';
      li.append(n, nm, sc);
      ol.append(li);
    }
    box.append(ol);
  }

  function setClip(on) { $('clipBtn').hidden = !on; }

  function setAgain(label, count) {
    const b = $('again');
    b.firstChild.textContent = label + ' ';
    $('rNext').hidden = count === null;
    if (count !== null) $('rNext').textContent = count;
  }

  function showHud(on) {
    $('hud').hidden = !on;
    hudKey = '';
    if (!on) clearFeed();
  }
  function showSpectator(rank, total, pct, tip) {
    $('spectText').innerHTML = `Puesto <b>#${fmt(rank)}</b> de ${fmt(total)} · más que el ${pctText(pct)}.`;
    if (tip) { const t = document.createElement('span'); t.className = 'spect-tip'; t.textContent = tip; $('spectText').append(t); }
    $('spect').hidden = false;
  }
  function hideSpectator() { $('spect').hidden = true; $('predict').hidden = true; predKey = ''; }

  // ---------- Menú ----------
  // Devuelve si hay recompensa diaria disponible
  function renderMenu(save, env) {
    // Secciones habilitadas de a una; la próxima se muestra bloqueada como adelanto
    const next = nextFeature(save);
    const gate = (el, id) => {
      if (!el) return;
      const on = isUnlocked(save, id), teaser = !on && next && next.id === id;
      el.hidden = !on && !teaser;
      el.classList.toggle('locked-tile', teaser);
      el.disabled = teaser;
      el.dataset.soon = teaser ? `En ${next.rounds - save.rounds} ${next.rounds - save.rounds === 1 ? 'ronda' : 'rondas'}` : '';
      el.classList.toggle('fresh', on && save.rounds >= 1 && !(save.seenFeat || {})[id] && !save.ownerAll);
    };
    document.querySelectorAll('.menu-grid .tile[data-open]').forEach(t => gate(t, t.dataset.open));
    gate($('onlineBtn'), 'online');
    gate($('challengeBtn'), 'challenge');
    const grid = document.querySelector('.menu-grid');
    const shown = [...grid.children].filter(t => !t.hidden).length;
    grid.dataset.n = shown;
    // Desafío del día y modo del finde
    const c = save.challenge || {};
    $('challengeSub').textContent = c.day === challengeDay() && c.best ? `Tu mejor hoy: ${fmt(c.best)} pts  ${c.log || ''}` : 'La misma ronda para todos · cambia cada día';
    const wk = weekendMode();
    $('weekendBtn').hidden = !wk || !isUnlocked(save, 'challenge');
    if (wk) { $('weekendName').textContent = `Finde: ${wk.name}`; $('weekendSub').textContent = wk.desc; }
    $('boardsBtn').hidden = !isUnlocked(save, 'challenge');
    const li = levelInfo(save.xp);
    $('pLevel').textContent = li.level;
    $('pXp').textContent = `${fmt(li.into)} / ${fmt(li.need)} XP`;
    $('ringFill').style.strokeDashoffset = String(RING * (1 - li.into / li.need));
    $('coins').textContent = fmt(save.coins);

    const rk = rankOf(save.pr);
    $('rankEmblem').innerHTML = emblem(rk.tier, 46);
    $('rankLabel').textContent = rk.label;
    $('rankPr').textContent = rk.need ? `${fmt(rk.into)} / ${fmt(rk.need)} PR` : `${fmt(save.pr)} PR`;
    $('rankFill').style.width = rk.need ? (rk.into / rk.need * 100) + '%' : '100%';
    $('rankBtn').style.setProperty('--rank', TIERS[rk.tier].col);
    // Marco del perfil según la liga máxima alcanzada
    const peak = rankOf(save.peakPR).tier;
    $('profileBtn').dataset.tier = peak;
    $('profileBtn').style.setProperty('--rank', TIERS[peak].col);
    $('rankBtn').dataset.tier = rk.tier;
    $('pathBadge').innerHTML = save.pathStreak >= 2 ? `${ICON.flame}${save.pathStreak}` : '';

    const mis = save.missions && save.missions.day === env.today ? save.missions.list : [];
    $('tMissions').textContent = `${mis.filter(m => m.claimed).length}/${mis.length || 3}`;
    const claim = claimableMissions(save);
    $('bMissions').hidden = !claim;
    $('bMissions').textContent = claim;
    $('bShop').hidden = save.shopSeen === env.today;
    $('tSkins').textContent = `${ownedSkins(save).length + ownedTrails(save).length}/${SKINS.length + TRAILS.length}`;
    // Distintivo de nivel alrededor del anillo
    const lb = levelBadgeOf(li.level);
    $('pBadge').innerHTML = lb.tier ? levelEmblem(li.level, lb, 58, true) : '';
    $('profileBtn').querySelector('.ring').style.setProperty('--lb', lb.tier ? lb.col : '');
    if (li.max) $('pXp').textContent = 'Nivel máximo';
    const passN = claimablePass(save).length, achN = claimableAch(save).length;
    $('bSeason').hidden = !passN;
    $('bSeason').textContent = passN;
    $('tSeason').textContent = `Nv ${passInfo(save.passXp || 0).level}`;
    $('bProfile').hidden = !achN;
    $('bProfile').textContent = achN;
    $('tFriends').textContent = save.friends.length ? `${save.friends.length}` : 'Agregar';
    $('tMusic').textContent = `${ownedMusic(save).length}/${MUSIC.length}`;
    $('tNames').textContent = `${ownedNames(save).length}/${NAME_STYLES.length}`;
    // Chip de perfil: el nombre con su estilo (o el título si todavía no eligió nombre)
    const pt = $('pTitle');
    pt.innerHTML = '';
    if (save.name) pt.append(nameTag(save.name, nameStyleById(save.nameStyle)));
    else pt.textContent = displayTitle(save);

    $('sBest').textContent = save.rounds ? pctText(save.best) : '—';
    $('sRounds').textContent = fmt(save.rounds);
    $('sStreak').textContent = fmt(streakNow(save));
    $('sInstinct').textContent = save.forksSeen ? instinct(save) + '%' : '—';
    return dailyState(save, env.today, env.yesterday).available;
  }

  function showScreen(name) {
    $('menu').hidden = name !== 'menu';
    $('results').hidden = name !== 'results';
    // Solo mover el foco si se está usando el teclado (evita el anillo de foco al tocar)
    if (lastInputKeyboard) {
      if (name === 'menu') $('play').focus({ preventScroll: true });
      if (name === 'results') $('again').focus({ preventScroll: true });
    }
  }

  // ---------- Resultados ----------
  function tween(elm, from, to, fmtFn, d = 900) {
    if (reduceMotion) { elm.textContent = fmtFn(to); return; }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / d);
      elm.textContent = fmtFn(from + (to - from) * easeOutCubic(k));
      if (k < 1 && !$('results').hidden) requestAnimationFrame(tick);
      else elm.textContent = fmtFn(to);
    };
    requestAnimationFrame(tick);
  }

  // "Casi": la meta más cercana que te quedó a mano (motiva a jugar otra)
  function nextGoalText(sum) {
    if (sum.outlier) return '';
    for (const T of [1, 3, 10, 50, 100]) {
      if (sum.rank > T && sum.rank <= Math.max(T * 2, T + 5)) {
        const d = sum.rank - T;
        return T === 1 ? `A ${fmt(d)} ${d === 1 ? 'puesto' : 'puestos'} de ser el Outlier` : `A ${fmt(d)} ${d === 1 ? 'puesto' : 'puestos'} del Top ${T}`;
      }
    }
    if (!sum.alive && sum.forksOk === sum.forks - 1) return '¡Te faltó una sola bifurcación para llegar al final!';
    const best = h.getSave().bestScore;
    if (best && sum.score < best && sum.score >= best * 0.8) return `A ${fmt(best - sum.score)} puntos de tu récord`;
    return '';
  }

  function renderResults(sum, rep, outlier) {
    $('rEyebrow').textContent = sum.outlier ? 'Sos el Outlier del minuto'
      : rep.pr.promoted ? 'Ascenso'
      : rep.recordPos === 1 && rep.recordCount > 1 ? 'Nuevo récord de puntos'
      : rep.newBestPct ? 'Nuevo mejor puesto'
      : sum.alive ? 'Llegaste al final' : 'Fin de la ronda';
    tween($('rRank'), sum.total, sum.rank, v => '#' + fmt(v));
    $('rOf').textContent = 'de ' + fmt(sum.total);
    $('rPct').textContent = sum.outlier
      ? 'Nadie duró más que vos. Tu nombre sale en la pantalla de todos.'
      : `Sobreviviste más que el ${pctText(sum.pct)} de los jugadores.`;
    if (sum.kind === 'challenge') $('rEyebrow').textContent = sum.challengeBest ? 'Desafío del día · ¡tu mejor intento!' : 'Desafío del día';
    else if (sum.kind === 'weekend') $('rEyebrow').textContent = 'Modo del finde';
    $('rWhy').textContent = WHY_TEXT[sum.alive ? 'alive' : sum.why] || '';
    $('rTip').textContent = !sum.alive && sum.tip ? sum.tip : '';
    $('rTip').hidden = sum.alive || !sum.tip;
    $('rGoal').textContent = nextGoalText(sum);
    $('rGoal').hidden = !$('rGoal').textContent;
    $('rForks').textContent = `${sum.forksOk}/${sum.forks}`;
    $('rScore').textContent = fmt(sum.score);
    $('rNear').textContent = fmt(sum.near);
    $('rOrbs').textContent = fmt(sum.orbs);

    // Rango
    const pr = rep.pr, rk = pr.rankAfter;
    $('rEmblem').innerHTML = emblem(rk.tier, 40);
    $('rRankLabel').textContent = rk.label;
    const dEl = $('rPrDelta');
    dEl.className = 'delta ' + (pr.delta > 0 ? 'up' : pr.delta < 0 ? 'down' : '');
    dEl.textContent = (pr.delta > 0 ? '+' : '') + fmt(pr.delta) + ' PR' + (pr.raw < pr.delta ? ' · protegido' : '');
    const rf = $('rPrFill');
    rf.parentElement.style.setProperty('--rank', TIERS[rk.tier].col);
    const sameDiv = pr.rankBefore.tier === rk.tier && pr.rankBefore.div === rk.div;
    rf.style.transition = 'none';
    rf.style.width = (sameDiv && pr.rankBefore.need ? pr.rankBefore.into / pr.rankBefore.need * 100 : 0) + '%';
    void rf.offsetWidth;
    rf.style.transition = '';
    rf.style.width = rk.need ? (rk.into / rk.need * 100) + '%' : '100%';

    // XP y destellos
    tween($('rXp'), 0, rep.gain, v => '+' + fmt(v));
    tween($('rCoins'), 0, rep.coins, v => '+' + fmt(v));
    $('rLevel').textContent = `Nivel ${rep.after.level} · ${displayTitle(h.getSave())}`;
    const fill = $('rXpFill'), up = rep.after.level > rep.before.level;
    fill.classList.remove('anim');
    fill.style.width = (up ? 0 : rep.before.into / rep.before.need * 100) + '%';
    void fill.offsetWidth;
    fill.classList.add('anim');
    fill.style.width = (rep.after.into / rep.after.need * 100) + '%';

    const lines = [];
    if (up) lines.push(`¡Subiste a nivel ${rep.after.level}!`);
    if (rep.newSkins.length) lines.push(`Nueva skin: ${rep.newSkins.map(k => k.name).join(' y ')}.`);
    if (rep.newTrails.length) lines.push(`Nueva estela: ${rep.newTrails.map(k => k.name).join(' y ')}.`);
    if (sum.predHits) lines.push(`Predicciones: ${sum.predHits} ${sum.predHits === 1 ? 'acierto' : 'aciertos'} (+${fmt(rep.predCoins)} destellos).`);
    $('rUnlock').hidden = !lines.length;
    $('rUnlock').textContent = lines.join(' ');

    // Rival
    const rv = $('rRival');
    rv.hidden = !sum.rival;
    rv.className = 'rival-line' + (sum.beatRival ? ' win' : '');
    rv.innerHTML = sum.beatRival
      ? `Le ganaste a tu rival <b>${esc(sum.rival)}</b> · <b>+5 PR</b>`
      : `Tu rival <b>${esc(sum.rival)}</b> duró más que vos.`;

    // Misiones del día
    const ul = $('rMissions');
    ul.innerHTML = '';
    const list = (rep.missions || []).filter(m => !m.claimed);
    for (const m of list) {
      const li = document.createElement('li');
      if (m.progress >= m.goal) li.className = 'done';
      li.append(missionText(m));
      const b = document.createElement('b');
      b.textContent = m.progress >= m.goal ? 'Lista' : `${fmt(m.progress)}/${fmt(m.goal)}`;
      li.append(b);
      ul.append(li);
    }
    ul.hidden = !list.length;

    const box = $('rAch');
    box.innerHTML = '';
    for (const a of rep.newAch) {
      const chip = document.createElement('span');
      chip.className = 'ach-chip';
      chip.innerHTML = ICON.trophy;
      chip.append(a.name);
      box.append(chip);
    }
    box.hidden = !rep.newAch.length;

    $('rOutlier').textContent = outlier.you ? `¡Vos! · ${fmt(outlier.score)} pts` : `${outlier.name} · ${fmt(outlier.score)} pts`;
    renderStandings(null);
  }

  function setNext(n) { $('rNext').textContent = n; }

  // ---------- Ventanas ----------
  let opener = null, modalKind = '', modalData = null;
  const env = () => ({ ...h.env(), save: h.getSave(), getSave: h.getSave, h, close: closeModal });

  function openModal(kind, data) {
    if ($('modal').hidden) opener = document.activeElement;
    modalKind = kind;
    modalData = data;
    $('modalTitle').textContent = TITLES_BY_KIND[kind];
    const body = $('modalBody');
    body.innerHTML = '';
    buildModal(kind, body, env(), data);
    $('modal').hidden = false;
    body.scrollTop = 0;
    if (lastInputKeyboard) $('modal').querySelector('.sheet-head [data-close]').focus({ preventScroll: true });
    h.onModal(kind);
  }
  function refreshModal() {
    if (!modalKind) return;
    const body = $('modalBody'), top = body.scrollTop;
    body.innerHTML = '';
    buildModal(modalKind, body, env(), modalData);
    body.scrollTop = top;
  }
  function closeModal() {
    if ($('modal').hidden) return;
    $('modal').hidden = true;
    const k = modalKind;
    modalKind = '';
    h.onModalClosed(k);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  // ---------- Conexiones ----------
  $('play').addEventListener('click', h.onPlay);
  $('again').addEventListener('click', h.onAgain);
  $('onlineBtn').addEventListener('click', () => { h.onUi(); h.onOnline(); });
  $('home').addEventListener('click', h.onHome);
  $('skip').addEventListener('click', h.onSkip);
  $('nextNow').addEventListener('click', h.onNextNow);
  // pointerdown para que el impulso responda al instante
  $('dashL').addEventListener('pointerdown', e => { e.preventDefault(); h.onDash(-1); });
  $('dashR').addEventListener('pointerdown', e => { e.preventDefault(); h.onDash(1); });
  $('shareBtn').addEventListener('click', h.onShare);
  const opens = { settingsBtn: 'settings', profileBtn: 'profile', coinsBtn: 'shop', rankBtn: 'rank' };
  $('boardsBtn').addEventListener('click', () => { h.onUi(); openModal('boards'); h.onBoard(); });
  $('challengeBtn').addEventListener('click', () => { h.onUi(); h.onChallenge(); });
  $('weekendBtn').addEventListener('click', () => { h.onUi(); h.onWeekend(); });
  $('clipBtn').addEventListener('click', () => { h.onUi(); h.onShareClip(); });
  for (const [id, kind] of Object.entries(opens)) $(id).addEventListener('click', () => { h.onUi(); openModal(kind); });
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { h.onUi(); openModal(b.dataset.open); }));
  $('modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab' && !$('modal').hidden) {
      // Mantener el foco dentro de la ventana
      const f = [...$('modal').querySelectorAll('button:not([disabled]), a[href]')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  return {
    setOnlineMode, renderStandings, setAgain, setClip,
    banner, hideBanner, hint, hideHint, flash, toast, feed, clearFeed, hud, setRival, showHud, dashButtons, hideDash, predict,
    showSpectator, hideSpectator, renderMenu, showScreen, renderResults, setNext,
    openModal, refreshModal, closeModal,
    get modalOpen() { return !$('modal').hidden; },
    get modalKind() { return modalKind; },
  };
}
