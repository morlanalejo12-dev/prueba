// Contenido de cada ventana. Cada constructor recibe el cuerpo vacío, el guardado y los callbacks.
import { CFG } from '../config.js';
import { fmt, pctText } from '../util/math.js';
import { TITLES, ACHIEVEMENTS, levelInfo, titleOf, streakNow, instinct, ownedCtx, achItem } from '../game/progress.js';
import { SKINS, TRAILS, RARITY, RARITY_ORDER, isOwned, unlockText, skinById, trailById, rankRewards, usd } from '../game/skins.js';
import { PASS, PASS_FREE, PASS_PRICE_USD, passInfo } from '../game/pass.js';
import { TIERS, TIER_PERKS, rankOf, MASTER_PR, LEGEND_PR, DIV_PR } from '../game/ranks.js';
import { SEASON, shopOffers, dailyState, DAILY_REWARDS, missionText, missionReward, MISSION_XP, msToMidnight } from '../game/meta.js';
import { ICON, emblem, skinPreview, trailPreview, nameTag, MUSIC_ICON } from './icons.js';
import { MUSIC, musicById } from '../game/music.js';
import { NAME_STYLES, nameStyleById } from '../game/names.js';

const RING = 106.8;

// Enviar con Enter sin usar <form>: en páginas con sandbox (como el artifact) el envío de
// formularios está bloqueado y el evento submit nunca llega.
function onEnter(input, fn) {
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); fn(); } });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renewIn() {
  const ms = msToMidnight();
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

function coinAmount(n, sign = '') {
  const s = el('span', 'coin-inline');
  s.innerHTML = ICON.coin;
  s.append(el('b', '', sign + fmt(n)));
  return s;
}

export const TITLES_BY_KIND = {
  how: 'Reglas', missions: 'Misiones diarias', shop: 'Tienda', collection: 'Colección', season: `Temporada ${SEASON.number}`,
  rank: 'Tu rango', profile: 'Tu perfil', settings: 'Ajustes', share: 'Compartir resultado', daily: 'Recompensa diaria',
  rankup: 'Ascenso', online: 'Jugar online', room: 'Sala', music: 'Música', names: 'Tu nombre', premium: 'Tienda Premium', friends: 'Amigos', prize: '¡Premio!', invite: 'Invitación', codes: 'Canjear código', redeemed: '¡Código canjeado!',
};

// Caja para canjear códigos promocionales (se usa en Ajustes, Tienda y su propia ventana)
function redeemBox(env) {
  const box = el('div', 'redeem');
  const label = el('label', 'redeem-label', 'Código promocional');
  const input = el('input', 'redeem-input');
  input.id = 'redeemInput';
  label.htmlFor = input.id;
  Object.assign(input, { type: 'text', maxLength: 24, autocomplete: 'off', spellcheck: false, placeholder: 'EJ: ABCD1234' });
  input.setAttribute('autocapitalize', 'characters');
  const btn = el('button', 'btn btn-primary btn-sm', 'Canjear');
  btn.type = 'button';
  const msg = el('p', 'redeem-msg');
  msg.setAttribute('role', 'status');
  const row = el('div', 'redeem-row');
  row.append(input, btn);
  box.append(label, row, msg);
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); msg.textContent = ''; box.classList.remove('bad'); });
  const redeem = () => {
    const r = env.h.onRedeem(input.value);
    if (r && !r.ok) {
      msg.textContent = r.error;
      box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad');
    }
  };
  btn.addEventListener('click', redeem);
  onEnter(input, redeem);
  return box;
}

export function buildModal(kind, body, env, data) {
  BUILDERS[kind](body, env, data);
}

const BUILDERS = {
  how(body) {
    body.innerHTML = `
      <ol class="steps">
        <li><span class="n">1</span><div><b>Movete</b><p>Arrastrá el dedo o el mouse. En la compu también funcionan ← → y A D.</p></div></li>
        <li><span class="n">2</span><div><b>Esquivá y juntá</b><p>Pasá por los huecos y agarrá chispas: cambian de forma y color y valen más en cada etapa (x2, x3, x5). Pasar muy cerca de un muro suma más.</p></div></li>
        <li><span class="n">3</span><div><b>Elegí el camino</b><p>Cuando el túnel se divide, el camino con más gente se derrumba. La multitud cambia de idea: leela.</p></div></li>
        <li><span class="n">4</span><div><b>Llegá al final</b><p>Sobreviví a las ${CFG.FORKS} bifurcaciones. Quedar entre los últimos 100, 50, 10 y 3 da puntos extra. El último en pie es el Outlier del minuto.</p></div></li>
      </ol>
      <h3>Muros</h3>
      <ul class="legend">
        <li><i class="sw gap"></i><span><b>Fijo.</b> Un hueco quieto.</span></li>
        <li><i class="sw moving"></i><span><b>Móvil.</b> El hueco va de lado a lado.</span></li>
        <li><i class="sw double"></i><span><b>Doble.</b> Dos huecos: el chico tiene chispas.</span></li>
        <li><i class="sw alt"></i><span><b>Puertas.</b> Se alternan: la roja está cerrada y la barra dorada marca cuánto falta.</span></li>
      </ul>
      <h3>Bifurcaciones</h3>
      <ul class="legend">
        <li><i class="sw gold"></i><span><b>Dorada.</b> Puntos x2, pero todos la ven.</span></li>
        <li><i class="sw narrow"></i><span><b>Angosta.</b> Difícil de pasar: entra poca gente.</span></li>
        <li><i class="sw fog"></i><span><b>Niebla.</b> No ves a la multitud.</span></li>
        <li><i class="sw invert"></i><span><b>Inversión.</b> Esa vez cae el camino con menos gente.</span></li>
      </ul>
      <h3>Competitivo</h3>
      <p>Cada ronda suma o resta <b>PR</b> según a cuántos superaste. Hay 5 ligas con 3 divisiones, y después Maestro y Leyenda. Una mala ronda nunca te baja de liga.</p>
      <p>En cada ronda tenés un <b>rival</b>: durá más que él para ganar PR y destellos extra. La <b>racha de caminos</b> cuenta cuántas bifurcaciones superaste seguidas, aunque sea entre rondas.</p>`;
  },

  missions(body, env) {
    const { save } = env;
    const head = el('div', 'mis-head');
    head.append(el('p', '', `Se renuevan en ${renewIn()}.`));
    body.append(head);
    const list = save.missions ? save.missions.list : [];
    list.forEach((m, i) => {
      const card = el('div', 'mission' + (m.claimed ? ' claimed' : m.progress >= m.goal ? ' ready' : ''));
      const left = el('div');
      left.append(el('b', '', missionText(m)));
      const rw = el('small');
      rw.innerHTML = ICON.coin;
      rw.append(` ${missionReward(m)} · +${MISSION_XP} XP`);
      left.append(document.createElement('br'), rw);
      let right;
      if (m.claimed) {
        right = el('span', 'rarity', 'Reclamada');
      } else if (m.progress >= m.goal) {
        right = el('button', 'btn btn-primary btn-sm', 'Reclamar');
        right.type = 'button';
        right.addEventListener('click', () => env.h.onClaimMission(i));
      } else {
        right = el('span', 'rarity', `${fmt(m.progress)}/${fmt(m.goal)}`);
      }
      const bar = el('div', 'xpbar');
      const fill = el('span');
      fill.style.width = Math.min(100, m.progress / m.goal * 100) + '%';
      bar.append(fill);
      card.append(left, right, bar);
      body.append(card);
    });
    body.append(el('p', 'note', 'Las misiones son iguales para todos los jugadores del día.'));
  },

  shop(body, env) {
    const { save, today } = env;
    const head = el('div', 'shop-head');
    const bal = el('p');
    bal.append('Tenés ', coinAmount(save.coins), ' destellos');
    head.append(bal, el('p', '', `Nuevas ofertas en ${renewIn()}`));
    body.append(head);
    const ctx = ownedCtx(save);
    for (const offer of shopOffers(today)) {
      const sk = offer.kind === 'trail' ? trailById(offer.id) : skinById(offer.id);
      const card = el('div', 'offer');
      card.style.setProperty('--rc', RARITY[sk.rarity].col);
      const info = el('div');
      const rar = el('span', 'rarity', `${offer.kind === 'trail' ? 'Estela' : 'Skin'} · ${RARITY[sk.rarity].name}`);
      rar.style.color = RARITY[sk.rarity].col;
      const price = el('span', 'price');
      price.innerHTML = ICON.coin;
      price.append(fmt(offer.price));
      if (offer.sale) { const s = el('s', '', fmt(offer.full)); price.append(' ', s, ' '); price.append(el('span', 'sale', '−25%')); }
      info.append(el('b', '', sk.name), rar, price);
      const owned = isOwned(sk, ctx);
      const btn = el('button', 'btn btn-sm ' + (owned ? 'btn-ghost' : 'btn-primary'));
      btn.type = 'button';
      if (owned) { btn.textContent = 'Tuya'; btn.disabled = true; }
      else if (save.coins < offer.price) { btn.textContent = `Faltan ${fmt(offer.price - save.coins)}`; btn.disabled = true; btn.className = 'btn btn-sm btn-ghost'; }
      else { btn.textContent = 'Comprar'; btn.addEventListener('click', () => env.h.onBuy(offer)); }
      card.append(offer.kind === 'trail' ? trailPreview(sk, skinById(save.skin).col || undefined) : skinPreview(sk), info, btn);
      body.append(card);
    }
    body.append(el('p', 'note', 'Ganás destellos jugando rondas, completando misiones, con el pase, los logros y la recompensa diaria. Todo es solo visual: no da ventaja en el juego.'));
    body.append(redeemBox(env));
  },

  // Conexión: nombre, servidor y a qué sala entrar
  online(body, env, data) {
    const o = env.h.onlineState();
    const form = el('div', 'online-form');
    const nameL = el('label', 'redeem-label', 'Tu nombre en la sala');
    const name = el('input', 'redeem-input name-input');
    name.id = 'onlineName';
    nameL.htmlFor = name.id;
    Object.assign(name, { type: 'text', maxLength: 16, autocomplete: 'nickname', placeholder: 'Ej: Ana', value: env.save.name || '' });
    form.append(nameL, name);
    let url = null;
    if (o.askUrl) {
      const urlL = el('label', 'redeem-label', 'Servidor');
      url = el('input', 'redeem-input url-input');
      url.id = 'onlineUrl';
      urlL.htmlFor = url.id;
      Object.assign(url, { type: 'url', placeholder: 'mi-servidor.onrender.com', value: env.save.server || '', autocomplete: 'off', spellcheck: false });
      form.append(urlL, url, el('p', 'note', 'Abriste el juego como archivo: poné la dirección del servidor online (te la pasa quien lo publicó).'));
    }
    const msg = el('p', 'redeem-msg', o.msg || '');
    msg.setAttribute('role', 'status');
    const go = (action, code) => {
      const r = env.h.onOnlineGo({ name: name.value, url: url ? url.value : null, action, code });
      if (r && r.error) msg.textContent = r.error;
    };
    const global = el('button', 'btn btn-primary online-global');
    global.type = 'button';
    global.innerHTML = '<span class="live-dot" aria-hidden="true"></span>';
    global.append(el('span', '', 'Minuto global'), el('small', '', o.nextGlobal ? `Próxima ronda en ${o.nextGlobal}` : 'Una ronda al comenzar cada minuto'));
    global.addEventListener('click', () => go('global'));
    onEnter(name, () => go('global'));
    const create = el('button', 'btn btn-ghost', 'Crear sala privada');
    create.type = 'button';
    create.addEventListener('click', () => go('create'));
    const joinRow = el('div', 'redeem-row');
    const code = el('input', 'redeem-input');
    code.id = 'roomCode';
    Object.assign(code, { type: 'text', maxLength: 4, placeholder: 'CÓDIGO', autocomplete: 'off', spellcheck: false });
    code.setAttribute('aria-label', 'Código de sala');
    if (data && data.code) code.value = data.code;
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    const join = el('button', 'btn btn-ghost btn-sm', 'Unirme');
    join.type = 'button';
    join.addEventListener('click', () => go('join', code.value));
    onEnter(code, () => go('join', code.value));
    if (url) onEnter(url, () => go('global'));
    joinRow.append(code, join);
    form.append(global, create, el('p', 'redeem-label', 'O entrá a la sala de un amigo'), joinRow, msg);
    body.append(form);
    if (o.status === 'connecting') msg.textContent = 'Conectando…';
  },

  // Sala: jugadores, código para invitar y cuándo empieza
  room(body, env) {
    const o = env.h.onlineState(), r = o.room;
    if (!r) { body.append(el('p', '', 'Conectando con la sala…')); return; }
    const head = el('div', 'room-head');
    if (r.pub) {
      head.append(el('strong', '', 'Minuto global'), el('small', '', 'Sala pública: juega todo el que esté conectado'));
    } else {
      const codeEl = el('strong', 'room-code', r.code);
      head.append(el('small', '', 'Código de la sala'), codeEl);
      const share = el('button', 'btn btn-ghost btn-sm', 'Copiar invitación');
      share.type = 'button';
      share.addEventListener('click', async () => { share.textContent = (await env.h.onInvite()) ? '¡Copiada!' : 'Código: ' + r.code; });
      head.append(share);
    }
    body.append(head);
    const inRound = r.phase === 'playing' || r.phase === 'countdown';
    // El estado (con la cuenta regresiva) se actualiza en su lugar, sin reconstruir la ventana
    const status = el('p', 'room-status', env.h.roomStatusText());
    status.id = 'roomStatus';
    status.setAttribute('aria-live', 'polite');
    body.append(status);
    const ul = el('ul', 'room-players');
    const skinCol = sk => sk.col || '#ff7ad9';
    for (const p of r.players) {
      const li = el('li', p.id === o.myId ? 'me' : '');
      const sk = skinById(p.skin), tr = trailById(p.trail);
      const pv = el('span', 'rp-look');
      pv.append(trailPreview(tr, skinCol(sk)), skinPreview(sk));
      const who = el('span', 'rp-who');
      who.append(nameTag(p.name, nameStyleById(p.nameStyle)));
      who.append(el('small', '', `${sk.name} · ${tr.name}${p.id === o.myId ? ' · vos' : ''}`));
      li.append(pv, who);
      if (p.id === r.host) li.append(el('em', '', 'Anfitrión'));
      else if (p.inRound) li.append(el('em', 'live', 'Jugando'));
      ul.append(li);
    }
    body.append(el('p', 'redeem-label', `${r.players.length} ${r.players.length === 1 ? 'jugador' : 'jugadores'} + bots hasta completar la multitud`), ul);
    if (!r.pub && r.host === o.myId && !inRound) {
      const start = el('button', 'btn btn-primary', 'Empezar ronda');
      start.type = 'button';
      start.addEventListener('click', () => env.h.onRoomStart());
      body.append(start);
    }
    const look = el('div', 'row room-look');
    for (const [label, kind] of [['Skin', 'collection'], ['Nombre', 'names'], ['Música', 'music'], ['Amigos', 'friends']]) {
      const b = el('button', 'btn btn-ghost btn-sm', label);
      b.type = 'button';
      b.addEventListener('click', () => env.h.onRoomOpen(kind));
      look.append(b);
    }
    body.append(look);
    const leave = el('button', 'btn btn-ghost', 'Salir de la sala');
    leave.type = 'button';
    leave.addEventListener('click', () => env.h.onRoomLeave());
    body.append(leave);
  },

  // Catálogo de música: escuchar, comprar y elegir el tema de las rondas
  music(body, env) {
    const { save } = env, ctx = ownedCtx(save), playing = env.h.musicPreview();
    const head = el('div', 'shop-head');
    const bal = el('p');
    bal.append('Tenés ', coinAmount(save.coins), ' destellos');
    head.append(bal, el('p', '', `Sonando: ${musicById(playing || save.track).name}`));
    body.append(head, el('p', 'note', 'Tocá ▶ para escucharlo a todo volumen. El tema elegido suena en tus rondas y se intensifica con cada bifurcación.'));
    const list = [...MUSIC].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    for (const m of list) {
      const own = isOwned(m, ctx), rar = RARITY[m.rarity], inUse = save.track === m.id, isPlaying = (playing || save.track) === m.id;
      const card = el('div', 'offer track-card' + (m.rarity === 'fundador' ? ' founder' : '') + (isPlaying ? ' playing' : ''));
      card.style.setProperty('--rc', rar.col);
      const ic = el('button', 'track-play');
      ic.type = 'button';
      ic.setAttribute('aria-label', (playing === m.id ? 'Detener ' : 'Escuchar ') + m.name);
      ic.innerHTML = playing === m.id ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : '<span class="tri">▶</span>';
      ic.addEventListener('click', () => env.h.onPreviewMusic(playing === m.id ? null : m.id));
      const info = el('div');
      const tag = el('span', 'rarity', `${m.genre} · ${rar.name}`);
      tag.style.color = rar.col;
      info.append(el('b', '', m.name), tag, el('small', 'track-meta', `${m.bpm} BPM${own ? '' : ' · ' + unlockText(m)}`));
      const btn = el('button', 'btn btn-sm');
      btn.type = 'button';
      if (inUse) { btn.textContent = 'En uso'; btn.className += ' btn-ghost'; btn.disabled = true; }
      else if (own) { btn.textContent = 'Usar'; btn.className += ' btn-primary'; btn.addEventListener('click', () => env.h.onSelectMusic(m.id)); }
      else if (m.src.type === 'shop') {
        const ok = save.coins >= m.src.price;
        btn.className += ok ? ' btn-primary' : ' btn-ghost';
        btn.innerHTML = ICON.coin;
        btn.append(' ' + fmt(m.src.price));
        if (ok) btn.addEventListener('click', () => env.h.onBuyItem('music', m)); else btn.disabled = true;
      } else { btn.innerHTML = ICON.lock; btn.className += ' btn-ghost'; btn.disabled = true; btn.setAttribute('aria-label', 'Bloqueado'); }
      card.append(ic, info, btn);
      body.append(card);
    }
  },

  // Nombre: cambiarlo y elegir su estilo
  names(body, env) {
    const { save } = env, ctx = ownedCtx(save), text = save.name || 'Tu nombre';
    const hero = el('div', 'name-hero');
    hero.append(nameTag(text, nameStyleById(save.nameStyle)));
    const row = el('div', 'redeem-row');
    const input = el('input', 'redeem-input name-input');
    input.id = 'nameInput';
    Object.assign(input, { type: 'text', maxLength: 16, placeholder: 'Escribí tu nombre', value: save.name || '', autocomplete: 'nickname' });
    input.setAttribute('aria-label', 'Tu nombre');
    const saveBtn = el('button', 'btn btn-primary btn-sm', 'Guardar');
    saveBtn.type = 'button';
    const msg = el('p', 'redeem-msg');
    const doSave = () => { const r = env.h.onRename(input.value); if (r && r.error) msg.textContent = r.error; };
    saveBtn.addEventListener('click', doSave);
    onEnter(input, doSave);
    row.append(input, saveBtn);
    body.append(hero, row, msg, el('p', 'note', 'Tu nombre se ve en las salas online, sobre tu bola y en la tabla de resultados. Elegí un estilo:'));
    const grid = el('div', 'col-grid name-grid');
    const list = [...NAME_STYLES].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    for (const st of list) {
      const own = isOwned(st, ctx), rar = RARITY[st.rarity], inUse = save.nameStyle === st.id;
      const card = el('button', 'col-card name-card' + (own ? '' : ' locked') + (st.rarity === 'fundador' ? ' founder' : ''));
      card.type = 'button';
      card.setAttribute('aria-checked', String(inUse));
      card.style.setProperty('--rc', rar.col);
      const shopOk = !own && st.src.type === 'shop' && save.coins >= st.src.price;
      const r = el('span', 'rarity', rar.name);
      r.style.color = rar.col;
      let foot;
      if (own) foot = inUse ? 'En uso' : 'Usar';
      else if (st.src.type === 'shop') foot = `${fmt(st.src.price)} destellos`;
      else foot = unlockText(st);
      card.append(nameTag(save.name || st.name, st), el('b', '', st.name), r, el('small', '', foot));
      if (own) card.addEventListener('click', () => env.h.onSelectName(st.id));
      else if (shopOk) { card.classList.add('buyable'); card.addEventListener('click', () => env.h.onBuyItem('name', st)); }
      else card.setAttribute('aria-disabled', 'true');
      grid.append(card);
    }
    body.append(grid);
  },

  codes(body, env) {
    body.append(el('p', '', 'Si tenés un código de un evento o de los creadores, canjealo acá.'), redeemBox(env));
  },

  // Celebración al canjear: recompensa grande y animada
  redeemed(body, env, data) {
    const r = data.reward;
    const hero = el('div', 'rank-hero redeemed' + (r.item && r.item.rarity === 'fundador' ? ' founder' : ''));
    if (r.kind === 'owner') {
      const c = el('div', 'redeem-coins');
      c.innerHTML = ICON.trophy;
      hero.classList.add('founder');
      hero.append(c, el('small', '', 'Modo dueños'), el('strong', '', 'Todo desbloqueado'));
      body.append(hero, el('p', 'unlock', 'Tenés todos los cosméticos, el pase Premium y 20.000 destellos para probar.'));
      const ok = el('button', 'btn btn-primary', '¡Genial!');
      ok.type = 'button';
      ok.setAttribute('data-close', '');
      body.append(ok);
      return;
    } else if (r.kind === 'coins') {
      const c = el('div', 'redeem-coins');
      c.innerHTML = ICON.coin;
      hero.append(c, el('small', '', 'Recibiste'), el('strong', '', `${fmt(r.amount)} destellos`));
    } else {
      const it = r.item, rar = RARITY[it.rarity];
      let prev;
      if (r.kind === 'skin') prev = skinPreview(it);
      else if (r.kind === 'trail') prev = trailPreview(it, skinById(env.save.skin).col || undefined);
      else if (r.kind === 'music') { prev = el('span', 'redeem-music'); prev.innerHTML = '<span class="eq big-eq"><i></i><i></i><i></i><i></i><i></i></span>'; }
      else { prev = el('span', 'redeem-name'); prev.append(nameTag(env.save.name || 'Tu nombre', it)); }
      prev.classList.add('big');
      const kindName = { skin: 'Skin', trail: 'Estela', music: 'Música', name: 'Estilo de nombre' }[r.kind];
      const tag = el('span', 'rarity', `${kindName} · ${rar.name}`);
      tag.style.color = rar.col;
      hero.append(prev, tag, el('strong', '', it.name));
    }
    body.append(hero);
    if (r.item) body.append(el('p', 'unlock', `${r.kind === 'music' ? 'Ya suena en tus rondas.' : 'Ya lo tenés equipado.'} ${r.item.rarity === 'fundador' ? 'Rareza Fundador: la más exclusiva del juego.' : ''}`));
    const btn = el('button', 'btn btn-primary', '¡A jugar!');
    btn.type = 'button';
    btn.setAttribute('data-close', '');
    body.append(btn);
  },

  collection(body, env, data) {
    const { save } = env;
    const ctx = ownedCtx(save);
    const tab = (data && data.tab) || 'skins';
    const tabs = el('div', 'tabs two');
    tabs.setAttribute('role', 'tablist');
    for (const [k, n] of [['skins', 'Skins'], ['trails', 'Estelas']]) {
      const list = k === 'skins' ? SKINS : TRAILS;
      const b = el('button', '', `${n} ${list.filter(x => isOwned(x, ctx)).length}/${list.length}`);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(k === tab));
      b.addEventListener('click', () => env.h.onCollectionTab(k));
      tabs.append(b);
    }
    body.append(tabs, el('p', '', (tab === 'skins' ? 'La skin es tu núcleo. Tocá una para usarla.' : 'La estela es el rastro que dejás. Se combina con cualquier skin.') + ' Son solo visuales: no dan ventaja.'));
    const grid = el('div', 'col-grid');
    grid.setAttribute('role', 'radiogroup');
    const isSkin = tab === 'skins';
    const list = [...(isSkin ? SKINS : TRAILS)].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    const current = isSkin ? save.skin : save.trail;
    const skinCol = skinById(save.skin).col || '#ff7ad9';
    for (const it of list) {
      const own = isOwned(it, ctx);
      const card = el('button', 'col-card' + (own ? '' : ' locked') + (it.rarity === 'fundador' ? ' founder' : ''));
      card.type = 'button';
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(current === it.id));
      card.style.setProperty('--rc', RARITY[it.rarity].col);
      const rar = el('span', 'rarity', RARITY[it.rarity].name);
      rar.style.color = RARITY[it.rarity].col;
      card.append(isSkin ? skinPreview(it) : trailPreview(it, skinCol), el('b', '', it.name), rar,
        el('small', '', own ? (current === it.id ? 'En uso' : 'Usar') : unlockText(it)));
      if (own) card.addEventListener('click', () => (isSkin ? env.h.onSelectSkin(it.id) : env.h.onSelectTrail(it.id)));
      else card.setAttribute('aria-disabled', 'true');
      grid.append(card);
    }
    body.append(grid);
  },

  // Pase de temporada: 100 niveles, del 1 al 20 gratis y del 21 al 100 con el pase Premium
  season(body, env) {
    const { save } = env, pi = passInfo(save.passXp || 0);
    const hero = el('div', 'rank-hero pass-hero');
    hero.append(el('strong', '', `Temporada ${SEASON.number} · ${SEASON.name}`),
      el('small', '', pi.max ? 'Nivel 100 · pase completo' : `Nivel ${pi.level} · ${fmt(pi.into)} / ${fmt(pi.need)} XP para el siguiente`));
    const bar = el('div', 'xpbar');
    const f = el('span'); f.style.width = (pi.into / pi.need * 100) + '%'; bar.append(f);
    hero.append(bar);
    body.append(hero);
    // Banner del pase Premium
    const prem = el('div', 'premium-banner' + (save.premiumPass ? ' owned' : ''));
    const pt = el('div');
    pt.append(el('b', '', save.premiumPass ? 'Pase Premium activo' : 'Pase Premium'),
      el('span', '', save.premiumPass ? 'Tenés los 100 niveles desbloqueados.' : `Desbloquea los niveles 21 a 100: skins Legendarias, la Mítica del nivel 100, música, estelas, estilos de nombre y destellos.`));
    const buy = el('button', 'btn btn-sm ' + (save.premiumPass ? 'btn-ghost' : 'btn-primary'));
    buy.type = 'button';
    if (save.premiumPass) { buy.textContent = 'Activo'; buy.disabled = true; }
    else { buy.append(usd(PASS_PRICE_USD)); buy.addEventListener('click', () => env.h.onBuyPremium('pass')); }
    prem.append(pt, buy);
    body.append(prem);
    const claim = PASS.filter(r => r.lvl <= pi.level && !save.passClaimed[r.lvl] && (!r.premium || save.premiumPass));
    const head = el('div', 'shop-head');
    head.append(el('p', '', 'Subís de nivel jugando. Los premios se reclaman a mano.'));
    if (claim.length > 1) {
      const all = el('button', 'btn btn-primary btn-sm', `Reclamar todo (${claim.length})`);
      all.type = 'button';
      all.addEventListener('click', () => env.h.onClaimPass('all'));
      head.append(all);
    }
    body.append(head);
    const ul = el('ul', 'track pass-track');
    for (const r of PASS) {
      const reached = pi.level >= r.lvl, claimed = !!save.passClaimed[r.lvl], locked = r.premium && !save.premiumPass;
      const item = el('li', (claimed ? 'got' : reached && !locked ? 'ready' : r.lvl === pi.level + 1 ? 'next' : '') + (r.premium ? ' prem' : ''));
      if (r.lvl === PASS_FREE + 1) ul.append(el('li', 'pass-divider', 'Pase Premium · niveles 21 a 100'));
      const rw = el('span', 'rw'), x = r.reward;
      if (x.kind === 'coins') rw.append(coinAmount(x.amount), ' destellos');
      else {
        const it = x.item, rar = RARITY[it.rarity];
        if (x.kind === 'skin') rw.append(skinPreview(it), `Skin ${it.name}`);
        else if (x.kind === 'trail') rw.append(trailPreview(it, skinById(save.skin).col || undefined), `Estela ${it.name}`);
        else if (x.kind === 'music') { const ic = el('span', 'mini-ic'); ic.innerHTML = MUSIC_ICON; rw.append(ic, `Música: ${it.name}`); }
        else rw.append(nameTag(save.name || it.name, it), ` Estilo ${it.name}`);
        const tag = el('em', 'rw-rar', rar.name); tag.style.color = rar.col;
        rw.append(tag);
      }
      let st;
      if (claimed) st = el('span', 'st', 'Reclamado');
      else if (reached && !locked) {
        st = el('button', 'btn btn-primary btn-sm', 'Reclamar');
        st.type = 'button';
        st.addEventListener('click', () => env.h.onClaimPass(r.lvl));
      } else if (locked) { st = el('span', 'st lock'); st.innerHTML = ICON.lock; }
      else st = el('span', 'st', r.lvl === pi.level + 1 ? 'Siguiente' : '');
      item.append(el('span', 'lv', `Nv ${r.lvl}`), rw, st);
      ul.append(item);
    }
    body.append(ul, el('p', 'note', 'Todos los cosméticos son solo visuales: no dan ninguna ventaja en el juego.'));
  },

  // Tienda Premium: Legendarias y Míticas. Precios listos; la compra se habilita en la v1.0
  premium(body, env) {
    const { save } = env, ctx = ownedCtx(save);
    body.append(el('p', 'premium-note', 'Acá van los cosméticos Legendarios y Míticos. Son solo visuales: no dan ninguna ventaja en el juego. Jugando gratis conseguís hasta la calidad Épica.'));
    const soon = el('p', 'soon-banner', 'Las compras se habilitan en la versión 1.0');
    body.append(soon);
    // El pase Premium también se vende acá
    const passCard = el('div', 'offer premium-offer pass-offer');
    passCard.style.setProperty('--rc', RARITY.mitica.col);
    const pic = el('span', 'pass-ic', '100');
    const pinfo = el('div');
    const ptag = el('span', 'rarity', 'Pase de temporada');
    ptag.style.color = RARITY.mitica.col;
    pinfo.append(el('b', '', 'Pase Premium'), ptag, el('small', 'track-meta', 'Niveles 21 a 100 · Mítica en el nivel 100'));
    const pbtn = el('button', 'btn btn-sm ' + (save.premiumPass ? 'btn-ghost' : 'btn-primary'));
    pbtn.type = 'button';
    if (save.premiumPass) { pbtn.textContent = 'Activo'; pbtn.disabled = true; }
    else { pbtn.textContent = usd(PASS_PRICE_USD); pbtn.addEventListener('click', () => env.h.onBuyPremium('pass')); }
    passCard.append(pic, pinfo, pbtn);
    body.append(passCard);
    const items = [
      ...SKINS.filter(k => k.src.type === 'premium').map(item => ({ kind: 'skin', item })),
      ...TRAILS.filter(k => k.src.type === 'premium').map(item => ({ kind: 'trail', item })),
      ...NAME_STYLES.filter(k => k.src.type === 'premium').map(item => ({ kind: 'name', item })),
    ].sort((a, b) => RARITY_ORDER.indexOf(b.item.rarity) - RARITY_ORDER.indexOf(a.item.rarity));
    for (const { kind, item } of items) {
      const rar = RARITY[item.rarity], own = isOwned(item, ctx);
      const card = el('div', 'offer premium-offer');
      card.style.setProperty('--rc', rar.col);
      let prev;
      if (kind === 'skin') prev = skinPreview(item);
      else if (kind === 'trail') prev = trailPreview(item, skinById(save.skin).col || undefined);
      else { prev = el('span', 'name-prev'); prev.append(nameTag(save.name || 'Nombre', item)); }
      const info = el('div');
      const tag = el('span', 'rarity', `${{ skin: 'Skin', trail: 'Estela', name: 'Estilo de nombre' }[kind]} · ${rar.name}`);
      tag.style.color = rar.col;
      info.append(el('b', '', item.name), tag);
      const btn = el('button', 'btn btn-sm ' + (own ? 'btn-ghost' : 'btn-primary'));
      btn.type = 'button';
      if (own) { btn.textContent = 'Tuya'; btn.disabled = true; }
      else { btn.textContent = usd(item.src.usd); btn.addEventListener('click', () => env.h.onBuyPremium(item.id)); }
      card.append(prev, info, btn);
      body.append(card);
    }
  },

  prize(body, env, data) { BUILDERS.redeemed(body, env, data); },

  invite(body, env, data) {
    const hero = el('div', 'rank-hero');
    hero.append(el('small', '', 'Te invitan a jugar'), nameTag(data.from || 'Un amigo', nameStyleById(data.nameStyle || 'nm-blanco')), el('strong', 'room-code', data.code));
    body.append(hero, el('p', '', 'Tu amigo te invita a su sala privada.'));
    const join = el('button', 'btn btn-primary', 'Unirme');
    join.type = 'button';
    join.addEventListener('click', () => env.h.onAcceptInvite(data.code));
    const no = el('button', 'btn btn-ghost', 'Ahora no');
    no.type = 'button';
    no.setAttribute('data-close', '');
    body.append(join, no);
  },

  // Amigos: tu código, agregar por código, ver quién está conectado e invitar a tu sala
  friends(body, env) {
    const { save } = env, o = env.h.friendsState();
    const me = el('div', 'friend-me');
    me.append(el('small', '', 'Tu código de amigo'), el('strong', 'friend-code', save.friendId));
    const copy = el('button', 'btn btn-ghost btn-sm', 'Copiar');
    copy.type = 'button';
    copy.addEventListener('click', async () => { copy.textContent = (await env.h.onCopyFriendCode()) ? '¡Copiado!' : save.friendId; });
    me.append(copy);
    body.append(me);
    const row = el('div', 'redeem-row');
    const input = el('input', 'redeem-input');
    input.id = 'friendInput';
    Object.assign(input, { type: 'text', maxLength: 6, placeholder: 'CÓDIGO DE AMIGO', autocomplete: 'off', spellcheck: false });
    input.setAttribute('aria-label', 'Código de amigo');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    const add = el('button', 'btn btn-primary btn-sm', 'Agregar');
    add.type = 'button';
    const msg = el('p', 'redeem-msg', o.msg || '');
    const doAdd = () => { const r = env.h.onAddFriend(input.value); if (r && r.error) msg.textContent = r.error; };
    add.addEventListener('click', doAdd);
    onEnter(input, doAdd);
    row.append(input, add);
    body.append(row, msg);
    if (o.status !== 'on') body.append(el('p', 'note', o.status === 'connecting' ? 'Conectando para ver quién está en línea…' : 'Sin conexión: no se puede ver quién está en línea.'));
    if (!save.friends.length) { body.append(el('p', 'empty', 'Todavía no agregaste amigos. Pasales tu código y agregá el de ellos.')); return; }
    const ul = el('ul', 'room-players friend-list');
    const room = o.room;
    for (const fr of save.friends) {
      const st = o.presence[fr.id] || {};
      const li = el('li', st.online ? 'on' : 'off');
      const look = el('span', 'rp-look');
      look.append(skinPreview(skinById(st.skin || 'ambar')));
      const who = el('span', 'rp-who');
      who.append(nameTag(st.name || fr.name || fr.id, nameStyleById(st.nameStyle || 'nm-blanco')));
      who.append(el('small', '', st.online ? (st.room ? `En línea · ${st.room === 'GLOBAL' ? 'Minuto global' : 'en una sala'}` : 'En línea') : 'Desconectado'));
      const acts = el('span', 'friend-acts');
      if (st.online && room && !room.pub) {
        const inv = el('button', 'btn btn-primary btn-sm', 'Invitar');
        inv.type = 'button';
        inv.addEventListener('click', () => { env.h.onInviteFriend(fr.id); inv.textContent = 'Invitado'; inv.disabled = true; });
        acts.append(inv);
      } else if (st.online && st.room && st.room !== (room && room.code)) {
        const join = el('button', 'btn btn-ghost btn-sm', 'Unirme');
        join.type = 'button';
        join.addEventListener('click', () => env.h.onJoinFriend(st.room));
        acts.append(join);
      }
      const del = el('button', 'icon-btn friend-del');
      del.type = 'button';
      del.setAttribute('aria-label', 'Quitar amigo');
      del.textContent = '×';
      del.addEventListener('click', () => env.h.onRemoveFriend(fr.id));
      acts.append(del);
      li.append(look, who, acts);
      ul.append(li);
    }
    body.append(ul);
    if (!room || room.pub) body.append(el('p', 'note', 'Para invitar, creá una sala privada desde Online con amigos.'));
  },

  rank(body, env) {
    const { save } = env;
    const rk = rankOf(save.pr);
    const hero = el('div', 'rank-hero');
    hero.style.setProperty('--rank', TIERS[rk.tier].col);
    hero.innerHTML = emblem(rk.tier, 84);
    const bar = el('span', 'rank-bar');
    const fill = el('i');
    fill.style.width = rk.need ? (rk.into / rk.need * 100) + '%' : '100%';
    bar.append(fill);
    hero.append(el('strong', '', rk.label), el('small', '', rk.need ? `${fmt(rk.into)} / ${fmt(rk.need)} PR · total ${fmt(save.pr)}` : `${fmt(save.pr)} PR`), bar,
      el('small', '', `Máximo alcanzado: ${rankOf(save.peakPR).label}`));
    body.append(hero);
    body.append(el('h3', '', 'Recompensas de liga'));
    const peak = rankOf(save.peakPR).tier;
    const ul = el('ul', 'tier-rows');
    TIERS.forEach((t, i) => {
      const li = el('li', (i === rk.tier ? 'on ' : '') + (i <= peak ? 'got' : ''));
      li.innerHTML = emblem(i, 36);
      const d = el('div');
      const from = i < 5 ? i * DIV_PR * 3 : i === 5 ? MASTER_PR : LEGEND_PR;
      d.append(el('b', '', `${t.name} · ${fmt(from)} PR`), el('small', '', TIER_PERKS[i].perk));
      const items = el('span', 'tier-items');
      for (const r of rankRewards(i)) {
        items.append(r.kind === 'skin' ? skinPreview(r.item) : trailPreview(r.item));
        items.title = rankRewards(i).map(x => `${x.kind === 'skin' ? 'Skin' : 'Estela'} ${x.item.name}`).join(' · ');
      }
      const names = rankRewards(i).map(x => x.item.name).join(' · ');
      if (names) d.append(el('small', 'tier-names', names));
      li.append(d, items);
      ul.append(li);
    });
    body.append(ul, el('p', '', 'Las recompensas de liga se quedan para siempre, aunque después bajes. Superar al 50% de los jugadores te deja en cero PR; más arriba sumás, más abajo restás.'));
  },

  daily(body, env, data) {
    const { save, today, yesterday } = env;
    const st = dailyState(save, today, yesterday);
    if (data && data.claimed) {
      // Recién reclamada: mostrar el premio en grande
      const r = data.claimed;
      const hero = el('div', 'rank-hero claim-hero');
      hero.append(el('small', '', `Día ${r.index + 1} de 7`));
      if (r.skin) { const sk = skinById(r.skin); const pv = skinPreview(sk); pv.classList.add('big'); hero.append(pv, el('strong', '', `Skin ${sk.name}`)); }
      else { const c = coinAmount(r.coins, '+'); c.classList.add('big-coins'); hero.append(c); }
      const next = DAILY_REWARDS[(r.index + 1) % 7];
      hero.append(el('p', '', `Mañana: ${typeof next === 'number' ? `${next} destellos` : 'skin Aurora'}. Si te salteás un día, vuelve a empezar.`));
      body.append(hero);
      const ok = el('button', 'btn btn-primary', '¡Listo!');
      ok.type = 'button';
      ok.setAttribute('data-close', '');
      body.append(ok);
      return;
    }
    body.append(el('p', '', st.available ? 'Volvé cada día para que la recompensa crezca. Si te salteás un día, vuelve a empezar.' : 'Ya reclamaste la de hoy. Volvé mañana.'));
    const grid = el('div', 'daily-grid');
    DAILY_REWARDS.forEach((r, i) => {
      const cls = i < st.index || (!st.available && i === st.index) ? 'done' : (st.available && i === st.index ? 'today' : '');
      const d = el('div', 'day ' + cls + (i === 6 ? ' big' : ''));
      d.append(el('span', '', `Día ${i + 1}`));
      if (typeof r === 'number') d.append(coinAmount(r));
      else { const sk = skinById(r); d.append(skinPreview(sk), el('b', '', sk.name)); }
      grid.append(d);
    });
    body.append(grid);
    const btn = el('button', 'btn ' + (st.available ? 'btn-primary' : 'btn-ghost'), st.available ? 'Reclamar' : 'Cerrar · volvé mañana');
    btn.type = 'button';
    if (st.available) btn.addEventListener('click', () => env.h.onClaimDaily());
    else btn.setAttribute('data-close', '');
    body.append(btn);
  },

  rankup(body, env, data) {
    const hero = el('div', 'rank-hero rankup');
    hero.style.setProperty('--rank', TIERS[data.tier].col);
    hero.innerHTML = emblem(data.tier, 120);
    hero.append(el('small', '', data.newTier ? 'Nueva liga' : 'Nueva división'), el('strong', '', data.label));
    body.append(hero);
    if (data.skin) body.append(el('p', 'unlock', `Desbloqueaste la skin ${data.skin}.`));
    const btn = el('button', 'btn btn-primary', 'Genial');
    btn.type = 'button';
    btn.setAttribute('data-close', '');
    body.append(btn);
  },

  profile(body, env, data) {
    const { save } = env;
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    const panel = el('div', 'tab-panel');
    const names = [['sum', 'Resumen'], ['ach', 'Logros'], ['rec', 'Récords']];
    const show = key => {
      [...tabs.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === key)));
      panel.innerHTML = '';
      PROFILE_TABS[key](panel, save, env);
    };
    for (const [k, n] of names) {
      const b = el('button', '', n);
      b.type = 'button';
      b.dataset.k = k;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => show(k));
      tabs.append(b);
    }
    body.append(tabs, panel);
    show((data && data.tab) || 'sum');
  },

  settings(body, env) {
    const { save } = env;
    const rows = [
      ['sfx', 'Sonido', 'Efectos del juego'],
      ['music', 'Música', 'Se intensifica con la tensión de la ronda'],
      ['vib', 'Vibración', 'En celulares compatibles'],
      ['notif', 'Avisos durante la partida', 'Logros, misiones y el feed de la ronda. Apagalo para jugar sin distracciones'],
      ['relTouch', 'Control por arrastre', 'Táctil: arrastrá desde cualquier parte de la pantalla (si lo apagás, la bola va adonde tocás)'],
    ];
    for (const [key, name, desc] of rows) {
      const b = el('button', 'switch-row');
      b.type = 'button';
      b.setAttribute('role', 'switch');
      b.setAttribute('aria-checked', String(!!save[key]));
      b.innerHTML = '<span><b></b><small></small></span><i class="switch" aria-hidden="true"></i>';
      b.querySelector('b').textContent = name;
      b.querySelector('small').textContent = desc;
      b.addEventListener('click', () => {
        env.h.onToggle(key);
        b.setAttribute('aria-checked', String(!!env.getSave()[key]));
      });
      body.append(b);
    }
    if (env.h.canInstall()) {
      const inst = el('button', 'btn btn-primary', 'Instalar como app');
      inst.type = 'button';
      inst.addEventListener('click', () => env.h.onInstall());
      body.append(inst, el('p', 'note', 'Queda en tu pantalla de inicio y funciona sin conexión.'));
    }
    body.append(redeemBox(env));
    const zone = el('div', 'danger-zone');
    const reset = el('button', 'btn btn-danger', 'Borrar mi progreso');
    reset.type = 'button';
    let armed = false;
    reset.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Tocá de nuevo para confirmar';
        setTimeout(() => { armed = false; reset.textContent = 'Borrar mi progreso'; }, 3500);
        return;
      }
      env.h.onReset();
      env.close();
    });
    zone.append(reset, el('p', 'note', `Tu progreso se guarda solo en este dispositivo. Versión ${CFG.VERSION}.`));
    body.append(zone);
  },

  share(body, env, data) {
    const img = el('img', 'share-img');
    img.alt = 'Tarjeta con tu resultado';
    img.src = data.image;
    const txt = el('p', 'share-text', data.text);
    const row = el('div', 'row');
    const copy = el('button', 'btn btn-primary', 'Copiar texto');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(data.text);
        copy.textContent = 'Copiado';
      } catch (e) {
        const range = document.createRange();
        range.selectNodeContents(txt);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        copy.textContent = 'Seleccionado: copialo';
      }
    });
    row.append(copy);
    // Dentro de un visor embebido las descargas están bloqueadas
    if (window.self === window.top) {
      const dl = el('a', 'btn btn-ghost', 'Descargar');
      dl.href = data.image;
      dl.download = 'contracorriente-resultado.png';
      row.append(dl);
    } else row.style.gridTemplateColumns = '1fr';
    body.append(img, txt, row, el('p', 'note', 'En el celular, mantené presionada la imagen para guardarla.'));
  },
};

const PROFILE_TABS = {
  sum(panel, save) {
    const li = levelInfo(save.xp), rk = rankOf(save.pr);
    const head = el('div', 'profile-head');
    head.innerHTML = `<span class="ring" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="ring-bg" cx="20" cy="20" r="17"/><circle class="ring-fg" cx="20" cy="20" r="17" style="stroke-dashoffset:${RING * (1 - li.into / li.need)}"/></svg><b>${li.level}</b></span>`;
    const d = el('div');
    const bar = el('div', 'xpbar');
    const f = el('span'); f.style.width = (li.into / li.need * 100) + '%'; bar.append(f);
    d.append(el('strong', '', titleOf(li.level)), el('small', '', `Nivel ${li.level} · ${rk.label} · ${skinById(save.skin).name} + ${trailById(save.trail).name}`), bar);
    head.append(d);
    const st = streakNow(save);
    const cells = [
      [fmt(save.rounds), 'Rondas'], [save.rounds ? pctText(save.best) : '—', 'Mejor resultado'],
      [save.forksSeen ? instinct(save) + '%' : '—', 'Instinto'], [fmt(save.outliers), 'Veces Outlier'],
      [fmt(save.rivalsBeaten), 'Rivales vencidos'], [fmt(save.bestPathStreak), 'Mejor racha de caminos'],
      [`${fmt(st)} ${st === 1 ? 'día' : 'días'}`, 'Racha de días'], [fmt(save.bestScore), 'Mejor puntaje'],
    ];
    const grid = el('div', 'pstats');
    grid.innerHTML = cells.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const ul = el('ul', 'ladder');
    for (const t of TITLES) {
      const item = el('li', li.level >= t.lvl ? 'on' : '');
      item.append(el('b', '', t.name), el('span', '', `Nivel ${t.lvl}`));
      ul.append(item);
    }
    panel.append(head, grid, el('p', '', 'El Instinto es el porcentaje de bifurcaciones que superaste en toda tu historia.'), el('h3', '', 'Títulos'), ul);
  },
  ach(panel, save, env) {
    const got = Object.keys(save.ach).length;
    panel.append(el('p', '', `Desbloqueaste ${got} de ${ACHIEVEMENTS.length}. Cada logro tiene un premio que se reclama a mano.`));
    const ul = el('ul', 'ach-list');
    for (const a of ACHIEVEMENTS) {
      const on = !!save.ach[a.id], claimed = !!save.achClaimed[a.id], item = achItem(a);
      const li = el('li', on ? 'on' : '');
      li.innerHTML = `<span class="ic">${on ? ICON.check : ICON.lock}</span>`;
      const d = el('div');
      const prize = el('small', 'ach-prize');
      prize.append(coinAmount(a.coins));
      if (item) prize.append(` + ${item.type ? 'estela' : 'skin'} ${item.name}`);
      d.append(el('b', '', a.name), el('span', '', a.desc), prize);
      li.append(d);
      if (on && !claimed) {
        const b = el('button', 'btn btn-primary btn-sm', 'Reclamar');
        b.type = 'button';
        b.addEventListener('click', () => env.h.onClaimAch(a.id));
        li.append(b);
      } else if (claimed) li.append(el('span', 'st', 'Reclamado'));
      ul.append(li);
    }
    panel.append(ul);
  },
  rec(panel, save) {
    if (!save.records.length) {
      panel.append(el('p', 'empty', 'Todavía no hay récords. Jugá una ronda y aparecen acá.'));
      return;
    }
    const rows = save.records.map((r, i) => `<tr><td>${i + 1}</td><td class="r">${fmt(r.score)}</td><td class="r">#${fmt(r.rank)}</td><td class="r">${pctText(r.pct)}</td></tr>`).join('');
    const wrap = el('div');
    wrap.innerHTML = `<table class="rec-table"><thead><tr><th>#</th><th class="r">Puntos</th><th class="r">Puesto</th><th class="r">Superaste</th></tr></thead><tbody>${rows}</tbody></table>`;
    panel.append(wrap, el('p', '', 'Tus 5 mejores rondas en este dispositivo.'));
  },
};
