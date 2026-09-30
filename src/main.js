// Punto de entrada: conecta simulación, render, audio e interfaz.
// Máquina de estados: menu → countdown → playing → results → (countdown | menu)
import { CFG } from './config.js';
import { fmt } from './util/math.js';
import { hash01 } from './util/rng.js';
import { Round } from './sim/round.js';
import { AudioEngine } from './audio/audio.js';
import { Renderer, skinColor } from './render/renderer.js';
import { Fx, SHAPE } from './render/fx.js';
import { renderShareCard, shareText } from './render/share.js';
import {
  loadSave, writeSave, resetSave, applyRound, claimMission, localStore, levelInfo, titleOf,
  dayKey, yesterdayOf, ownedCtx,
} from './game/progress.js';
import { skinById, trailById, isOwned } from './game/skins.js';
import { rankOf, botRankLabel, TIERS, TIER_PERKS } from './game/ranks.js';
import { ensureMissions, buySkin, claimDaily, missionText } from './game/meta.js';
import { createUI, $ } from './ui/ui.js';
import { redeemCode } from './game/codes.js';
import { NetClient, serverUrl } from './net/client.js';
import { NetRound } from './net/netround.js';
import { cleanName } from './util/name.js';

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
let riserFork = -1;
// Predicciones del espectador en la ronda actual
let pred = null;
const predStats = { hits: 0, coins: 0 };
let dashHintShown = false;
const trail = [];
const TRAIL_LEN = 44;
const LANE = ['A', 'B', 'C', 'D'];

// Modo online
let mode = 'solo';
let net = null;
const online = { room: null, msg: '', pending: null, url: '', startAt: 0 };
let roomRefreshT = 0;

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

function playerTrail() {
  const tr = trailById(save.trail);
  return isOwned(tr, ownedCtx(save)) ? tr : trailById('basica');
}

function refreshMenu() {
  updateOnlineChip();
  return ui.renderMenu(save, env());
}

function updateOnlineChip() {
  const r = online.room, el = $('onlineSub');
  if (!el) return;
  if (!r) el.textContent = 'Minuto global · salas privadas';
  else if (r.pub) { const t = nextGlobalText(); el.textContent = t ? `En el minuto global · empieza en ${t}` : 'En el minuto global'; }
  else el.textContent = `En la sala ${r.code} · ${r.players.length} ${r.players.length === 1 ? 'jugador' : 'jugadores'}`;
  $('onlineBtn').classList.toggle('in-room', !!r);
}

const ui = createUI({
  env,
  getSave: () => save,
  onPlay: () => { audio.unlock(); leaveOnline(); startRound(); },
  onAgain: () => {
    audio.unlock();
    if (mode === 'online' && online.room) { audio.play('ui'); ui.openModal('room'); }
    else { leaveOnline(); startRound(); }
  },
  onHome: () => { audio.play('ui'); leaveOnline(); toMenu(); },
  onOnline: () => { audio.unlock(); ui.openModal(online.room ? 'room' : 'online'); },
  onlineState: () => ({
    status: net ? net.status : 'off', msg: online.msg, room: online.room, myId: net && net.id,
    askUrl: !serverUrl(''), nextGlobal: nextGlobalText(),
  }),
  onOnlineGo: ({ name, url, action, code }) => onlineGo(name, url, action, code),
  onRoomStart: () => { audio.play('ui'); net && net.send({ t: 'start' }); },
  onRoomLeave: () => { audio.play('ui'); leaveOnline(); ui.closeModal(); refreshMenu(); },
  onInvite: async () => {
    const r = online.room;
    if (!r) return false;
    const hosted = /^https?:$/.test(location.protocol) && !/claude|anthropic/.test(location.hostname);
    const link = hosted ? `${location.origin}${location.pathname}?sala=${r.code}` : '';
    const text = `¡Sumate a mi sala de Contracorriente! Código: ${r.code}${link ? ' · ' + link : ''}`;
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  },
  onDash: dir => doDash(dir),
  onPredict: lane => {
    const f = R.fork;
    if (!f || f.resolved || R.pAlive) return;
    pred = { fork: f.i, lane };
    audio.play('ui');
    buzz(10);
  },
  onNextNow: () => {
    if (state !== 'playing' || R.pAlive || R.online) return;
    audio.play('ui');
    R.runToEnd();
    R.events.length = 0;
    finishRound({ quick: true });
    startRound();
  },
  onSkip: () => {
    if (state === 'playing' && !R.pAlive && !R.online) { R.runToEnd(); drainEvents(); endAt = 0.05; }
  },
  onShare: openShare,
  onUi: () => { audio.unlock(); audio.play('ui'); },
  onModal: kind => {
    if (kind === 'shop' && save.shopSeen !== env().today) { save.shopSeen = env().today; persist(); refreshMenu(); }
  },
  onModalClosed: () => {},
  onSelectSkin: id => { save.skin = id; persist(); refreshMenu(); ui.refreshModal(); audio.play('ui'); },
  onSelectTrail: id => { save.trail = id; persist(); refreshMenu(); ui.refreshModal(); audio.play('ui'); },
  onCollectionTab: tab => { audio.play('ui'); ui.openModal('collection', { tab }); },
  onBuy: offer => {
    if (!buySkin(save, offer)) return;
    const isTrail = offer.kind === 'trail';
    if (isTrail) save.trail = offer.id; else save.skin = offer.id;
    persist();
    audio.play('buy');
    buzz([20, 30, 20]);
    ui.toast(isTrail ? 'Estela nueva' : 'Skin nueva', `${(isTrail ? trailById : skinById)(offer.id).name} · equipada`);
    refreshMenu();
    ui.refreshModal();
  },
  onRedeem: input => {
    const r = redeemCode(save, input);
    if (!r.ok) { audio.play('die'); buzz(40); return r; }
    persist();
    audio.play('rankup');
    buzz([30, 40, 30, 40, 60]);
    if (r.reward.item) ui.toast(r.reward.item.rarity === 'fundador' ? 'Rareza Fundador' : 'Código canjeado', `${r.reward.item.name} · equipada`);
    refreshMenu();
    ui.openModal('redeemed', r);
    return r;
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
    refreshMenu();
    ui.openModal('daily', { claimed: r });
  },
  canInstall: () => !!installPrompt,
  onInstall: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* cancelado */ }
    installPrompt = null;
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
  acc = 0; slow = 1; slowT = 0; tickT = 0; riserFork = -1;
}

// ---------- Online ----------
function nextGlobalText() {
  const r = online.room;
  if (!r || !r.pub || !net || !r.startAt || r.phase !== 'lobby') return '';
  const s = Math.max(0, Math.ceil((r.startAt - net.serverNow) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function onlineGo(nameRaw, url, action, code) {
  const name = cleanName(nameRaw);
  if (!name) return { error: 'Elegí un nombre para que te reconozcan.' };
  if (action === 'join' && !/^[A-Z]{4}$/.test(code || '')) return { error: 'El código tiene 4 letras.' };
  save.name = name;
  if (url !== null) save.server = (url || '').trim();
  persist();
  const u = serverUrl(save.server);
  if (!u) return { error: 'Poné la dirección del servidor.' };
  online.pending = { action, code };
  online.msg = '';
  if (net && net.status === 'on' && online.url === u) doJoin();
  else {
    if (!net) net = new NetClient(onNet, onNetStatus);
    online.url = u;
    net.connect(u, { name, skin: playerSkin().id, trail: playerTrail().id });
  }
  return {};
}

function doJoin() {
  const p = online.pending;
  online.pending = null;
  if (!p || !net) return;
  net.send({ t: 'join', create: p.action === 'create', code: p.action === 'join' ? p.code : 'GLOBAL' });
}

function leaveOnline() {
  if (net && online.room) net.send({ t: 'leave' });
  online.room = null;
  mode = 'solo';
  ui.setOnlineMode(false);
}

function onNetStatus(status, msg) {
  if (status !== 'error') return;
  online.msg = msg || 'Sin conexión.';
  const wasIn = !!online.room;
  online.room = null;
  if (R && R.online && (state === 'playing' || state === 'countdown')) {
    ui.toast('Sin conexión', online.msg);
    mode = 'solo';
    ui.setOnlineMode(false);
    toMenu();
  } else if (mode === 'online') { mode = 'solo'; ui.setOnlineMode(false); }
  if (ui.modalKind === 'online' || ui.modalKind === 'room') ui.openModal('online');
  else if (wasIn) ui.toast('Online', online.msg);
  refreshMenu();
}

function onNet(m) {
  switch (m.t) {
    case 'welcome': doJoin(); break;
    case 'room': {
      const first = !online.room;
      online.room = m;
      if (first) mode = 'online';
      if (ui.modalKind === 'online' || (first && ui.modalKind !== 'room' && state !== 'playing' && state !== 'countdown')) ui.openModal('room');
      else if (ui.modalKind === 'room') ui.refreshModal();
      refreshMenu();
      break;
    }
    case 'err':
      online.msg = m.msg;
      ui.toast('Online', m.msg);
      if (ui.modalKind === 'online') ui.refreshModal();
      break;
    case 'start': startOnline(m); break;
    case 's': if (R && R.online && R.seed === online.seed) R.onSnap(m); break;
    case 'ev': if (R && R.online && R.seed === online.seed) R.onEvents(m); break;
    case 'end': if (R && R.online && R.seed === online.seed) R.onEnd(m, net.id); break;
    default: break;
  }
}

function startOnline(m) {
  if (R && !R.demo && !R.online && (state === 'playing' || state === 'countdown')) return;
  ui.closeModal();
  mode = 'online';
  online.seed = m.seed;
  online.startAt = m.at;
  R = new NetRound(m, net.id, o => net.send(o));
  resetView();
  pred = null;
  predStats.hits = 0; predStats.coins = 0;
  ui.hideDash();
  ui.setOnlineMode(true);
  state = 'countdown';
  countT = (m.at - net.serverNow) / 1000;
  endAt = null;
  tutorial = null;
  ui.showScreen('none');
  ui.showHud(true);
  const r = online.room, hn = m.humans.length;
  ui.setRival(r && !r.pub ? `Sala ${r.code}` : 'Minuto global', `${hn} ${hn === 1 ? 'real' : 'reales'}`, 'Online');
  ui.hideSpectator(); ui.hideBanner(); ui.hideHint();
  ui.banner(String(Math.max(1, Math.ceil(countT))), `${fmt(R.total)} jugadores · ${hn} ${hn === 1 ? 'real' : 'reales'}`, 'count', 900);
  audio.play('count');
  ui.hint(hn > 1 ? 'Los otros jugadores reales llevan su nombre encima.' : 'Invitá amigos con el código de la sala.', 2600);
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
  // Partida guiada: la primera ronda protege 3 bifurcaciones y la segunda, una
  const guided = save.rounds === 0 ? 3 : save.rounds === 1 ? 1 : 0;
  R = new Round({ seed: randSeed(), guided });
  ui.setOnlineMode(false);
  resetView();
  pred = null;
  predStats.hits = 0; predStats.coins = 0;
  ui.hideDash();
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

// quick: se aplica el resultado sin mostrar la pantalla (botón "Otra ronda")
function finishRound({ quick = false } = {}) {
  if (R.online && !R.summary()) {
    // Mirabas sin jugar esta ronda: volver a la sala
    toMenu();
    if (online.room) ui.openModal('room');
    return;
  }
  lastSum = { ...R.summary(), predHits: predStats.hits, predCoins: predStats.coins };
  const rep = applyRound(save, lastSum);
  persist();
  ui.hideDash();
  if (quick) {
    ui.toast(`Ronda anterior: #${fmt(lastSum.rank)}`, `+${fmt(rep.gain)} XP · +${fmt(rep.coins)} destellos · ${rep.pr.delta >= 0 ? '+' : ''}${fmt(rep.pr.delta)} PR`);
    for (const a of rep.newAch) ui.toast('Logro desbloqueado', a.name);
    return;
  }
  state = 'results';
  ui.showHud(false); ui.hideSpectator(); ui.hideBanner(); ui.hideHint();
  ui.renderResults(lastSum, rep, R.outlier);
  ui.showScreen('results');
  nextT = CFG.NEXT_S;
  if (R.online) {
    ui.renderStandings(R.standings, net && net.id);
    ui.setAgain('Volver a la sala', null);
  } else ui.setAgain('Jugar otra', nextT);

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
      ui.banner(e.n === 2 ? 'Duelo final' : `Top ${e.n}`, `Quedan ${fmt(R.aliveTotal)} · +${e.pts} puntos`, 'gold', 1300);
      fx.ring(e.x, e.y, C.gold, 260, 0.8, 5);
      ui.feed('gold', 'Entraste al ', `top ${e.n}`);
      fx.pop(e.x, e.y, `+${e.pts}`, C.gold);
      audio.play('milestone');
      buzz([15, 30, 15]);
      break;
    case 'overtime':
      if (e.n === 1) {
        ui.banner('Muerte súbita', `Quedan ${fmt(e.alive)}: sigue hasta que quede uno solo`, 'bad', 1800);
        ui.flash(C.danger);
        audio.play('overtime');
        buzz([40, 40, 40]);
      }
      ui.feed('hot', 'Muerte súbita ', `#${e.n}`, `: quedan ${fmt(e.alive)}`);
      break;
    case 'dash': {
      const col = C.mint;
      for (let k = 0; k <= 10; k++) {
        const x = e.x0 + (e.x1 - e.x0) * (k / 10);
        fx.spawn(x, e.y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 40, R.speed * 0.7, 0.35, col, 4);
      }
      fx.ring(e.x1, e.y, col, 90, 0.4, 3);
      fx.pop(e.x1, e.y, '¡Impulso!', col);
      audio.play('dash');
      buzz(25);
      break;
    }
    case 'charge':
      fx.pop(e.x, e.y, '+1 impulso', C.mint);
      fx.ring(R.px, R.pY, C.mint, 70, 0.4, 2);
      audio.play('claim');
      if (!dashHintShown && save.rounds < 4) { dashHintShown = true; ui.hint('Cada 10 chispas ganás un impulso para cambiarte de camino.', 3200); }
      break;
    case 'humanDown':
      ui.feed('hot', '', e.name, e.why === 'wall' ? ' chocó contra un muro' : ' cayó');
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
  // Resultado de la predicción del espectador
  if (pred && pred.fork === e.fork.i) {
    const lane = ['A', 'B', 'C', 'D'][pred.lane];
    if (e.collapsed.includes(pred.lane)) {
      const prize = 5 + e.fork.k * 5;
      predStats.hits++; predStats.coins += prize;
      ui.feed('gold', 'Acertaste: cayó el camino ', lane, ` · +${prize} destellos`);
      audio.play('claim');
      buzz([15, 30, 15]);
    } else {
      ui.feed('', 'Tu predicción falló: ', `el ${lane} resistió`);
    }
    pred = null;
  }
  if (e.collapsed.length) {
    slow = 0.22; slowT = 0.55;
    fx.addTrauma(0.45);
    audio.play('collapse');
    const lanes = e.collapsed.map(k => LANE[k]).join(' y ');
    ui.feed('hot', `Colapsó el camino ${lanes}: `, `${fmt(e.fallen)} cayeron`);
  } else if (e.lottery) {
    slow = 0.22; slowT = 0.55;
    fx.addTrauma(0.45);
    audio.play('collapse');
    ui.feed('hot', 'Nadie se separó: ', `la corriente se llevó a ${fmt(e.fallen)}`);
  } else {
    ui.feed('', 'Todos eligieron el mismo camino: ', 'resistió');
  }
  if (e.outcome === 'survived') {
    const sub = e.collapsed.length
      ? `Cayeron ${fmt(e.fallen)}${e.gold ? ' · camino dorado: x2' : ''}`
      : 'Todos eligieron lo mismo: el camino resistió';
    ui.banner('Sobreviviste', e.lottery ? 'La corriente se llevó a la mitad y vos seguís' : sub, 'ok', 1500);
    if (e.collapsed.length || e.lottery) ui.flash(e.gold ? C.gold : C.spark);
    audio.play('survive');
    audio.play('drop');
    buzz([20, 40, 20]);
    // Festejo: onda expansiva, confeti y el fondo cambia de color
    const col = skinColor(playerSkin(), R.t);
    fx.ring(R.px, R.pY, col, 300, 0.8, 6);
    fx.ring(R.px, R.pY, C.gold, 200, 0.6, 3);
    fx.confetti(R.px, R.pY, 36, [col, C.gold, C.mint, '#ff7ad9', '#8fd8ff'], 360);
  }
}

function onPlayerDied(e) {
  fx.burst(e.x, e.y, 30, skinColor(playerSkin(), R.t), 260, 3.5);
  fx.addTrauma(0.7);
  ui.flash(C.danger);
  audio.play('die');
  buzz(160);
  const sub = e.why === 'wall' ? 'Te llevaste puesto un muro'
    : e.why === 'lottery' ? 'Nadie se separó y la corriente te llevó'
    : e.why === 'inverted' ? `Era una inversión: caía el más vacío (${fmt(e.sameEvent + 1)} cayeron con vos)`
    : `Elegiste el camino de la mayoría (${fmt(e.sameEvent + 1)} cayeron con vos)`;
  ui.banner(e.why === 'wall' ? 'Chocaste' : 'Caíste', sub, 'bad', 1800);
  ui.showSpectator(e.rank, R.total, e.pct);
}

// ---------- Ciclo por cuadro ----------
function tensionTick(dt) {
  const f = R.fork;
  if (!f || !R.pAlive || R.pY < f.entryY || R.pY >= f.endY) return;
  const p = (R.pY - f.entryY) / (f.endY - f.entryY);
  if (riserFork !== f.i) {
    riserFork = f.i;
    audio.play('riser', (f.endY - f.entryY) / R.speed);
  }
  tickT -= dt;
  if (tickT <= 0) { tickT = 0.28 - p * 0.18; audio.play('tick', p); }
}

// Partículas de las estelas especiales
const EMIT_RATE = { spark: 0.03, fire: 0.012, bubbles: 0.07, stars: 0.035, embers: 0.02, supernova: 0.018 };
let novaT = 0;
function emitTrail(dt, sk, tr) {
  const rate = EMIT_RATE[tr.type];
  if (!rate || !R.pAlive || R.demo) return;
  emitT -= dt;
  if (emitT > 0) return;
  emitT = rate;
  const c1 = tr.col || skinColor(sk, R.t), c2 = tr.col2 || sk.col2 || c1;
  const col = Math.random() < 0.5 ? c1 : c2;
  const rx = (Math.random() - 0.5), x = R.px, y = R.pY;
  switch (tr.type) {
    case 'fire': fx.spawn(x + rx * 8, y - 4, rx * 50, R.speed * 0.55, 0.3, col, 4); break;
    case 'spark': fx.spawn(x + rx * 14, y, rx * 90, R.speed * 0.4 - 60, 0.45, col, 2.5); break;
    case 'bubbles': fx.spawn(x + rx * 12, y, rx * 30, R.speed * 0.75, 0.9, col, 5 + Math.random() * 4, SHAPE.BUBBLE, 0); break;
    case 'stars': fx.spawn(x + rx * 20, y + rx * 10, rx * 40, R.speed * 0.6, 0.7, col, 6, SHAPE.STAR, 0); break;
    case 'embers': fx.spawn(x + rx * 10, y, rx * 70, R.speed * 0.5 - 40, 0.6, col, 3, SHAPE.CIRCLE, 120); break;
    case 'supernova': {
      const hue = Math.round((R.t * 120 + Math.random() * 90) % 360);
      fx.spawn(x + rx * 16, y + rx * 6, rx * 160, R.speed * 0.55 - 30, 0.6, `hsl(${hue} 100% 70%)`, 5 + Math.random() * 3, Math.random() < 0.5 ? SHAPE.STAR : SHAPE.CIRCLE, 0);
      novaT -= rate;
      if (novaT <= 0) { novaT = 0.8; fx.ring(x, y, Math.random() < 0.5 ? '#ffd166' : '#ff5ed1', 70, 0.5, 2); }
      break;
    }
    default: break;
  }
}

function intensity() {
  if (state === 'playing') return R.pAlive ? R.tension() : 0.25;
  if (state === 'countdown') return 0.32;
  return state === 'menu' ? 0.18 : 0.12;
}

function simulate(dt) {
  if (R.online) { R.step(dt); drainEvents(); return; }
  acc += dt;
  while (acc >= CFG.FIXED_DT) { R.step(CFG.FIXED_DT); acc -= CFG.FIXED_DT; }
  drainEvents();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const sk = playerSkin(), tr = playerTrail();

  if (state === 'countdown') {
    const before = Math.ceil(countT);
    if (R.online) { countT = (online.startAt - net.serverNow) / 1000; R.idle(dt); }
    else { countT -= dt; R.movePlayer(dt, null); }
    if (countT <= 0) {
      state = 'playing';
      ui.banner('¡Ya!', `${fmt(R.total)} jugadores cayendo a la vez`, 'ok', 900);
      audio.play('go');
      buzz(30);
    } else if (Math.ceil(countT) !== before) {
      ui.banner(String(Math.ceil(countT)), `${fmt(R.total)} jugadores listos`, 'count', 900);
      audio.play('count');
    }
  } else if (state === 'playing') {
    if (slowT > 0) slowT -= dt;
    else slow = Math.min(1, slow + dt * 2.5);
    simulate(R.online ? dt : dt * slow);
    tensionTick(dt);
    emitTrail(dt, sk, tr);
    // Enseñar el impulso la primera vez que se puede usar
    if (tutorial && !tutorial.dash && R.canDash()) {
      tutorial.dash = true;
      ui.hint('¡Tocá IMPULSO para pasarte de camino a último momento!', 3200);
    }
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
    if (state === 'results' && mode === 'online') {
      // En online la siguiente ronda la arranca el servidor
      const txt = nextGlobalText();
      if (txt !== ui.lastNext) { ui.lastNext = txt; ui.setAgain('Volver a la sala', txt || null); }
    } else if (state === 'results' && !ui.modalOpen) {
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
  if (state === 'countdown' || state === 'playing') {
    ui.hud(R);
    ui.dashButtons(R);
    ui.predict(R, pred, predStats);
  }
  // La ventana de la sala muestra una cuenta regresiva: refrescarla cada segundo
  roomRefreshT -= dt;
  if (roomRefreshT <= 0) {
    roomRefreshT = 1;
    if (ui.modalKind === 'room') ui.refreshModal();
    if (state === 'menu') updateOnlineChip();
  }
  fx.update(dt);
  audio.setIntensity(intensity());
  // Etapa de la ronda: cambia la paleta del fondo y suma capas a la música
  const stage = Math.min(R.cf, 6);
  renderer.setStage(state === 'results' ? 0 : stage);
  audio.setStage(state === 'playing' ? Math.min(R.cf + (R.cf >= CFG.FORKS ? 1 : 0), 7) : 0);
  const tier = rankOf(save.pr).tier;
  renderer.draw(R, fx, {
    skin: sk, trail: tr, trailPts: trail, dt,
    aura: TIER_PERKS[tier].aura, tierCol: TIERS[tier].col,
  });
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

// Impulso: con botones, Q / E, o Espacio hacia el lado al que apuntás (si no, al carril más vacío)
function doDash(dir) {
  if (!R || R.demo || state !== 'playing' || !R.canDash()) return;
  const f = R.fork;
  if (!dir) {
    const aim = R.keyDir || Math.sign(R.ptx - R.px);
    if (aim) dir = aim;
    else {
      const l = R.pLane - 1, r = R.pLane + 1;
      const cnt = k => (k < 0 || k >= f.k ? Infinity : (f.invert ? -f.counts[k] : f.counts[k]));
      dir = cnt(l) <= cnt(r) ? -1 : 1;
    }
  }
  R.dash(dir);
}
window.addEventListener('keydown', e => {
  if (ui.modalOpen) return;
  if (e.key === ' ' || e.key === 'Shift') { if (state === 'playing') { doDash(0); e.preventDefault(); } }
  else if (e.key === 'q' || e.key === 'Q') doDash(-1);
  else if (e.key === 'e' || e.key === 'E') doDash(1);
});
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

// ---------- App instalable (solo cuando se sirve por http/https, no al abrir el archivo) ----------
let installPrompt = null;
function setupPWA() {
  const hosted = /^https?:$/.test(location.protocol) && window.self === window.top;
  if (!hosted) return;
  const link = (rel, href) => { const l = document.createElement('link'); l.rel = rel; l.href = href; document.head.append(l); };
  link('manifest', 'manifest.webmanifest');
  link('apple-touch-icon', 'apple-touch-icon.png');
  link('icon', 'icon.svg');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
}

// ---------- Arranque ----------
$('lobbyCount').textContent = fmt(CFG.BOTS + 1);
audio.onBeat = strong => renderer.beat(strong ? 1 : 0.55);
setupPWA();
toMenu();
// Invitación: ?sala=ABCD abre el modo online con el código cargado
try {
  const code = new URLSearchParams(location.search).get('sala');
  if (code && /^[A-Za-z]{4}$/.test(code)) setTimeout(() => ui.openModal('online', { code: code.toUpperCase() }), 400);
} catch (e) { /* sin parámetros */ }
requestAnimationFrame(frame);

// Acceso para pruebas desde la consola
window.__contracorriente = {
  get round() { return R; },
  get state() { return state; },
  get save() { return save; },
  get online() { return { mode, room: online.room, net }; },
  startRound,
  finishRound,
  toMenu,
  persist,
};
