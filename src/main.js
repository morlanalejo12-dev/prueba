// Punto de entrada: conecta simulación, render, audio e interfaz.
// Máquina de estados: menu → countdown → playing → results → (countdown | menu)
import { CFG } from './config.js';
import { fmt } from './util/math.js';
import { hash01 } from './util/rng.js';
import { Round } from './sim/round.js';
import { AudioEngine } from './audio/audio.js';
import { Renderer, skinColor } from './render/renderer.js';
import { Fx } from './render/fx.js';
import { renderShareCard, shareText } from './render/share.js';
import {
  loadSave, writeSave, resetSave, applyRound, claimMission, localStore, levelInfo, titleOf,
  dayKey, yesterdayOf, ownedCtx,
} from './game/progress.js';
import { skinById, isOwned } from './game/skins.js';
import { rankOf, botRankLabel } from './game/ranks.js';
import { ensureMissions, buySkin, claimDaily, missionText } from './game/meta.js';
import { createUI, $ } from './ui/ui.js';

const store = localStore();
let save = loadSave(store);
const persist = () => writeSave(store, save);

const audio = new AudioEngine();
audio.sfxOn = save.sfx;
audio.musicOn = save.music;
const renderer = new Renderer($('game'));
const C = renderer.C;
const fx = new Fx();

let state = 'menu';
let R = null;
let acc = 0, slow = 1, slowT = 0;
let countT = 0, endAt = null, nextT = 0, tickT = 0, emitT = 0;
let lastSum = null;
let tutorial = null;
let dailyOffered = false;
const trail = [];
const TRAIL_LEN = 44;
const LANE = ['A', 'B', 'C', 'D'];

const randSeed = () => (Math.random() * 4294967296) >>> 0;
const env = () => { const now = new Date(); return { today: dayKey(now), yesterday: dayKey(yesterdayOf(now)) }; };

function buzz(pattern) {
  if (!save.vib) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* no disponible */ }
}

// La skin elegida, si todavía es tuya (por ejemplo, después de borrar el progreso)
function playerSkin() {
  const sk = skinById(save.skin);
  return isOwned(sk, ownedCtx(save)) ? sk : skinById('ambar');
}

function refreshMenu() {
  return ui.renderMenu(save, env());
}

const ui = createUI({
  env,
  getSave: () => save,
  onPlay: () => { audio.unlock(); startRound(); },
  onHome: () => { audio.play('ui'); toMenu(); },
  onSkip: () => {
    if (state === 'playing' && !R.pAlive) { R.runToEnd(); drainEvents(); endAt = 0.05; }
  },
  onShare: openShare,
  onUi: () => { audio.unlock(); audio.play('ui'); },
  onModal: kind => {
    if (kind === 'shop' && save.shopSeen !== env().today) { save.shopSeen = env().today; persist(); refreshMenu(); }
  },
  onModalClosed: () => {},
  onSelectSkin: id => { save.skin = id; persist(); refreshMenu(); ui.refreshModal(); audio.play('ui'); },
  onBuy: offer => {
    if (!buySkin(save, offer)) return;
    save.skin = offer.id;
    persist();
    audio.play('buy');
    buzz([20, 30, 20]);
    ui.toast('Skin nueva', `${skinById(offer.id).name} · equipada`);
    refreshMenu();
    ui.refreshModal();
  },
  onClaimMission: i => {
    const r = claimMission(save, i);
    if (!r) return;
    persist();
    audio.play('claim');
    buzz(20);
    ui.toast('Misión cumplida', `+${fmt(r.coins)} destellos · +${r.xp} XP`);
    if (r.after.level > r.before.level) setTimeout(() => { audio.play('levelup'); ui.toast('Subiste de nivel', `Nivel ${r.after.level}`); }, 500);
    refreshMenu();
    ui.refreshModal();
  },
  onClaimDaily: () => {
    const e = env();
    const r = claimDaily(save, e.today, e.yesterday);
    if (!r) return;
    persist();
    audio.play('claim');
    buzz([20, 40, 20]);
    ui.toast(`Día ${r.index + 1} reclamado`, r.skin ? `Skin ${skinById(r.skin).name}` : `+${fmt(r.coins)} destellos`);
    refreshMenu();
    ui.refreshModal();
  },
  onToggle: key => {
    save[key] = !save[key];
    persist();
    audio.unlock();
    audio.setSfx(save.sfx);
    audio.setMusic(save.music);
    if (key === 'vib') buzz(25);
    audio.play('ui');
  },
  onReset: () => {
    save = resetSave(store);
    ensureMissions(save, env().today);
    audio.setSfx(save.sfx);
    audio.setMusic(save.music);
    refreshMenu();
  },
});

// ---------- Transiciones de estado ----------
function resetView() {
  fx.reset();
  trail.length = 0;
  acc = 0; slow = 1; slowT = 0; tickT = 0;
}

function toMenu() {
  state = 'menu';
  R = new Round({ seed: randSeed(), demo: true });
  resetView();
  ui.showHud(false);
  ui.hideSpectator(); ui.hideBanner(); ui.hideHint();
  ensureMissions(save, env().today);
  const dailyReady = refreshMenu();
  ui.showScreen('menu');
  if (dailyReady && !dailyOffered) {
    dailyOffered = true;
    setTimeout(() => { if (state === 'menu' && !ui.modalOpen) ui.openModal('daily'); }, 700);
  }
}

function startRound() {
  ui.closeModal();
  R = new Round({ seed: randSeed() });
  resetView();
  state = 'countdown';
  countT = CFG.COUNTDOWN_S;
  endAt = null;
  tutorial = save.rounds < 2 ? { chips: false } : null;
  ui.showScreen('none');
  ui.showHud(true);
  ui.setRival(R.rivalName, botRankLabel(hash01(R.rival, R.seed), save.pr));
  ui.hideSpectator(); ui.hideBanner(); ui.hideHint();
  ui.banner(String(countT), `${fmt(R.n + 1)} jugadores listos`, 'count', 900);
  audio.play('count');
  if (tutorial) ui.hint('Arrastrá el dedo o el mouse para moverte.', 3000);
  else ui.hint(`Tu rival es ${R.rivalName}: durá más que él.`, 2600);
}

function finishRound() {
  state = 'results';
  lastSum = R.summary();
  const rep = applyRound(save, lastSum);
  persist();
  ui.showHud(false); ui.hideSpectator(); ui.hideBanner(); ui.hideHint();
  ui.renderResults(lastSum, rep, R.outlier);
  ui.showScreen('results');
  nextT = CFG.NEXT_S;
  ui.setNext(nextT);

  if (lastSum.outlier) { audio.play('outlier'); buzz([30, 50, 30, 50, 60]); }
  if (rep.after.level > rep.before.level) setTimeout(() => { audio.play('levelup'); buzz([20, 30, 20]); }, 700);
  let delay = 1000;
  const later = fn => { setTimeout(fn, delay); delay += 800; };
  for (const a of rep.newAch) later(() => { ui.toast('Logro desbloqueado', a.name); audio.play('ach'); });
  for (const m of rep.missionsDone) later(() => { ui.toast('Misión lista para reclamar', missionText(m)); audio.play('claim'); });
  for (const k of rep.newSkins) later(() => { ui.toast('Skin desbloqueada', k.name); audio.play('buy'); });

  if (rep.pr.promoted) {
    const rk = rep.pr.rankAfter;
    const skin = rep.newSkins.find(k => k.src.type === 'rank');
    setTimeout(() => {
      if (state !== 'results') return;
      audio.play('rankup');
      buzz([40, 60, 40, 60, 80]);
      ui.openModal('rankup', { tier: rk.tier, label: rk.label, newTier: rk.tier > rep.pr.rankBefore.tier, skin: skin && skin.name });
    }, 1500);
  }
}

function openShare() {
  if (!lastSum) return;
  audio.play('ui');
  const li = levelInfo(save.xp);
  const image = renderShareCard(lastSum, {
    colors: C, fonts: { display: renderer.FD, body: renderer.FB, mono: renderer.FM },
    playerColor: skinColor(playerSkin(), 1), level: li.level, title: titleOf(li.level), rank: rankOf(save.pr).label,
  });
  ui.openModal('share', { image, text: shareText(lastSum) });
}

// ---------- Eventos de la simulación ----------
function drainEvents() {
  for (const e of R.events) handle(e);
  R.events.length = 0;
}

function handle(e) {
  switch (e.type) {
    case 'orb':
      fx.burst(e.x, e.y, 8, C.gold, 140);
      fx.pop(e.x, e.y, `+${e.pts}`, C.gold);
      audio.play('orb', e.chain);
      buzz(6);
      break;
    case 'nearMiss': {
      const col = skinColor(playerSkin(), R.t);
      fx.burst(e.x, e.y, 12, col, 200);
      fx.pop(e.x, e.y, (e.combo > 1 ? `x${e.combo} ` : '') + `¡Justo! +${e.pts}`, col);
      audio.play('near', e.combo);
      buzz(12);
      break;
    }
    case 'gatePass': audio.play('pass'); break;
    case 'forkAnnounce': announce(e.fork); break;
    case 'forkResolved': onForkResolved(e); break;
    case 'playerDied': onPlayerDied(e); break;
    case 'milestone':
      ui.banner(`Top ${e.n}`, `Quedan ${fmt(R.aliveTotal)} · +${e.pts} puntos`, 'gold', 1300);
      ui.feed('gold', 'Entraste al ', `top ${e.n}`);
      fx.pop(e.x, e.y, `+${e.pts}`, C.gold);
      audio.play('milestone');
      buzz([15, 30, 15]);
      break;
    case 'rivalDown':
      ui.feed('good', 'Tu rival ', e.name, ' cayó');
      audio.play('rival');
      break;
    default: break;
  }
}

function announce(f) {
  const sub = f.invert ? 'Inversión: esta vez cae el camino con MENOS gente'
    : f.variant === 'golden' ? 'Camino dorado: x2 puntos, pero todos lo ven'
    : f.variant === 'narrow' ? 'Hay un camino angosto: difícil de pasar'
    : f.variant === 'fog' ? 'Niebla: no ves a la multitud'
    : 'El camino con más gente se derrumba';
  const first = tutorial && f.i === 0;
  ui.banner(`Se divide en ${f.k}`, first ? 'Andá al camino con menos gente' : sub, f.invert ? 'gold' : '', 1600);
  audio.play(f.invert ? 'invert' : 'announce');
  if (f.invert) { buzz([30, 40, 30]); ui.feed('gold', '', 'Inversión', ': cae el camino más vacío'); }
  if (first) ui.hint('Mirá los porcentajes: el camino con MÁS gente se derrumba.', 4200);
}

function onForkResolved(e) {
  if (e.fx && e.fx.length) fx.fall(e.fx, C.danger);
  if (R.demo) return;
  if (e.collapsed.length) {
    slow = 0.22; slowT = 0.55;
    fx.addTrauma(0.45);
    audio.play('collapse');
    const lanes = e.collapsed.map(k => LANE[k]).join(' y ');
    ui.feed('hot', `Colapsó el camino ${lanes}: `, `${fmt(e.fallen)} cayeron`);
  } else {
    ui.feed('', 'Todos eligieron el mismo camino: ', 'resistió');
  }
  if (e.outcome === 'survived') {
    const sub = e.collapsed.length
      ? `Cayeron ${fmt(e.fallen)}${e.gold ? ' · camino dorado: x2' : ''}`
      : 'Todos eligieron lo mismo: el camino resistió';
    ui.banner('Sobreviviste', sub, 'ok', 1500);
    if (e.collapsed.length) ui.flash(e.gold ? C.gold : C.spark);
    audio.play('survive');
    buzz([20, 40, 20]);
  }
}

function onPlayerDied(e) {
  fx.burst(e.x, e.y, 30, skinColor(playerSkin(), R.t), 260, 3.5);
  fx.addTrauma(0.7);
  ui.flash(C.danger);
  audio.play('die');
  buzz(160);
  const sub = e.why === 'wall' ? 'Te llevaste puesto un muro'
    : e.why === 'inverted' ? `Era una inversión: caía el más vacío (${fmt(e.sameEvent + 1)} cayeron con vos)`
    : `Elegiste el camino de la mayoría (${fmt(e.sameEvent + 1)} cayeron con vos)`;
  ui.banner(e.why === 'wall' ? 'Chocaste' : 'Caíste', sub, 'bad', 1800);
  ui.showSpectator(e.rank, R.n + 1, e.pct);
}

// ---------- Ciclo por cuadro ----------
function tensionTick(dt) {
  const f = R.fork;
  if (!f || !R.pAlive || R.pY < f.entryY || R.pY >= f.endY) return;
  const p = (R.pY - f.entryY) / (f.endY - f.entryY);
  tickT -= dt;
  if (tickT <= 0) { tickT = 0.28 - p * 0.18; audio.play('tick', p); }
}

// Partículas de las estelas especiales (chispas y fuego)
function emitTrail(dt, sk) {
  if (!R.pAlive || R.demo || (sk.trail !== 'spark' && sk.trail !== 'fire')) return;
  emitT -= dt;
  if (emitT > 0) return;
  emitT = sk.trail === 'fire' ? 0.012 : 0.03;
  const col = Math.random() < 0.5 ? skinColor(sk, R.t) : (sk.col2 || skinColor(sk, R.t));
  if (sk.trail === 'fire') fx.spawn(R.px + (Math.random() - 0.5) * 8, R.pY - 4, (Math.random() - 0.5) * 50, R.speed * 0.55, 0.3, col, 4);
  else fx.spawn(R.px + (Math.random() - 0.5) * 14, R.pY, (Math.random() - 0.5) * 90, R.speed * 0.4 - 60, 0.45, col, 2.5);
}

function intensity() {
  if (state === 'playing') return R.pAlive ? R.tension() : 0.25;
  if (state === 'countdown') return 0.32;
  return state === 'menu' ? 0.18 : 0.12;
}

function simulate(dt) {
  acc += dt;
  while (acc >= CFG.FIXED_DT) { R.step(CFG.FIXED_DT); acc -= CFG.FIXED_DT; }
  drainEvents();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const sk = playerSkin();

  if (state === 'countdown') {
    const before = Math.ceil(countT);
    countT -= dt;
    R.movePlayer(dt, null);
    if (countT <= 0) {
      state = 'playing';
      ui.banner('¡Ya!', `${fmt(R.n + 1)} jugadores cayendo a la vez`, 'ok', 900);
      audio.play('go');
      buzz(30);
    } else if (Math.ceil(countT) !== before) {
      ui.banner(String(Math.ceil(countT)), `${fmt(R.n + 1)} jugadores listos`, 'count', 900);
      audio.play('count');
    }
  } else if (state === 'playing') {
    if (slowT > 0) slowT -= dt;
    else slow = Math.min(1, slow + dt * 2.5);
    simulate(dt * slow);
    tensionTick(dt);
    emitTrail(dt, sk);
    if (tutorial && !tutorial.chips && R.t > 0.6) {
      tutorial.chips = true;
      ui.hint('Juntá las chispas doradas y pasá por el hueco de cada muro.', 3600);
    }
    if (R.ended) {
      if (endAt === null) endAt = 1.4;
      endAt -= dt;
      if (endAt <= 0) finishRound();
    }
  } else {
    simulate(dt);
    if (state === 'menu' && R.ended) R = new Round({ seed: randSeed(), demo: true });
    if (state === 'results' && !ui.modalOpen) {
      const before = Math.ceil(nextT);
      nextT -= dt;
      if (Math.ceil(nextT) !== before) {
        ui.setNext(Math.max(0, Math.ceil(nextT)));
        if (nextT <= 3 && nextT > 0) audio.play('count');
      }
      if (nextT <= 0) startRound();
    }
  }

  if (R.pAlive && !R.demo) {
    trail.push(R.px, R.pY);
    if (trail.length > TRAIL_LEN) trail.splice(0, 2);
  }
  if (state === 'countdown' || state === 'playing') ui.hud(R);
  fx.update(dt);
  audio.setIntensity(intensity());
  renderer.draw(R, fx, { skin: sk, trail });
  requestAnimationFrame(frame);
}

// ---------- Entrada ----------
const cv = $('game');
let pDown = false;
const keys = new Set();
const canSteer = () => R && !R.demo && (state === 'playing' || state === 'countdown');

cv.addEventListener('pointerdown', e => {
  audio.unlock();
  pDown = true;
  if (canSteer()) R.setTarget(renderer.toWorldX(e.clientX));
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
});
cv.addEventListener('pointermove', e => {
  if ((pDown || e.pointerType === 'mouse') && canSteer()) R.setTarget(renderer.toWorldX(e.clientX));
});
for (const t of ['pointerup', 'pointercancel']) cv.addEventListener(t, () => { pDown = false; });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

const KEYMAP = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
function applyKeys() {
  if (canSteer()) R.setKeyDir((keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0));
}
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.key];
  if (!k || ui.modalOpen) return;
  keys.add(k);
  applyKeys();
  if (canSteer()) e.preventDefault();
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.key];
  if (!k) return;
  keys.delete(k);
  applyKeys();
});

window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => { last = performance.now(); });

// ---------- Arranque ----------
$('lobbyCount').textContent = fmt(CFG.BOTS + 1);
toMenu();
requestAnimationFrame(frame);

// Acceso para pruebas desde la consola
window.__contracorriente = {
  get round() { return R; },
  get state() { return state; },
  get save() { return save; },
  startRound,
  finishRound,
  toMenu,
  persist,
};
