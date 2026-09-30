// Contenido de cada ventana. Cada constructor recibe el cuerpo vacío, el guardado y los callbacks.
import { CFG } from '../config.js';
import { fmt, pctText } from '../util/math.js';
import { TITLES, ACHIEVEMENTS, levelInfo, titleOf, streakNow, instinct, ownedCtx } from '../game/progress.js';
import { SKINS, TRAILS, RARITY, RARITY_ORDER, isOwned, unlockText, skinById, trailById, rankRewards } from '../game/skins.js';
import { TIERS, TIER_PERKS, rankOf, MASTER_PR, LEGEND_PR, DIV_PR } from '../game/ranks.js';
import { SEASON, seasonTrack, shopOffers, dailyState, DAILY_REWARDS, missionText, missionReward, MISSION_XP, msToMidnight } from '../game/meta.js';
import { ICON, emblem, skinPreview, trailPreview } from './icons.js';

const RING = 106.8;

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
  rankup: 'Ascenso', codes: 'Canjear código', redeemed: '¡Código canjeado!',
};

// Caja para canjear códigos promocionales (se usa en Ajustes, Tienda y su propia ventana)
function redeemBox(env) {
  const box = el('form', 'redeem');
  box.noValidate = true;
  const label = el('label', 'redeem-label', 'Código promocional');
  const input = el('input', 'redeem-input');
  input.id = 'redeemInput';
  label.htmlFor = input.id;
  Object.assign(input, { type: 'text', maxLength: 24, autocomplete: 'off', spellcheck: false, placeholder: 'EJ: ABCD1234' });
  input.setAttribute('autocapitalize', 'characters');
  const btn = el('button', 'btn btn-primary btn-sm', 'Canjear');
  btn.type = 'submit';
  const msg = el('p', 'redeem-msg');
  msg.setAttribute('role', 'status');
  const row = el('div', 'redeem-row');
  row.append(input, btn);
  box.append(label, row, msg);
  input.addEventListener('input', () => { input.value = input.value.toUpperCase(); msg.textContent = ''; box.classList.remove('bad'); });
  box.addEventListener('submit', e => {
    e.preventDefault();
    const r = env.h.onRedeem(input.value);
    if (r && !r.ok) {
      msg.textContent = r.error;
      box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad');
    }
  });
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
        <li><span class="n">2</span><div><b>Esquivá y juntá</b><p>Pasá por los huecos y agarrá las chispas doradas. Pasar muy cerca de un muro suma más.</p></div></li>
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
    body.append(el('p', 'note', 'Ganás destellos jugando rondas, completando misiones, subiendo de nivel y con la recompensa diaria.'));
    body.append(redeemBox(env));
  },

  codes(body, env) {
    body.append(el('p', '', 'Si tenés un código de un evento o de los creadores, canjealo acá.'), redeemBox(env));
  },

  // Celebración al canjear: recompensa grande y animada
  redeemed(body, env, data) {
    const r = data.reward;
    const hero = el('div', 'rank-hero redeemed' + (r.item && r.item.rarity === 'fundador' ? ' founder' : ''));
    if (r.kind === 'coins') {
      const c = el('div', 'redeem-coins');
      c.innerHTML = ICON.coin;
      hero.append(c, el('small', '', 'Recibiste'), el('strong', '', `${fmt(r.amount)} destellos`));
    } else {
      const it = r.item, rar = RARITY[it.rarity];
      const prev = r.kind === 'skin' ? skinPreview(it) : trailPreview(it, skinById(env.save.skin).col || undefined);
      prev.classList.add('big');
      const tag = el('span', 'rarity', `${r.kind === 'skin' ? 'Skin' : 'Estela'} · ${rar.name}`);
      tag.style.color = rar.col;
      hero.append(prev, tag, el('strong', '', it.name));
    }
    body.append(hero);
    if (r.item) body.append(el('p', 'unlock', `Ya la tenés equipada. ${r.item.rarity === 'fundador' ? 'Rareza Fundador: la más exclusiva del juego.' : ''}`));
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
    body.append(tabs, el('p', '', tab === 'skins' ? 'La skin es tu núcleo. Tocá una para usarla.' : 'La estela es el rastro que dejás. Se combina con cualquier skin.'));
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

  season(body, env) {
    const { save } = env;
    const li = levelInfo(save.xp);
    const hero = el('div', 'rank-hero');
    hero.append(el('strong', '', SEASON.name), el('small', '', `Nivel ${li.level} · ${fmt(li.into)} / ${fmt(li.need)} XP`));
    const bar = el('div', 'xpbar');
    bar.style.width = '100%';
    const f = el('span'); f.style.width = (li.into / li.need * 100) + '%'; bar.append(f);
    hero.append(bar);
    body.append(hero, el('p', '', 'El pase es gratis: cada nivel que subís te da una recompensa.'));
    const ul = el('ul', 'track');
    for (const r of seasonTrack()) {
      const got = li.level >= r.lvl;
      const item = el('li', got ? 'got' : r.lvl === li.level + 1 ? 'next' : '');
      const rw = el('span', 'rw');
      if (r.type === 'skin') { const sk = skinById(r.skin); rw.append(skinPreview(sk), `Skin ${sk.name}`); }
      else if (r.type === 'trail') { const tr = trailById(r.trail); rw.append(trailPreview(tr, skinById(save.skin).col || undefined), `Estela ${tr.name}`); }
      else rw.append(coinAmount(r.coins), ' destellos');
      item.append(el('span', 'lv', `Nv ${r.lvl}`), rw, el('span', 'st', got ? 'Obtenida' : r.lvl === li.level + 1 ? 'Siguiente' : ''));
      ul.append(item);
    }
    body.append(ul);
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

  profile(body, env) {
    const { save } = env;
    const tabs = el('div', 'tabs');
    tabs.setAttribute('role', 'tablist');
    const panel = el('div', 'tab-panel');
    const names = [['sum', 'Resumen'], ['ach', 'Logros'], ['rec', 'Récords']];
    const show = key => {
      [...tabs.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === key)));
      panel.innerHTML = '';
      PROFILE_TABS[key](panel, save);
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
    show('sum');
  },

  settings(body, env) {
    const { save } = env;
    const rows = [
      ['sfx', 'Sonido', 'Efectos del juego'],
      ['music', 'Música', 'Se intensifica con la tensión de la ronda'],
      ['vib', 'Vibración', 'En celulares compatibles'],
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
    zone.append(reset, el('p', 'note', 'Tu progreso se guarda solo en este dispositivo.'));
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
  ach(panel, save) {
    const got = Object.keys(save.ach).length;
    panel.append(el('p', '', `Desbloqueaste ${got} de ${ACHIEVEMENTS.length}.`));
    const ul = el('ul', 'ach-list');
    for (const a of ACHIEVEMENTS) {
      const on = !!save.ach[a.id];
      const li = el('li', on ? 'on' : '');
      li.innerHTML = `<span class="ic">${on ? ICON.check : ICON.lock}</span>`;
      const d = el('div');
      d.append(el('b', '', a.name), el('span', '', a.desc));
      li.append(d);
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
