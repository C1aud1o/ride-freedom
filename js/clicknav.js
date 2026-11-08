// Navigazione con i soli tasti del Click (o + / − della tastiera), per quando in bici non arrivi allo schermo.
//   + e − insieme   → apre/chiude il menu Click
//   + / −           → elemento successivo / precedente
//   tieni premuto + → sceglie   ·   tieni premuto − → indietro
import { t } from './i18n.js';
const LONG = 650;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([type=hidden]):not([disabled]), summary, label.switch, label.file-btn';

export function createClickNav({ menuItems, back, onChange, isIdle = () => true }) {
  const menu = document.createElement('div'); menu.id = 'clickMenu'; menu.className = 'click-menu'; menu.hidden = true;
  menu.innerHTML = `<div class="cm-box"><p class="cm-title">${t('clicknav.title')}</p><div class="cm-list"></div></div>`;
  document.body.appendChild(menu);
  const bar = document.createElement('div'); bar.className = 'click-bar'; bar.hidden = true;
  bar.innerHTML = t('clicknav.bar');
  document.body.appendChild(bar);

  const nav = { active: false, idx: 0, items: [], timer: null, fired: false, dir: 0, idleT: null };

  const visible = (el) => !!(el.offsetParent || el.getClientRects().length) && !el.closest('[hidden]');
  function scope() {
    if (!menu.hidden) return menu;
    const sheets = [...document.querySelectorAll('.sheet')].filter((s) => !s.hidden);
    if (sheets.length) return sheets[sheets.length - 1];
    const dbg = document.getElementById('debugPanel'); if (dbg && !dbg.hidden) return dbg;
    const panel = document.getElementById('gamePanel');
    if (panel && !panel.hidden) return panel;
    return document.body;
  }
  function collect() {
    const sc = scope();
    nav.items = [...sc.querySelectorAll(FOCUSABLE)].filter((el) => visible(el) && !el.closest('.click-bar') && (sc === menu || !el.closest('#clickMenu')))
      // l'input dentro un interruttore o un pulsante-file si attiva dalla sua etichetta
      .filter((el) => !(el.tagName === 'INPUT' && el.closest('label.switch, label.file-btn')));
    if (nav.idx >= nav.items.length) nav.idx = 0;
  }
  function paint() {
    document.querySelectorAll('.cn-focus').forEach((e) => e.classList.remove('cn-focus'));
    const el = nav.items[nav.idx]; if (!el) return;
    el.classList.add('cn-focus'); el.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function refresh(keep = false) { const cur = nav.items[nav.idx]; collect(); if (keep && cur) { const i = nav.items.indexOf(cur); if (i >= 0) nav.idx = i; } paint(); }
  function poke() { clearTimeout(nav.idleT); nav.idleT = setTimeout(() => stop(), 30000); }

  function renderMenu() {
    const items = menuItems();
    menu.querySelector('.cm-list').innerHTML = items.map((it, i) => `<button type="button" data-i="${i}">${it.label}</button>`).join('');
    menu.querySelectorAll('.cm-list button').forEach((b) => b.addEventListener('click', () => {
      const it = items[+b.dataset.i]; menu.hidden = true;
      it.run(); setTimeout(() => { nav.idx = 0; if (nav.active) refresh(); }, 120);
    }));
  }
  function start(withMenu = true) {
    nav.active = true; bar.hidden = false; poke();
    nav.waitRelease = !isIdle(); // dopo + e − insieme si aspetta che vengano rilasciati
    if (withMenu) { renderMenu(); menu.hidden = false; }
    nav.idx = 0; refresh(); onChange?.(true);
  }
  function stop() {
    nav.active = false; menu.hidden = true; bar.hidden = true; clearTimeout(nav.timer); clearTimeout(nav.idleT);
    document.querySelectorAll('.cn-focus').forEach((e) => e.classList.remove('cn-focus')); onChange?.(false);
  }
  function activate() {
    const el = nav.items[nav.idx]; if (!el) return;
    if (el.tagName === 'INPUT' && /text|url|number|password|email/.test(el.type)) { el.focus(); return; }
    el.click();
    setTimeout(() => { if (nav.active) refresh(true); }, 150);
  }

  return {
    get active() { return nav.active; },
    toggle() { if (nav.active) stop(); else start(true); },
    start, stop,
    menuOpen: () => !menu.hidden,
    closeMenu() { menu.hidden = true; if (nav.active) refresh(); },
    // eventi "tasto tenuto" dal Click (dir = +1, −1, 0 = rilasciato)
    hold(d) {
      if (!nav.active) return false;
      poke();
      if (nav.waitRelease) { if (!d && isIdle()) nav.waitRelease = false; return true; }
      if (d) {
        nav.dir = d; nav.fired = false; clearTimeout(nav.timer);
        nav.timer = setTimeout(() => { nav.fired = true; if (d > 0) activate(); else { back(); setTimeout(() => nav.active && refresh(), 150); } }, LONG);
      } else if (nav.dir) {
        clearTimeout(nav.timer);
        if (!nav.fired) { collect(); if (nav.items.length) { nav.idx = (nav.idx + (nav.dir > 0 ? 1 : -1) + nav.items.length) % nav.items.length; paint(); } }
        nav.dir = 0;
      }
      return true;
    },
  };
}
