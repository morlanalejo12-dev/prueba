// Punto de entrada: conecta simulación, render, audio e interfaz.
// Máquina de estados: menu → countdown → playing → results → (countdown | menu)
import { CFG } from './config.js';
import { fmt } from './util/math.js';
import { hash01 } from './util/rng.js';
import { Round } from './sim/round.js';
import { ORB_TIERS } from './sim/level.js';
import { AudioEngine } from './audio/audio.js';
import { Renderer, skinColor } from './render/renderer.js';
import { Fx, SHAPE } from './render/fx.js';
import { renderShareCard, shareText } from './render/share.js';
import {
  loadSave, writeSave, resetSave, applyRound, claimMission, localStore, levelInfo, titleOf, levelBadgeOf, displayTitle,
  dayKey, yesterdayOf, ownedCtx,
} from './game/progress.js';
import { skinById, trailById, isOwned } from './game/skins.js';
import { rankOf, botRankLabel, TIERS, TIER_PERKS } from './game/ranks.js';
import { ensureMissions, buySkin, claimDaily, missionText } from './game/meta.js';
import { createUI, $ } from './ui/ui.js';
import { redeemCode } from './game/codes.js';
import { newlyUnlocked } from './game/unlocks.js';
import { challengeDay, challengeSeed, recordChallenge, challengeShareText, weekendMode, weekKey, comebackReward } from './game/events.js';
import { Api, apiBase } from './net/api.js';
import { claimPass, claimablePass, passInfo } from './game/pass.js';
import { claimAchievement, claimableAch } from './game/progress.js';
import { musicById } from './game/music.js';
import { nameStyleById } from './game/names.js';
import { NetClient, serverUrl } from './net/client.js';
import { NetRound } from './net/netround.js';
import { cleanName } from './util/name.js';
import { COUNTRIES, LANGS, CURRENCIES, countryById, guessCountry, guessLang, localPrice, formatPrice, catalog, methodsFor, PACKS, packAvailable, DLOCAL_COUNTRIES } from './game/prices.js';
import { SKINS, TRAILS } from './game/skins.js';
import { NAME_STYLES } from './game/names.js';
import { setLang, t as tr } from './i18n/i18n.js';

const store = localStore();
let save = loadSave(store);
// Cada guardado local también se sube a la nube (agrupado), una vez que el juego terminó de arrancar
let cloudReady = false;
const persist = () => { writeSave(store, save); if (cloudReady) cloudSoon(); };

const audio = new AudioEngine();
audio.sfxOn = save.sfx;
audio.musicOn = save.music;
audio.sfxVol = save.sfxVol;
if (!save.country) save.country = guessCountry();
if (!save.lang) save.lang = guessLang(save.country);
setLang(save.lang);
audio.musicVol = save.musicVol;
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

// Música: el tema elegido, o el que se está escuchando en el catálogo
let previewTrack = null;
function playerTrack() {
  const m = musicById(save.track);
  return isOwned(m, ownedCtx(save)) ? m : musicById('mus-corriente');
}
function applyTrack() { audio.setTrack((previewTrack ? musicById(previewTrack) : playerTrack()).track); }

// Modo online
let mode = 'solo';
let net = null;
const online = { room: null, msg: '', pending: null, url: '', startAt: 0 };
let roomRefreshT = 0;
let humansKey = '';

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
  if (!r) el.textContent = 'Partida global · salas privadas';
  else if (r.pub) { const t = nextGlobalText(); el.textContent = t ? `En la partida global · empieza en ${t}` : 'En la partida global'; }
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
    else { leaveOnline(); startRound(lastSum && lastSum.kind === 'challenge' ? 'challenge' : lastSum && lastSum.kind === 'weekend' ? 'weekend' : 'normal'); }
  },
  onChallenge: () => { audio.unlock(); leaveOnline(); startRound('challenge'); },
  onWeekend: () => { audio.unlock(); leaveOnline(); startRound('weekend'); },
  onShareChallenge: () => shareChallenge(),
  onOpen: kind => ui.openModal(kind),
  authState: () => authState,
  onAuthMode: (mode, extra) => { authState.msg = (extra && extra.msg) || ''; ui.openModal('auth', { mode, ...(extra || {}) }); },
  onAuth: (mode, data) => doAuth(mode, data),
  onMerge: choice => finishMerge(choice),
  onLogout: () => logout(),
  onDeleteAccount: () => deleteAccount(),
  payOn: () => !!(serverCfg && serverCfg.payments),
  boardsState: () => boardsState,
  onBoard: (tab, scope) => loadBoard(tab, scope),
  cloudState: () => ({ has: !!save.cloud, email: save.cloud && save.cloud.email, code: save.cloud ? `${save.cloud.id}-${save.cloud.secret}` : '', status: cloudStatus, base: !!apiBase(save.server) && serverCfg !== false }),
  onCloudCreate: () => ensureCloud(true),
  onRestore: code => restoreCloud(code),
  onHome: () => { audio.play('ui'); leaveOnline(); toMenu(); },
  onOnline: () => { if (!save.seenFeat.online) { save.seenFeat.online = true; persist(); refreshMenu(); } audio.unlock(); ui.openModal(online.room ? 'room' : 'online'); },
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
    try { await navigator.clipboard.writeText(tr(text)); return true; } catch (e) { return false; }
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
    track({ e: 'open', k: kind });
    if (!save.seenFeat[kind]) { save.seenFeat[kind] = true; persist(); refreshMenu(); }
    if (kind === 'friends') { if (ensureConnected()) requestPresence(); }
    if (kind === 'notifs') { ensureConnected(); requestPresence(); setTimeout(() => { for (const x of notifInfo) x.seen = true; updateNotifBadge(); }, 1500); }
    if (kind === 'shop' && save.shopSeen !== env().today) { save.shopSeen = env().today; persist(); refreshMenu(); }
    if (kind !== 'music' && previewTrack) { previewTrack = null; applyTrack(); }
  },
  onModalClosed: kind => {
    if (previewTrack) { previewTrack = null; applyTrack(); }
    // Si estabas en una sala y cambiaste tu aspecto, volver a la sala
    if (online.room && ['collection', 'names', 'music', 'friends'].includes(kind) && (state === 'menu' || state === 'results')) setTimeout(() => { if (!ui.modalOpen && online.room) ui.openModal('room'); }, 50);
  },
  onSelectSkin: id => { save.skin = id; persist(); refreshMenu(); ui.refreshModal(); audio.play('ui'); sendProfile(); },
  onSelectTrail: id => { save.trail = id; persist(); refreshMenu(); ui.refreshModal(); audio.play('ui'); sendProfile(); },
  musicPreview: () => previewTrack,
  onPreviewMusic: id => {
    audio.unlock();
    previewTrack = id;
    applyTrack();
    ui.refreshModal();
  },
  onSelectMusic: id => {
    save.track = id;
    persist();
    previewTrack = null;
    applyTrack();
    audio.play('ui');
    ui.toast('Música', `${musicById(id).name} · sonará en tus rondas`);
    refreshMenu();
    ui.refreshModal();
  },
  onSelectName: id => { save.nameStyle = id; persist(); audio.play('ui'); refreshMenu(); ui.refreshModal(); sendProfile(); },
  onRename: raw => {
    const name = cleanName(raw);
    if (!name) return { error: 'Escribí un nombre (hasta 16 letras).' };
    save.name = name;
    persist();
    audio.play('claim');
    ui.toast('Nombre guardado', name);
    refreshMenu();
    ui.refreshModal();
    sendProfile();
    return {};
  },
  // Compra directa desde los catálogos de música y de nombres
  onBuyItem: (kind, item) => {
    if (!buySkin(save, { id: item.id, price: item.src.price })) return;
    if (kind === 'music') { save.track = item.id; previewTrack = null; applyTrack(); }
    else { save.nameStyle = item.id; sendProfile(); }
    persist();
    audio.play('buy');
    buzz([20, 30, 20]);
    ui.toast(kind === 'music' ? 'Tema nuevo' : 'Estilo de nombre nuevo', `${item.name} · equipado`);
    refreshMenu();
    ui.refreshModal();
  },
  roomStatusText: () => roomStatusText(),
  onSelectTitle: lvl => {
    save.titleSel = lvl;
    persist();
    audio.play('claim');
    refreshMenu();
    sendProfile();
    ui.openModal('profile', { tab: 'lvl' });
  },
  // Pase de temporada
  onClaimPass: lvl => {
    const levels = lvl === 'all' ? claimablePass(save).map(r => r.lvl) : [lvl];
    let coins = 0;
    const items = [];
    for (const l of levels) {
      const r = claimPass(save, l);
      if (!r) continue;
      if (r.kind === 'coins') coins += r.amount;
      else items.push(r.item);
    }
    if (!coins && !items.length) return;
    persist();
    audio.play(items.length ? 'buy' : 'claim');
    buzz([20, 30, 20]);
    if (items.length === 1 && levels.length === 1) ui.openModal('prize', { ok: true, reward: { kind: kindOf(items[0]), item: items[0] } });
    else {
      ui.toast('Pase de temporada', `${items.length ? items.length + ' premios' : ''}${items.length && coins ? ' + ' : ''}${coins ? fmt(coins) + ' destellos' : ''}`);
      ui.refreshModal();
    }
    refreshMenu();
  },
  onClaimAch: id => {
    const r = claimAchievement(save, id);
    if (!r) return;
    persist();
    audio.play('claim');
    buzz([15, 30, 15]);
    ui.toast('Logro reclamado', `+${fmt(r.coins)} destellos${r.item ? ' · ' + r.item.name : ''}`);
    refreshMenu();
    ui.openModal('profile', { tab: 'ach' });
  },
  onBuyPremium: item => buyPremium(item),
  price: item => priceText(item),
  priceInfo: () => priceInfo(),
  payState: item => {
    const c = countryById(save.country);
    const methods = methodsFor(item, save.country, payEnabled(), fxOver()).map(m => ({ ...m, text: formatPrice(m.price, save.lang) }));
    const local = { BR: 'Pix, boleto o tarjeta', MX: 'OXXO, SPEI o tarjeta', CO: 'PSE, Efecty o tarjeta', CL: 'Webpay, Khipu o tarjeta', PE: 'PagoEfectivo, Yape o tarjeta', AR: 'Tarjeta, transferencia o efectivo', UY: 'Abitab, Redpagos o tarjeta' }[c.id] || 'Tarjeta, transferencia o efectivo';
    return { title: payTitle(item), methods, local, msg: payMsg };
  },
  onPay: (item, method) => startPayment(item, method),
  regionState: () => {
    const c = countryById(save.country), l = LANGS.find(x => x.id === save.lang) || LANGS[0];
    return { country: c.id, countryName: c.name, flag: c.flag, lang: l.id, langName: l.name, countries: COUNTRIES, langs: LANGS };
  },
  onSetLang: id => { save.lang = id; save.langSet = true; persist(); setLang(id); audio.play('ui'); ui.refreshModal(); refreshMenu(); },
  onSetCountry: id => {
    const prev = countryById(save.country);
    save.country = id;
    // Si el idioma seguía al país, cambiarlo también (Brasil → portugués, etc.)
    if (!save.langSet && countryById(id).lang !== prev.lang) { save.lang = countryById(id).lang; setLang(save.lang); }
    persist(); audio.play('ui'); ui.refreshModal();
  },
  // Amigos
  friendsState: () => ({ status: net ? net.status : 'off', social, msg: friendsMsg, room: online.room }),
  onCopyFriendCode: async () => { try { await navigator.clipboard.writeText(save.friendId); return true; } catch (e) { return false; } },
  onAddFriend: raw => {
    const id = String(raw || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{6}$/.test(id)) return { error: 'El código de amigo tiene 6 caracteres.' };
    if (id === save.friendId) return { error: 'Ese es tu propio código.' };
    if (social && social.friends.some(f => f.id === id)) return { error: 'Ya son amigos.' };
    if (!ensureConnected() || !net || net.status !== 'on' || !social) return { error: 'Sin conexión con el servidor. Probá en unos segundos.' };
    net.send({ t: 'freq', id });
    audio.play('ui');
    friendsMsg = '';
    return { ok: 'Enviando solicitud…' };
  },
  onAnswerRequest: (id, yes) => { audio.play(yes ? 'claim' : 'ui'); socialSend(yes ? 'faccept' : 'fdecline', id); },
  onCancelRequest: id => { audio.play('ui'); socialSend('fcancel', id); },
  onRemoveFriend: id => { audio.play('ui'); socialSend('fremove', id); },
  onInviteFriend: id => { audio.play('ui'); if (net) net.send({ t: 'invite', to: id }); },
  onJoinFriend: code => { audio.play('ui'); onlineGo(save.name || 'Jugador', null, code === 'GLOBAL' ? 'global' : 'join', code); },
  // Notificaciones
  notifState: () => ({ requests: social ? social.in : [], invites: liveInvites(), info: notifInfo, status: net ? net.status : 'off' }),
  onAcceptInvite: code => { audio.play('ui'); invites = invites.filter(x => x.code !== code); updateNotifBadge(); onlineGo(save.name || 'Jugador', null, 'join', code); },
  onDeclineInvite: code => { audio.play('ui'); invites = invites.filter(x => x.code !== code); updateNotifBadge(); ui.refreshModal(); },
  onDismissNotif: at => { notifInfo = notifInfo.filter(x => x.at !== at); updateNotifBadge(); ui.refreshModal(); },
  onRoomOpen: kind => { audio.play('ui'); ui.openModal(kind, kind === 'collection' ? { tab: 'skins' } : undefined); },
  onCollectionTab: tab => { audio.play('ui'); ui.openModal('collection', { tab }); },
  onBuy: offer => {
    if (!buySkin(save, offer)) return;
    const isTrail = offer.kind === 'trail';
    if (isTrail) save.trail = offer.id; else save.skin = offer.id;
    persist();
    audio.play('buy');
    buzz([20, 30, 20]);
    ui.toast(isTrail ? 'Estela nueva' : 'Skin nueva', `${(isTrail ? trailById : skinById)(offer.id).name} · equipada`);
    sendProfile();
    refreshMenu();
    ui.refreshModal();
  },
  onRedeem: input => {
    const r = redeemCode(save, input);
    if (!r.ok) { audio.play('die'); buzz(40); return r; }
    if (r.reward.kind === 'reset') {
      // Cuenta nueva para probar el progreso desde cero (se conservan solo los ajustes)
      const keep = {};
      for (const k of ['sfx', 'music', 'vib', 'notif', 'relTouch', 'server', 'sfxVol', 'musicVol', 'country', 'lang']) keep[k] = save[k];
      leaveOnline();
      save = resetSave(store, keep);
      reconnectSocial();
      ensureMissions(save, env().today);
      previewTrack = null;
      applyTrack();
      dailyOffered = false;
      refreshMenu();
      audio.play('ui');
      ui.openModal('redeemed', r);
      return r;
    }
    persist();
    audio.play('rankup');
    buzz([30, 40, 30, 40, 60]);
    if (r.reward.item) ui.toast(r.reward.item.rarity === 'fundador' ? 'Rareza Fundador' : 'Código canjeado', `${r.reward.item.name} · equipada`);
    refreshMenu();
    applyTrack();
    sendProfile();
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
  // Avisos apagados: sin toasts ni feed mientras se juega
  quiet: () => !save.notif && (state === 'playing' || state === 'countdown'),
  onInstall: async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* cancelado */ }
    installPrompt = null;
    ui.refreshModal();
  },
  onVolume: (key, v, done) => {
    save[key + 'Vol'] = v;
    if (v > 0 && !save[key]) save[key] = true;
    audio.unlock();
    audio.setSfx(save.sfx, save.sfxVol);
    audio.setMusic(save.music, save.musicVol);
    if (done) { persist(); if (key === 'sfx') audio.play('orb'); }
  },
  onToggle: key => {
    save[key] = !save[key];
    persist();
    audio.unlock();
    audio.setSfx(save.sfx, save.sfxVol);
    audio.setMusic(save.music, save.musicVol);
    if (key === 'vib') buzz(25);
    audio.play('ui');
  },
  onReset: () => {
    save = resetSave(store);
    reconnectSocial();
    previewTrack = null;
    applyTrack();
    ensureMissions(save, env().today);
    audio.setSfx(save.sfx, save.sfxVol);
    audio.setMusic(save.music, save.musicVol);
    refreshMenu();
  },
});
// Pruebas automáticas: ?dev=1 expone la interfaz (no cambia nada del juego)
if (/[?&]dev=1\b/.test(location.search)) window.__cc = { ui, get save() { return save; }, finishRound: () => finishRound() };

// ---------- Transiciones de estado ----------
let orbTierSeen = 0;
function resetView() {
  orbTierSeen = 0;
  lastTip = '';
  fx.reset();
  trail.length = 0;
  acc = 0; slow = 1; slowT = 0; tickT = 0; riserFork = -1;
}

// ---------- Online ----------
function roomStatusText() {
  const r = online.room;
  if (!r) return '';
  if (r.phase === 'playing' || r.phase === 'countdown') return 'Hay una ronda en curso: entrás en la próxima.';
  if (r.pub) { const t = nextGlobalText(); return t ? `La próxima ronda empieza en ${t}` : 'Esperando la próxima ronda…'; }
  return r.host === (net && net.id) ? 'Sos el anfitrión: empezá cuando estén todos.' : 'Esperando que el anfitrión empiece la ronda…';
}
function updateRoomStatus() {
  const el = document.getElementById('roomStatus');
  const t = roomStatusText();
  if (el && el.textContent !== t) el.textContent = t;
}

// ---------- Nube, tablas y estadísticas ----------
const api = () => Api(apiBase(save.server));
let cloudStatus = '', cloudT = 0;
async function ensureCloud(manual) {
  if (save.cloud || !apiBase(save.server)) { if (manual) ui.refreshModal(); return; }
  try {
    cloudStatus = 'Creando tu cuenta…';
    const r = await api().createAccount();
    save.cloud = { id: r.id, secret: r.secret };
    persist();
    cloudStatus = '';
    cloudSoon(true);
  } catch (e) { cloudStatus = 'No se pudo conectar con el servidor.'; }
  if (ui.modalKind === 'settings') ui.refreshModal();
}
// Subir el progreso a la nube (con una pequeña espera para agrupar cambios)
function cloudSoon(now) {
  clearTimeout(cloudT);
  cloudT = setTimeout(async () => {
    if (!save.cloud) return ensureCloud();
    const { cloud, ...data } = save;
    try { await api().uploadSave(cloud.id, cloud.secret, data); save.cloudAt = Date.now(); } catch (e) { /* sin conexión: se reintenta en el próximo cambio */ }
  }, now ? 50 : 3000);
}
async function restoreCloud(code) {
  try {
    const r = await api().restore(code);
    if (!r.save) return { error: 'Esa cuenta todavía no tiene progreso guardado.' };
    const fresh = loadSave({ get: () => JSON.stringify(r.save), set: () => {} });
    fresh.cloud = { id: r.id, secret: r.secret };
    save = fresh;
    persist();
    applyTrack();
    toMenu();
    ui.toast('Progreso recuperado', `Nivel ${levelInfo(save.xp).level} · ${fmt(save.coins)} destellos`);
    return {};
  } catch (e) { return { error: e.status === 404 ? 'Código de recuperación inválido.' : 'No se pudo conectar con el servidor.' }; }
}

function submitScore(board, score, log) {
  if (!apiBase(save.server) || !score) return;
  api().submitScore({ board, pid: save.friendId, name: save.name || 'Jugador', nameStyle: playerNameStyle().id, lvl: levelInfo(save.xp).level, score, log }).catch(() => {});
}

const boardsState = { tab: 'daily', scope: 'global', loading: false, data: null, error: '' };
async function loadBoard(tab = boardsState.tab, scope = boardsState.scope) {
  Object.assign(boardsState, { tab, scope, loading: true, error: '' });
  if (ui.modalKind === 'boards') ui.refreshModal();
  const id = tab === 'daily' ? 'daily-' + challengeDay() : 'week-' + weekKey();
  try {
    boardsState.data = await api().board(id, [save.friendId, ...save.friends.map(f => f.id)]);
  } catch (e) { boardsState.data = null; boardsState.error = apiBase(save.server) ? 'No se pudo cargar la tabla.' : 'Las tablas necesitan el servidor online.'; }
  boardsState.loading = false;
  if (ui.modalKind === 'boards') ui.refreshModal();
}

// Estadísticas anónimas de uso (para medir retención y dónde se frustra la gente)
const evq = [];
if (!save.deviceId) { save.deviceId = Math.random().toString(36).slice(2, 12); persist(); }
function track(ev) { evq.push({ ...ev, at: Date.now() }); if (evq.length > 100) evq.shift(); }
function flushEvents() {
  if (!evq.length || !apiBase(save.server)) return;
  const batch = evq.splice(0, evq.length);
  api().events(save.deviceId, batch).catch(() => { evq.unshift(...batch.slice(-50)); });
}
setInterval(flushEvents, 30000);


// ---------- Cuenta: inicio de sesión, registro, Google, compras ----------
let serverCfg = null;                 // null = cargando, false = sin servidor
const authState = { busy: false, msg: '', email: '', canReset: false };
const hosted = /^https?:$/.test(location.protocol) && !/claude|anthropic/.test(location.hostname);
const loggedIn = () => !!(save.cloud && save.cloud.email);
const keepSettings = () => { const k = {}; for (const x of ['sfx', 'music', 'vib', 'notif', 'relTouch', 'server', 'guestOk', 'sfxVol', 'musicVol', 'country', 'lang', 'langSet']) k[x] = save[x]; return k; };

async function loadConfig() {
  if (!apiBase(save.server) || /claude|anthropic/.test(location.hostname)) { serverCfg = false; return; }
  try { serverCfg = await api().config(); } catch (e) { serverCfg = false; }
  authState.canReset = !!(serverCfg && serverCfg.reset);
  if (serverCfg && serverCfg.google && hosted) setupGoogle(serverCfg.google);
  updateStart();
}

// Pantalla inicial: la primera vez (o después de cerrar sesión), si no hay cuenta ni se eligió jugar sin cuenta
const needsStart = () => !loggedIn() && !save.guestOk;
function updateStart() {
  const st = $('startStatus');
  if (!st) return;
  const off = serverCfg === false;
  $('startLogin').disabled = off || serverCfg === null;
  $('startRegister').disabled = off || serverCfg === null;
  st.textContent = off ? 'Sin conexión con el servidor: por ahora podés jugar sin cuenta.' : serverCfg === null ? 'Conectando…' : '';
  st.classList.toggle('ok', !off);
}
function showStart() {
  state = 'menu';
  ui.showHud(false);
  ui.showScreen('start');
  updateStart();
}

function setupGoogle(clientId) {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => {
    try {
      window.google.accounts.id.initialize({ client_id: clientId, callback: r => doAuth('google', { credential: r.credential }) });
      const slot = $('googleBtn');
      slot.hidden = false;
      window.google.accounts.id.renderButton(slot, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 300 });
    } catch (e) { /* sin Google */ }
  };
  document.head.append(s);
}

let pendingAuth = null;
async function doAuth(mode, d) {
  authState.busy = true; authState.msg = ''; authState.email = d.email || authState.email;
  if (ui.modalKind === 'auth') ui.refreshModal();
  let r = null;
  try {
    const c = save.cloud || {};
    if (mode === 'login') r = await api().login({ email: d.email, password: d.password });
    else if (mode === 'register') r = await api().register({ email: d.email, password: d.password, name: d.name, id: c.email ? undefined : c.id, secret: c.email ? undefined : c.secret });
    else if (mode === 'google') r = await api().google({ credential: d.credential, id: c.email ? undefined : c.id, secret: c.email ? undefined : c.secret });
    else if (mode === 'forgot') { await api().resetRequest(d.email); authState.msg = 'Si ese email tiene cuenta, te llegó un enlace para elegir una contraseña nueva. Revisá también el correo no deseado.'; }
    else if (mode === 'reset') {
      if (d.token) r = await api().resetConfirm(d.token, d.password);
      else if (save.cloud) { await api().password(save.cloud.id, save.cloud.secret, d.password); authState.msg = ''; ui.closeModal(); ui.toast('Cuenta', 'Contraseña actualizada'); }
    }
  } catch (e) {
    authState.msg = e.message && e.message !== 'error' && !/fetch|abort|network/i.test(e.message) ? e.message : 'No se pudo conectar con el servidor. Probá de nuevo en unos segundos.';
  }
  authState.busy = false;
  if (r) {
    if (mode === 'register' && d.name) save.name = cleanName(d.name) || save.name;
    afterAuth(r);
  } else if (ui.modalKind === 'auth') ui.refreshModal();
  else if (authState.msg && mode === 'google') { $('startStatus').textContent = authState.msg; }
}

const summaryOf = sv => ({ level: levelInfo(sv.xp || 0).level, rounds: sv.rounds || 0, coins: sv.coins || 0 });
function afterAuth(r) {
  const localHas = save.rounds > 0 && !(save.cloud && save.cloud.id === r.id);
  if (r.save && localHas && (r.save.rounds || 0) > 0) {
    pendingAuth = r;
    ui.openModal('merge', { cloud: summaryOf(r.save), local: summaryOf(save) });
    return;
  }
  // La misma cuenta que ya usaba este dispositivo (invitado que se registra): gana lo local, que es lo más nuevo
  const same = save.cloud && save.cloud.id === r.id;
  adopt(r, !same && r.save && (r.save.rounds || 0) > 0 ? 'cloud' : 'local');
}
function finishMerge(choice) { if (pendingAuth) adopt(pendingAuth, choice); pendingAuth = null; }
function adopt(r, which) {
  if (which === 'cloud') {
    const k = keepSettings();
    save = loadSave({ get: () => JSON.stringify(r.save), set: () => {} });
    Object.assign(save, k);
  }
  save.cloud = { id: r.id, secret: r.secret, email: r.email || null };
  save.guestOk = true;
  applyEnt(r.ent);
  persist();
  cloudSoon(true);
  applyTrack();
  ui.closeModal();
  toMenu();
  ui.toast('Sesión iniciada', r.email || 'Tu progreso se guarda en la nube');
  if (which === 'cloud') reconnectSocial(); else sendProfile();
}
// Lo comprado lo decide el servidor
function applyEnt(ent) {
  if (!ent) return false;
  let got = false;
  if (ent.pass && !save.premiumPass) { save.premiumPass = true; got = true; }
  for (const id of Object.keys(ent.items || {})) if (!save.owned[id]) { save.owned[id] = true; got = true; }
  // Destellos comprados (packs): se suman una sola vez
  const extra = (ent.coins || 0) - (save.entCoins || 0);
  if (extra > 0) { save.coins += extra; save.entCoins = ent.coins; got = true; }
  save.bought = { ...(ent.bought || {}) };
  if (got && save.pendingOrder) {
    save.pendingOrder = null;
    audio.play('claim');
    ui.toast('Compra acreditada', '¡Ya es tuyo! Gracias por apoyar el juego');
  }
  return got;
}
async function refreshEnt() {
  if (!save.cloud || serverCfg === false) return;
  try { const me = await api().me(save.cloud.id, save.cloud.secret); applyEnt(me.ent); if (me.email && !save.cloud.email) save.cloud.email = me.email; persist(); refreshMenu(); } catch (e) {
    if (e.status === 401) { save.cloud = null; persist(); }
  }
}
async function logout() {
  const c = save.cloud;
  if (c) { cloudSoon(true); try { await api().logout(c.id, c.secret); } catch (e) { /* igual se cierra */ } }
  const k = keepSettings();
  leaveOnline();
  save = resetSave(store, { ...k, guestOk: false });
  reconnectSocial();
  ensureMissions(save, env().today);
  applyTrack();
  ui.closeModal();
  showStart();
}
async function deleteAccount() {
  const c = save.cloud;
  if (!c) return { error: 'No hay cuenta.' };
  try { await api().remove(c.id, c.secret); } catch (e) { return { error: 'No se pudo eliminar. Probá de nuevo.' }; }
  const k = keepSettings();
  save = resetSave(store, { ...k, guestOk: false });
  reconnectSocial();
  ui.closeModal();
  showStart();
  ui.toast('Cuenta eliminada', 'Borramos tu cuenta y tus datos');
  return {};
}

// ---------- Precios y pagos ----------
const fxOver = () => (serverCfg && serverCfg.fx) || {};
const payEnabled = () => (serverCfg && serverCfg.pay) || {};
// Precio que se muestra: el del primer medio de pago disponible (o el precio local de referencia)
function priceOf(item) {
  const m = methodsFor(item, save.country, payEnabled(), fxOver())[0];
  const it = catalog()[item];
  return m ? m.price : localPrice(it ? it.usd : 0, save.country, fxOver());
}
const priceText = item => formatPrice(priceOf(item), save.lang);
const ALL_COSMETICS = [...SKINS, ...TRAILS, ...NAME_STYLES];
function priceInfo() {
  const c = countryById(save.country);
  const packs = PACKS.map(p => {
    const worthP = localPrice(p.worth, save.country, fxOver()), pr = priceOf(p.id);
    const worthScaled = { amount: pr.amount * (p.worth / p.usd), cur: pr.cur };
    return {
      ...p, available: packAvailable(p, save.owned, save.premiumPass, save.bought || {}),
      price: formatPrice(pr, save.lang), worth: formatPrice(pr.cur === worthP.cur ? worthP : worthScaled, save.lang),
      save: Math.round((1 - p.usd / p.worth) * 100),
      preview: p.items.slice(0, 5).map(id => ALL_COSMETICS.find(k => k.id === id)).filter(Boolean),
    };
  });
  return { flag: c.flag, cur: c.cur, country: c.name, packs };
}
function payTitle(item) {
  const p = PACKS.find(x => x.id === item);
  if (p) return p.name;
  if (item === 'pass') return 'Pase Premium · Temporada 1';
  const k = ALL_COSMETICS.find(x => x.id === item);
  return k ? k.name : item;
}
let payMsg = '';
async function startPayment(item, method) {
  payMsg = '';
  try {
    const r = await api().checkout(save.cloud.id, save.cloud.secret, item, save.country, method);
    save.pendingOrder = r.order;
    persist();
    track({ e: 'open', k: 'pay-' + method });
    location.href = r.url;
  } catch (e) {
    payMsg = e.message || 'No se pudo iniciar el pago. Probá de nuevo.';
    if (ui.modalKind === 'pay') ui.refreshModal();
  }
}

async function buyPremium(item) {
  track({ e: 'open', k: 'buy-' + item });
  audio.play('ui');
  if (!serverCfg || !serverCfg.payments) { ui.toast('Próximamente', 'Las compras todavía no están habilitadas'); return; }
  if (!loggedIn() || !save.cloud.email) { ui.openModal('auth', { mode: 'register' }); authState.msg = 'Creá una cuenta para comprar: así lo que pagás queda guardado para siempre.'; ui.refreshModal(); return; }
  payMsg = '';
  ui.openModal('pay', { item });
}

// Recordatorio para quien juega sin cuenta (a las 3, 10 y 25 rondas)
function maybeNudge() {
  if (loggedIn() || serverCfg === false || !apiBase(save.server)) return;
  if (![3, 10, 25].includes(save.rounds)) return;
  setTimeout(() => { if (state === 'results' && !ui.modalOpen) ui.openModal('guestNudge'); }, 2600);
}

// Enlaces legales: en el archivo suelto apuntan al sitio publicado
function fixLegalLinks(root = document) {
  if (hosted) return;
  const site = apiBase(save.server);
  root.querySelectorAll('.legal-links a').forEach(a => { if (site) a.href = site + '/' + a.getAttribute('href').replace(/^.*\//, ''); });
}

// ---------- Amigos ----------
let social = null;           // amigos y solicitudes (llega del servidor)
let invites = [];            // invitaciones a salas (duran 10 minutos)
let notifInfo = [];          // avisos: "aceptó tu solicitud"
let friendsMsg = '', socialSig = '';
const liveInvites = () => (invites = invites.filter(x => Date.now() - x.at < 10 * 60000));
function socialSend(t, id) {
  if (net && net.status === 'on') net.send({ t, id });
  else { ui.toast('Amigos', 'Sin conexión con el servidor.'); ensureConnected(); }
}
function updateNotifBadge() {
  const n = (social ? social.in.length : 0) + liveInvites().length + notifInfo.filter(x => !x.seen).length;
  const b = document.getElementById('bNotif');
  if (!b) return;
  b.hidden = !n;
  b.textContent = n > 9 ? '9+' : String(n);
  const btn = document.getElementById('notifBtn');
  if (btn) btn.setAttribute('aria-label', n ? `Notificaciones (${n} nuevas)` : 'Notificaciones');
}
const openNotifs = () => { if (state !== 'playing' && state !== 'countdown') ui.openModal('notifs'); };
function ensureConnected() {
  const u = serverUrl(save.server);
  if (!u) return false;
  if (net && (net.status === 'on' || net.status === 'connecting') && online.url === u) return true;
  if (!net) net = new NetClient(onNet, onNetStatus);
  online.url = u;
  net.connect(u, profile());
  return true;
}
// Cambió el código de amigo (otra cuenta o cierre de sesión): volver a conectarse con el nuevo
function reconnectSocial() {
  social = null; socialSig = ''; invites = []; notifInfo = [];
  updateNotifBadge();
  if (net && !online.room && online.url) net.connect(online.url, profile());
  else sendProfile();
}
function requestPresence() {
  if (net && net.status === 'on') net.send({ t: 'social' });
}
function refreshFriends() {
  // No reconstruir mientras se escribe un código
  const inp = document.getElementById('friendInput');
  if (ui.modalKind === 'notifs' || (ui.modalKind === 'friends' && !(inp && (inp.value || document.activeElement === inp)))) ui.refreshModal();
}

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
    net.connect(u, profile());
  }
  return {};
}

function profile() {
  return { name: save.name, skin: playerSkin().id, trail: playerTrail().id, nameStyle: playerNameStyle().id, friendId: save.friendId, friendKey: save.friendKey, lvl: levelInfo(save.xp).level, ttl: displayTitle(save) };
}
const kindOf = item => (item.shape ? 'skin' : item.track ? 'music' : item.fx ? 'name' : 'trail');
function playerNameStyle() {
  const st = nameStyleById(save.nameStyle);
  return isOwned(st, ownedCtx(save)) ? st : nameStyleById('nm-blanco');
}
// Avisar a la sala cuando cambia tu nombre o tu aspecto
function sendProfile() {
  if (net && net.status === 'on') net.send({ t: 'profile', ...profile() });
}

function doJoin() {
  const p = online.pending;
  online.pending = null;
  if (!p || !net) return;
  net.send({ t: 'join', create: p.action === 'create', code: p.action === 'join' ? p.code : 'GLOBAL' });
}

function leaveOnline() {
  if (net && online.room) net.send({ t: 'leave' });
  online.lastRoom = null;
  retries = 0;
  online.room = null;
  mode = 'solo';
  ui.setOnlineMode(false);
}

let retries = 0;
let bgRetry = 0;
function onNetStatus(status, msg) {
  if (status === 'on') bgRetry = 0;
  if (status !== 'error') return;
  // Sin sala: reintentar en segundo plano (cada vez más espaciado) para no perder notificaciones
  if (!online.room && !online.pending && retries === 0) {
    bgRetry = Math.min(bgRetry + 1, 6);
    setTimeout(() => { if (!net || net.status === 'error' || net.status === 'off') ensureConnected(); }, 5000 * 2 ** bgRetry);
  }
  online.msg = msg || 'Sin conexión.';
  const wasIn = online.room || (retries > 0 ? online.lastRoom : null);
  if (online.room) online.lastRoom = online.room;
  // Si estabas en una sala, reintentar volver a la misma (hasta 3 veces)
  if (wasIn && retries < 3 && online.url) {
    retries++;
    online.pending = wasIn.pub ? { action: 'global' } : { action: 'join', code: wasIn.code };
    setTimeout(() => net.connect(online.url, profile()), 1500 * retries);
    ui.toast('Online', 'Se cortó la conexión: reconectando…');
  }
  online.room = null;
  if (R && R.online && (state === 'playing' || state === 'countdown')) {
    ui.toast('Sin conexión', online.msg);
    mode = 'solo';
    ui.setOnlineMode(false);
    toMenu();
  } else if (mode === 'online') { mode = 'solo'; ui.setOnlineMode(false); }
  if (ui.modalKind === 'online' || ui.modalKind === 'room') ui.openModal('online');
  else if (wasIn && retries >= 3) ui.toast('Online', online.msg);
  refreshMenu();
}

function onNet(m) {
  switch (m.t) {
    case 'welcome': {
      retries = 0; doJoin();
      // Amigos de versiones anteriores (lista local): se les manda una solicitud una sola vez
      if (save.friendsLegacy && save.friendsLegacy.length) {
        const list = save.friendsLegacy; save.friendsLegacy = []; persist();
        list.forEach((id, i) => setTimeout(() => net && net.send({ t: 'freq', id, quiet: true }), 1200 + i * 350));
      }
      break;
    }
    case 'social': {
      const sig = JSON.stringify(m);
      if (sig === socialSig) break;
      socialSig = sig;
      social = { friends: m.friends || [], in: m.in || [], out: m.out || [] };
      const ids = social.friends.map(f => ({ id: f.id, name: f.name || '' }));
      if (JSON.stringify(ids) !== JSON.stringify(save.friends)) { save.friends = ids; persist(); }
      updateNotifBadge();
      refreshFriends();
      break;
    }
    case 'notif': {
      const p = m.from || {};
      audio.play('claim');
      if (m.kind === 'freq') ui.toast('Solicitud de amistad', `${p.name || 'Alguien'} quiere ser tu amigo`, openNotifs);
      else if (m.kind === 'faccept') {
        notifInfo = [{ ...p, text: 'Aceptó tu solicitud de amistad', at: Date.now() }, ...notifInfo].slice(0, 20);
        ui.toast('Amigos', `${p.name || 'Tu amigo'} aceptó tu solicitud`, openNotifs);
      }
      updateNotifBadge();
      if (ui.modalKind === 'notifs') ui.refreshModal();
      break;
    }
    case 'freqSent': friendsMsg = 'Solicitud enviada. Cuando la acepte, aparece en tu lista.'; ui.refreshModal(); break;
    case 'socialErr': {
      friendsMsg = m.msg;
      if (ui.modalKind === 'friends') ui.refreshModal(); else ui.toast('Amigos', m.msg);
      break;
    }
    case 'invited': {
      invites = [{ from: m.from, code: m.code, nameStyle: m.nameStyle, at: Date.now() }, ...invites.filter(x => x.code !== m.code)].slice(0, 10);
      audio.play('claim');
      ui.toast('Invitación a sala', `${m.from} te invitó a su sala`, openNotifs);
      updateNotifBadge();
      if (ui.modalKind === 'notifs') ui.refreshModal();
      break;
    }
    case 'invSent': ui.toast('Amigos', 'Invitación enviada'); break;
    case 'room': {
      const first = !online.room;
      online.room = m;
      if (R && R.online) R.updateProfiles(m.players);
      if (first) mode = 'online';
      // Solo reconstruir la ventana si cambió algo visible (jugadores, anfitrión o fase)
      const sig = JSON.stringify([m.host, m.phase, m.players]);
      const changed = sig !== online.sig;
      online.sig = sig;
      if (ui.modalKind === 'online' || (first && ui.modalKind !== 'room' && state !== 'playing' && state !== 'countdown')) ui.openModal('room');
      else if (ui.modalKind === 'room') { if (changed) ui.refreshModal(); else updateRoomStatus(); }
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
  ui.setRival(r && !r.pub ? `Sala ${r.code}` : 'Partida global', `${hn} ${hn === 1 ? 'real' : 'reales'}`, 'Online');
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
  if (dailyReady && !dailyOffered && save.rounds >= 1) {
    dailyOffered = true;
    setTimeout(() => { if (state === 'menu' && !ui.modalOpen) ui.openModal('daily'); }, 700);
  }
}

// kind: 'normal' | 'challenge' (desafío del día) | 'weekend' (modo del finde)
let roundKind = 'normal';
function startRound(kind = 'normal') {
  ui.closeModal();
  if (typeof kind !== 'string') kind = 'normal';
  const wk = weekendMode();
  if (kind === 'weekend' && !wk) kind = 'normal';
  roundKind = kind;
  // Partida guiada: la primera ronda protege 3 bifurcaciones y la segunda, una
  const guided = kind === 'normal' ? (save.rounds === 0 ? 3 : save.rounds === 1 ? 1 : 0) : 0;
  const seed = kind === 'challenge' ? challengeSeed(challengeDay()) : randSeed();
  R = new Round({ seed, guided, mode: kind === 'weekend' ? wk.id : 'normal' });
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
  ui.banner(String(countT), kind === 'challenge' ? 'Desafío del día: la misma ronda para todos' : kind === 'weekend' ? `Modo del finde: ${wk.name}` : `${fmt(R.n + 1)} jugadores listos`, 'count', 900);
  audio.play('count');
  if (tutorial) ui.hint('Arrastrá el dedo o el mouse para moverte.', 3000);
  else if (kind === 'weekend') ui.hint(wk.desc, 3200);
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
  lastSum = { ...R.summary(), predHits: predStats.hits, predCoins: predStats.coins, tip: lastTip, kind: R.online ? 'online' : roundKind };
  track({ e: 'round', mode: lastSum.kind === 'weekend' ? R.mode : lastSum.kind, alive: lastSum.alive, fork: lastSum.forksSeen - 1, why: lastSum.why || '', rank: lastSum.rank });
  if (lastSum.kind === 'challenge') {
    lastSum.challengeBest = recordChallenge(save, lastSum, challengeDay());
    submitScore('daily-' + challengeDay(), save.challenge.best, save.challenge.log);
  } else if (!R.online) submitScore('week-' + weekKey(), lastSum.score, '');
  const rep = applyRound(save, lastSum);
  persist();
  cloudSoon();
  flushEvents();
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
  sendProfile();
  maybeNudge();
  if (R.online) {
    ui.renderStandings(R.standings, net && net.id);
    ui.setAgain('Volver a la sala', null);
  } else if (lastSum.kind === 'challenge') { ui.setAgain('Reintentar desafío', null); nextT = Infinity; }
  else ui.setAgain('Jugar otra', nextT);
  if (rep.shieldUsed) setTimeout(() => { ui.toast('Escudo de racha', `Faltaste un día y tu racha de ${save.streak} días sigue viva`); audio.play('claim'); }, 900);

  if (lastSum.outlier) { audio.play('outlier'); buzz([30, 50, 30, 50, 60]); }
  if (rep.after.level > rep.before.level) {
    setTimeout(() => { audio.play('levelup'); buzz([20, 30, 20]); }, 700);
    // Título o distintivo nuevo: festejo con su ventana
    const b0 = levelBadgeOf(rep.before.level), b1 = levelBadgeOf(rep.after.level);
    const t0 = titleOf(rep.before.level), t1 = titleOf(rep.after.level);
    if (b1.tier > b0.tier || t1 !== t0) {
      setTimeout(() => {
        if (state !== 'results' || ui.modalOpen) { ui.toast('Subiste de nivel', `Nivel ${rep.after.level} · ${t1}`); return; }
        audio.play('rankup');
        ui.openModal('levelup', { level: rep.after.level, badge: b1, newBadge: b1.tier > b0.tier, title: t1, newTitle: t1 !== t0 });
      }, 1300);
    }
  }
  // Como mucho 4 avisos seguidos; el resto queda en el perfil y en los globos del menú
  let delay = 1000, queued = 0;
  const later = fn => { if (++queued > 4) return; setTimeout(fn, delay); delay += 800; };
  for (const a of rep.newAch) later(() => { ui.toast('Logro desbloqueado', `${a.name} · reclamá tu premio en el perfil`); audio.play('ach'); });
  if (rep.passAfter > rep.passBefore) later(() => { ui.toast('Pase de temporada', `Nivel ${rep.passAfter} · tenés premios para reclamar`); audio.play('levelup'); });
  for (const m of rep.missionsDone) later(() => { ui.toast('Misión lista para reclamar', missionText(m)); audio.play('claim'); });
  for (const k of rep.newSkins) later(() => { ui.toast('Skin desbloqueada', k.name); audio.play('buy'); });
  for (const f of newlyUnlocked(save.rounds - 1, save.rounds)) later(() => { ui.toast('¡Nuevo!', `Desbloqueaste ${f.name}`); audio.play('claim'); });
  for (const k of rep.newTrails) later(() => { ui.toast('Estela desbloqueada', k.name); audio.play('buy'); });
  for (const k of rep.newMusic) later(() => { ui.toast('Música desbloqueada', k.name); audio.play('buy'); });
  for (const k of rep.newNames) later(() => { ui.toast('Estilo de nombre desbloqueado', k.name); audio.play('buy'); });

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

async function shareChallenge() {
  const text = tr(challengeShareText(save));
  try { if (navigator.share) { await navigator.share({ text }); return 'shared'; } } catch (e) { /* cancelado */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return text; }
}

async function openShare() {
  if (!lastSum) return;
  if (lastSum.kind === 'challenge') {
    audio.play('ui');
    const r = await shareChallenge();
    if (r === 'copied') ui.toast('Desafío del día', 'Resultado copiado: pegalo donde quieras');
    else if (r !== 'shared') ui.toast('Desafío del día', r.split('\n')[1] || r);
    return;
  }
  audio.play('ui');
  const li = levelInfo(save.xp);
  const image = renderShareCard(lastSum, {
    colors: C, fonts: { display: renderer.FD, body: renderer.FB, mono: renderer.FM },
    playerColor: skinColor(playerSkin(), 1), level: li.level, title: displayTitle(save), rank: rankOf(save.pr).label,
  });
  ui.openModal('share', { image, text: tr(shareText(lastSum)) });
}

// ---------- Eventos de la simulación ----------
function drainEvents() {
  for (const e of R.events) handle(e);
  R.events.length = 0;
}

function handle(e) {
  switch (e.type) {
    case 'orb': {
      const T = ORB_TIERS[e.tier || 0], col = T.col || '#ffffff';
      fx.burst(e.x, e.y, 8 + (e.tier || 0) * 4, col, 140 + (e.tier || 0) * 30);
      fx.pop(e.x, e.y, `+${e.pts}`, col);
      audio.play('orb', e.chain + (e.tier || 0) * 2);
      buzz(6);
      // Primera chispa de un tipo nuevo: avisar que ahora valen más
      if ((e.tier || 0) > orbTierSeen) {
        orbTierSeen = e.tier;
        ui.feed('gold', 'Las chispas ahora son ', `${T.name}s`, `: valen x${T.mult}`);
        fx.ring(e.x, e.y, col, 120, 0.5, 3);
      }
      break;
    }
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

// Qué pasó y qué podrías haber hecho distinto (una línea)
let lastTip = '';
function deathTip(e) {
  const i = e.info || {};
  if (e.why === 'wall') return i.short && i.short <= 30 ? `Te faltaron ${i.short} px para pasar por el hueco: ¡casi!` : 'El hueco estaba lejos: mirá el próximo muro con tiempo y movete antes.';
  if (e.why === 'lottery') return 'En muerte súbita, si todos van al mismo camino cae la mitad al azar: separate a tiempo.';
  const pct = Math.round((i.share || 0) * 100);
  let t = e.why === 'inverted' ? `Era inversión: caía el camino más vacío y el ${LANE[i.lane] || ''} tenía solo el ${pct}%.` : `El ${pct}% de la multitud eligió tu camino (${LANE[i.lane] || '?'}).`;
  if (i.dashable) t += ` Con un impulso al ${LANE[i.safeLane]} te salvabas.`;
  else if (i.usedDash) t += ' Usaste el impulso, pero hacia un camino que también cayó.';
  else t += ' Mirá la proyección (→): muestra hacia dónde va la gente.';
  return t;
}

function onPlayerDied(e) {
  lastTip = deathTip(e);
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
  ui.showSpectator(e.rank, R.total, e.pct, lastTip);
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
  if (previewTrack) return 0.8;
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
      ui.hint('Juntá chispas y pasá por el hueco de cada muro: valen más en cada etapa.', 3600);
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

  reanchorDrag();
  if (R.pAlive && !R.demo) {
    trail.push(R.px, R.pY);
    if (trail.length > TRAIL_LEN) trail.splice(0, 2);
  }
  if (state === 'countdown' || state === 'playing') {
    if (R.online) {
      const key = `${R.aliveH}/${R.humans.length}`;
      if (key !== humansKey) {
        humansKey = key;
        const r = online.room;
        ui.setRival(r && !r.pub ? `Sala ${r.code}` : 'Partida global', `${R.aliveH}/${R.humans.length} reales vivos`, 'Online');
      }
    }
    ui.hud(R);
    ui.dashButtons(R);
    ui.predict(R, pred, predStats);
  }
  // La ventana de la sala muestra una cuenta regresiva: refrescarla cada segundo
  roomRefreshT -= dt;
  if (roomRefreshT <= 0) {
    roomRefreshT = 1;
    if (ui.modalKind === 'room') updateRoomStatus();
    if (ui.modalKind === 'friends') requestPresence();
    if (state === 'menu') updateOnlineChip();
  }
  fx.update(dt);
  audio.setIntensity(intensity());
  // Etapa de la ronda: cambia la paleta del fondo y suma capas a la música
  const stage = Math.min(R.cf, 6);
  renderer.setStage(state === 'results' ? 0 : stage);
  audio.setStage(previewTrack ? 4 : state === 'playing' ? Math.min(R.cf + (R.cf >= CFG.FORKS ? 1 : 0), 7) : 0);
  const tier = rankOf(save.pr).tier;
  renderer.draw(R, fx, {
    skin: sk, trail: tr, trailPts: trail, dt,
    aura: TIER_PERKS[tier].aura, tierCol: TIERS[tier].col,
    myName: R.online ? (save.name || 'Vos') : '', myNameStyle: playerNameStyle(),
  });
  requestAnimationFrame(frame);
}

// ---------- Entrada ----------
const cv = $('game');
let pDown = false;
const keys = new Set();
const canSteer = () => R && !R.demo && (state === 'playing' || state === 'countdown');

// Táctil: arrastre relativo (el dedo puede estar en cualquier parte y no tapa la bola).
// Mouse: la bola sigue al puntero. Un solo dedo controla; los demás (p. ej. el impulso) se ignoran.
const TOUCH_GAIN = 1.35;
let drag = null;
cv.addEventListener('pointerdown', e => {
  audio.unlock();
  if (drag && drag.id !== e.pointerId) return;
  pDown = true;
  const touch = e.pointerType !== 'mouse';
  drag = { id: e.pointerId, touch: touch && save.relTouch, x0: e.clientX, p0: R ? R.px : 0 };
  if (canSteer() && !drag.touch) R.setTarget(renderer.toWorldX(e.clientX));
  if (canSteer() && drag.touch) R.setTarget(R.px);
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignorar */ }
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (!canSteer()) return;
  if (drag && drag.id === e.pointerId) {
    if (drag.touch) R.setTarget(drag.p0 + (e.clientX - drag.x0) / renderer.scale * TOUCH_GAIN);
    else R.setTarget(renderer.toWorldX(e.clientX));
  } else if (!drag && e.pointerType === 'mouse') R.setTarget(renderer.toWorldX(e.clientX));
});
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  cv.addEventListener(t, e => { if (drag && drag.id === e.pointerId) { drag = null; pDown = false; } });
}
// Si el dedo ya empujó la bola contra un borde, re-anclar para que volver sea inmediato
function reanchorDrag() {
  if (!drag || !drag.touch || !R) return;
  const over = R.ptx - R.px;
  if (Math.abs(over) > 40) { drag.p0 -= over - Math.sign(over) * 40; R.ptx = R.px + Math.sign(over) * 40; }
}
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
$('appVersion').textContent = 'v' + CFG.VERSION;
audio.onBeat = strong => renderer.beat(strong ? 1 : 0.55);
// Temas grabados: embebidos en la página (archivo suelto / artifact) o descargados del sitio
audio.loadSample = async name => {
  const el = document.getElementById('sample-' + name);
  if (el) {
    const bin = atob(el.textContent.trim()), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  }
  const res = await fetch(`music/${name}.mp3`);
  if (!res.ok) throw new Error('sin audio');
  return res.arrayBuffer();
};
setupPWA();
applyTrack();
toMenu();
if (needsStart()) showStart();
loadConfig().then(() => { if (loggedIn()) refreshEnt(); });
// Conectarse en segundo plano para recibir solicitudes e invitaciones
setTimeout(() => ensureConnected(), 600);
$('startLogin').addEventListener('click', () => { audio.unlock(); authState.msg = ''; ui.openModal('auth', { mode: 'login' }); });
$('startRegister').addEventListener('click', () => { audio.unlock(); authState.msg = ''; ui.openModal('auth', { mode: 'register' }); });
$('startLang').addEventListener('click', () => { audio.unlock(); ui.openModal('region'); });
$('startGuest').addEventListener('click', () => { audio.unlock(); save.guestOk = true; persist(); toMenu(); });
fixLegalLinks();
// Vuelta de Mercado Pago o de un enlace para restablecer la contraseña
{
  const q = new URLSearchParams(location.search);
  const pago = q.get('pago'), reset = q.get('reset');
  if (pago || reset) history.replaceState(null, '', location.pathname);
  if (pago === 'ok') {
    setTimeout(() => ui.toast('¡Gracias por tu compra!', 'Se acredita en unos segundos'), 800);
    let n = 0;
    const iv = setInterval(async () => { await refreshEnt(); if (!save.pendingOrder || ++n > 24) clearInterval(iv); }, 2500);
  } else if (pago === 'pendiente') setTimeout(() => ui.toast('Pago pendiente', 'Te lo acreditamos apenas se apruebe'), 800);
  else if (pago === 'error') setTimeout(() => ui.toast('El pago no se completó', 'No se te cobró nada'), 800);
  if (reset && /^[A-Z0-9]{24}$/.test(reset)) setTimeout(() => ui.openModal('auth', { mode: 'reset', token: reset }), 600);
}
// Errores inesperados y conexión
window.addEventListener('error', e => track({ e: 'error', m: String(e.message || '').slice(0, 120) }));
window.addEventListener('unhandledrejection', e => track({ e: 'error', m: String((e.reason && e.reason.message) || e.reason || '').slice(0, 120) }));
{
  const pill = document.createElement('div');
  pill.className = 'offline-pill';
  pill.textContent = 'Sin conexión: seguís jugando solo; tu progreso se sube cuando vuelva';
  pill.hidden = navigator.onLine !== false;
  document.body.append(pill);
  window.addEventListener('offline', () => { pill.hidden = false; });
  window.addEventListener('online', () => { pill.hidden = true; cloudSoon(true); flushEvents(); });
}
track({ e: 'session' });
cloudReady = true;
setTimeout(flushEvents, 3000);
if (save.rounds > 0) setTimeout(() => ensureCloud(), 1500);
// Premio de regreso: si hacía 3 días o más que no jugabas
{
  const back = comebackReward(save);
  if (back) { persist(); setTimeout(() => { audio.play('claim'); ui.openModal('comeback', back); }, 900); }
}
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
  get audio() { return audio; },
  get online() { return { mode, room: online.room, net }; },
  startRound,
  finishRound,
  toMenu,
  persist,
};
