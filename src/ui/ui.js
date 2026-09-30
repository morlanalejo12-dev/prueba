// Capa de interfaz DOM: HUD, carteles, avisos, menú, resultados y ventanas.
// No conoce la simulación por dentro: recibe datos ya calculados y avisa acciones por callbacks.
import { CFG } from '../config.js';
import { fmt, pctText, easeOutCubic } from '../util/math.js';
import { SKINS, TITLES, ACHIEVEMENTS, levelInfo, titleOf, streakNow } from '../game/progress.js';

export const $ = id => document.getElementById(id);

const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
};

const RING = 106.8; // circunferencia del anillo de nivel (r = 17)
const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export const WHY_TEXT = {
  wall: 'Chocaste contra un muro.',
  majority: 'Caíste por elegir el camino de la mayoría.',
  inverted: 'Caíste en la inversión: elegiste el camino más vacío.',
  alive: 'Llegaste al final con vida.',
};

export function createUI(h) {
  // ---------- Carteles, pistas, destellos y avisos ----------
  let bannerTok = 0, hintTimer = 0, lastInputKeyboard = false;
  window.addEventListener('keydown', () => { lastInputKeyboard = true; }, true);
  window.addEventListener('pointerdown', () => { lastInputKeyboard = false; }, true);

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
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ICON.trophy}<div><small></small><b></b></div>`;
    el.querySelector('small').textContent = kicker;
    el.querySelector('b').textContent = title;
    $('toasts').append(el);
    setTimeout(() => el.remove(), 3700);
  }

  // ---------- HUD ----------
  const forkDots = [];
  for (let i = 0; i < CFG.FORKS; i++) {
    const d = document.createElement('i');
    $('hForks').append(d);
    forkDots.push(d);
  }
  let hudKey = '';
  function hud(R) {
    const key = `${R.aliveTotal}|${Math.floor(R.score)}|${R.cf}|${R.combo}|${R.pAlive}`;
    if (key === hudKey) return;
    hudKey = key;
    $('hAlive').textContent = fmt(R.aliveTotal);
    $('hScore').textContent = fmt(R.score);
    const cb = $('hCombo');
    cb.hidden = R.combo < 2;
    cb.textContent = `x${R.combo}`;
    forkDots.forEach((d, k) => {
      d.className = R.forkLog[k] || (k === R.cf && R.pAlive ? 'now' : '');
    });
  }

  function showHud(on) { $('hud').hidden = !on; hudKey = ''; }
  function showSpectator(rank, total, pct) {
    $('spectText').innerHTML = `Puesto <b>#${fmt(rank)}</b> de ${fmt(total)} · más que el ${pctText(pct)}. Mirá cómo sigue la ronda.`;
    $('spect').hidden = false;
  }
  function hideSpectator() { $('spect').hidden = true; }

  // ---------- Menú ----------
  function renderMenu(save) {
    const li = levelInfo(save.xp);
    $('pLevel').textContent = li.level;
    $('pTitle').textContent = titleOf(li.level);
    $('pXp').textContent = `${fmt(li.into)} / ${fmt(li.need)} XP`;
    $('ringFill').style.strokeDashoffset = String(RING * (1 - li.into / li.need));
    $('tSkins').textContent = `${SKINS.filter(k => li.level >= k.lvl).length}/${SKINS.length}`;
    $('tAch').textContent = `${Object.keys(save.ach).length}/${ACHIEVEMENTS.length}`;
    $('tRec').textContent = save.bestScore ? fmt(save.bestScore) : '—';
    $('sBest').textContent = save.rounds ? pctText(save.best) : '—';
    $('sRounds').textContent = fmt(save.rounds);
    $('sStreak').textContent = fmt(streakNow(save));
    $('sOutliers').textContent = fmt(save.outliers);
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
  function tweenRank(to, from) {
    const el = $('rRank');
    if (reduceMotion) { el.textContent = '#' + fmt(to); return; }
    const t0 = performance.now(), d = 900;
    const tick = now => {
      const k = Math.min(1, (now - t0) / d);
      el.textContent = '#' + fmt(from + (to - from) * easeOutCubic(k));
      if (k < 1 && !$('results').hidden) requestAnimationFrame(tick);
      else el.textContent = '#' + fmt(to);
    };
    requestAnimationFrame(tick);
  }

  function renderResults(sum, rep, outlier) {
    $('rEyebrow').textContent = sum.outlier ? 'Sos el Outlier del minuto'
      : rep.recordPos === 1 && rep.recordCount > 1 ? 'Nuevo récord de puntos'
      : rep.newBestPct ? 'Nuevo mejor puesto'
      : sum.alive ? 'Llegaste al final' : 'Fin de la ronda';
    tweenRank(sum.rank, sum.total);
    $('rOf').textContent = 'de ' + fmt(sum.total);
    $('rPct').textContent = sum.outlier
      ? 'Nadie duró más que vos. Tu nombre sale en la pantalla de todos.'
      : `Sobreviviste más que el ${pctText(sum.pct)} de los jugadores.`;
    $('rWhy').textContent = WHY_TEXT[sum.alive ? 'alive' : sum.why] || '';
    $('rForks').textContent = `${sum.forksOk}/${sum.forks}`;
    $('rScore').textContent = fmt(sum.score);
    $('rNear').textContent = fmt(sum.near);
    $('rOrbs').textContent = fmt(sum.orbs);

    $('rXp').textContent = `+${fmt(rep.gain)} XP`;
    $('rLevel').textContent = `Nivel ${rep.after.level} · ${titleOf(rep.after.level)}`;
    const fill = $('rXpFill'), up = rep.after.level > rep.before.level;
    fill.classList.remove('anim');
    fill.style.width = (up ? 0 : rep.before.into / rep.before.need * 100) + '%';
    void fill.offsetWidth;
    fill.classList.add('anim');
    fill.style.width = (rep.after.into / rep.after.need * 100) + '%';
    const un = $('rUnlock');
    un.hidden = !up;
    if (up) {
      const skins = rep.unlockedSkins.map(k => k.name);
      un.textContent = `¡Subiste a nivel ${rep.after.level}!` + (skins.length ? ` Nueva estela: ${skins.join(' y ')}.` : '');
    }

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
  }

  function setNext(n) { $('rNext').textContent = n; }

  // ---------- Ventanas ----------
  let opener = null, modalKind = '';
  const TITLES_BY_KIND = { how: 'Cómo jugar', skins: 'Estelas', ach: 'Logros', records: 'Récords', settings: 'Ajustes', profile: 'Tu perfil', share: 'Compartir resultado' };

  function openModal(kind, data) {
    opener = document.activeElement;
    modalKind = kind;
    $('modalTitle').textContent = TITLES_BY_KIND[kind];
    const body = $('modalBody');
    body.innerHTML = '';
    BUILDERS[kind](body, h.getSave(), data);
    $('modal').hidden = false;
    $('modal').querySelector('.sheet-head [data-close]').focus({ preventScroll: true });
    h.onModal(true);
  }
  function closeModal() {
    if ($('modal').hidden) return;
    $('modal').hidden = true;
    modalKind = '';
    h.onModal(false);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  const refreshModal = () => { if (modalKind) { const k = modalKind; const body = $('modalBody'); body.innerHTML = ''; BUILDERS[k](body, h.getSave()); } };

  const BUILDERS = {
    how(body) {
      body.innerHTML = `
        <ol class="steps">
          <li><span class="n">1</span><div><b>Movete</b><p>Arrastrá el dedo o el mouse. En la compu también funcionan ← → y A D.</p></div></li>
          <li><span class="n">2</span><div><b>Esquivá y juntá</b><p>Pasá por los huecos y agarrá las chispas doradas. Pasar muy cerca de un muro suma más.</p></div></li>
          <li><span class="n">3</span><div><b>Elegí el camino</b><p>Cuando el túnel se divide, el camino con más gente se derrumba. La multitud cambia de idea: leela.</p></div></li>
          <li><span class="n">4</span><div><b>Llegá al final</b><p>Sobreviví a las ${CFG.FORKS} bifurcaciones. El último en pie es el Outlier del minuto.</p></div></li>
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
        </ul>`;
    },

    skins(body, save) {
      const li = levelInfo(save.xp);
      const grid = document.createElement('div');
      grid.className = 'skin-grid';
      grid.setAttribute('role', 'radiogroup');
      grid.setAttribute('aria-label', 'Color de tu estela');
      for (const sk of SKINS) {
        const open = li.level >= sk.lvl;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'skin-card';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(save.skin === sk.id));
        b.disabled = !open;
        const dot = document.createElement('i');
        if (sk.col) b.style.setProperty('--c', sk.col);
        else { b.style.setProperty('--c', '#ff7ad9'); dot.style.background = 'conic-gradient(#ff7ad9, #8fd8ff, #5ef2c2, #ffd166, #ff7ad9)'; }
        const name = document.createElement('b');
        name.textContent = sk.name;
        const req = document.createElement('small');
        req.textContent = open ? (save.skin === sk.id ? 'En uso' : 'Disponible') : `Nivel ${sk.lvl}`;
        b.append(dot, name, req);
        b.addEventListener('click', () => { h.onSelectSkin(sk.id); refreshModal(); });
        grid.append(b);
      }
      const p = document.createElement('p');
      p.textContent = 'Subí de nivel jugando rondas para desbloquear más colores.';
      body.append(grid, p);
    },

    ach(body, save) {
      const got = Object.keys(save.ach).length;
      const p = document.createElement('p');
      p.textContent = `Desbloqueaste ${got} de ${ACHIEVEMENTS.length}.`;
      const ul = document.createElement('ul');
      ul.className = 'ach-list';
      for (const a of ACHIEVEMENTS) {
        const on = !!save.ach[a.id];
        const li = document.createElement('li');
        if (on) li.className = 'on';
        li.innerHTML = `<span class="ic">${on ? ICON.check : ICON.lock}</span><div><b></b><span></span></div>`;
        li.querySelector('b').textContent = a.name;
        li.querySelector('div span').textContent = a.desc;
        ul.append(li);
      }
      body.append(p, ul);
    },

    records(body, save) {
      if (!save.records.length) {
        body.innerHTML = '<p class="empty">Todavía no hay récords. Jugá una ronda y aparecen acá.</p>';
        return;
      }
      const rows = save.records.map((r, i) => `<tr><td>${i + 1}</td><td class="r">${fmt(r.score)}</td><td class="r">#${fmt(r.rank)}</td><td class="r">${pctText(r.pct)}</td></tr>`).join('');
      body.innerHTML = `<table class="rec-table"><thead><tr><th>#</th><th class="r">Puntos</th><th class="r">Puesto</th><th class="r">Superaste</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Tus 5 mejores rondas en este dispositivo.</p>`;
    },

    settings(body, save) {
      const rows = [
        ['sfx', 'Sonido', 'Efectos del juego'],
        ['music', 'Música', 'Se intensifica con la tensión de la ronda'],
        ['vib', 'Vibración', 'En celulares compatibles'],
      ];
      for (const [key, name, desc] of rows) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'switch-row';
        b.setAttribute('role', 'switch');
        b.setAttribute('aria-checked', String(!!save[key]));
        b.innerHTML = '<span><b></b><small></small></span><i class="switch" aria-hidden="true"></i>';
        b.querySelector('b').textContent = name;
        b.querySelector('small').textContent = desc;
        b.addEventListener('click', () => {
          h.onToggle(key);
          b.setAttribute('aria-checked', String(!!h.getSave()[key]));
        });
        body.append(b);
      }
      const zone = document.createElement('div');
      zone.className = 'danger-zone';
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn btn-danger';
      reset.textContent = 'Borrar mi progreso';
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = 'Tocá de nuevo para confirmar';
          setTimeout(() => { armed = false; reset.textContent = 'Borrar mi progreso'; }, 3500);
          return;
        }
        h.onReset();
        closeModal();
      });
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'Tu progreso se guarda solo en este dispositivo.';
      zone.append(reset, note);
      body.append(zone);
    },

    profile(body, save) {
      const li = levelInfo(save.xp);
      const head = document.createElement('div');
      head.className = 'profile-head';
      head.innerHTML = `<span class="ring" aria-hidden="true"><svg viewBox="0 0 40 40"><circle class="ring-bg" cx="20" cy="20" r="17"/><circle class="ring-fg" cx="20" cy="20" r="17" style="stroke-dashoffset:${RING * (1 - li.into / li.need)}"/></svg><b>${li.level}</b></span><div><strong></strong><small></small><div class="xpbar"><span style="width:${li.into / li.need * 100}%"></span></div></div>`;
      head.querySelector('strong').textContent = titleOf(li.level);
      head.querySelector('small').textContent = `Nivel ${li.level} · ${fmt(li.into)} / ${fmt(li.need)} XP`;
      const stats = document.createElement('div');
      stats.className = 'pstats';
      const cells = [
        [fmt(save.rounds), 'Rondas'], [save.rounds ? pctText(save.best) : '—', 'Mejor resultado'],
        [fmt(save.outliers), 'Veces Outlier'], [`${fmt(streakNow(save))} ${streakNow(save) === 1 ? 'día' : 'días'}`, 'Racha'],
      ];
      stats.innerHTML = cells.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
      const h3 = document.createElement('h3');
      h3.textContent = 'Títulos';
      const ul = document.createElement('ul');
      ul.className = 'ladder';
      for (const t of TITLES) {
        const item = document.createElement('li');
        if (li.level >= t.lvl) item.className = 'on';
        item.innerHTML = '<b></b><span></span>';
        item.querySelector('b').textContent = t.name;
        item.querySelector('span').textContent = `Nivel ${t.lvl}`;
        ul.append(item);
      }
      body.append(head, stats, h3, ul);
    },

    share(body, save, data) {
      const img = document.createElement('img');
      img.className = 'share-img';
      img.alt = 'Tarjeta con tu resultado';
      img.src = data.image;
      const txt = document.createElement('p');
      txt.className = 'share-text';
      txt.textContent = data.text;
      const row = document.createElement('div');
      row.className = 'row';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'btn btn-primary';
      copy.textContent = 'Copiar texto';
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
      const dl = document.createElement('a');
      dl.className = 'btn btn-ghost';
      dl.href = data.image;
      dl.download = 'contracorriente-resultado.png';
      dl.textContent = 'Descargar';
      // Dentro de un visor embebido las descargas están bloqueadas: ahí solo queda copiar o mantener presionada la imagen
      const embedded = window.self !== window.top;
      if (embedded) row.style.gridTemplateColumns = '1fr';
      row.append(copy);
      if (!embedded) row.append(dl);
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = 'En el celular, mantené presionada la imagen para guardarla.';
      body.append(img, txt, row, note);
    },
  };

  // ---------- Conexiones ----------
  $('play').addEventListener('click', h.onPlay);
  $('again').addEventListener('click', h.onPlay);
  $('home').addEventListener('click', h.onHome);
  $('skip').addEventListener('click', h.onSkip);
  $('shareBtn').addEventListener('click', h.onShare);
  $('settingsBtn').addEventListener('click', () => openModal('settings'));
  $('profileBtn').addEventListener('click', () => openModal('profile'));
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
    banner, hideBanner, hint, hideHint, flash, toast, hud, showHud, showSpectator, hideSpectator,
    renderMenu, showScreen, renderResults, setNext, openModal, closeModal,
    get modalOpen() { return !$('modal').hidden; },
  };
}
