// Classifiche dei giochi (E5). Si carica solo con gli account disponibili (vedi account/index.js).
// Invio: Cloud Function submitScore (l'unica via per scrivere). Lettura: poche query, con cache di 5 minuti.
// Costo di una vista: 20 righe + 1 la mia riga + 1 conteggio per la posizione = al massimo ~22 letture (docs/account-architettura.md §8).
import { t, fmtNum } from '../i18n.js';
import { loadSdk } from './sdk.js';

export const BOARD_GAMES = [
  ['horde', 'games.horde.name'], ['shooter', 'games.shooter.title'], ['gruppetto', 'games.gruppetto.name'],
  ['mattoni', 'games.mattoni.name'], ['planata', 'games.planata.name'], ['racer', 'games.racer.name'],
];
const TTL = 5 * 60_000; // cache locale della classifica
const PENDING = 'board:pending';
const LIMIT = 20;
const RETRY = new Set(['functions/unavailable', 'functions/internal', 'functions/deadline-exceeded', 'functions/resource-exhausted', 'network']);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jget = (s, k, d) => { try { const v = s.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const jset = (s, k, v) => { try { s.setItem(k, JSON.stringify(v)); } catch { /* pieno o bloccato */ } };

// stessa settimana ISO in UTC del server (functions/src/validate.ts)
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  return `${year}-W${String(Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}
export const boardId = (game, stage) => (game === 'racer' ? `racer-s${stage || 0}` : game);

async function ready() {
  const sdk = await loadSdk();
  await sdk.authI.authStateReady?.();
  return sdk;
}

// ---------- invio ----------
const newRunId = () => (globalThis.crypto?.randomUUID?.().replace(/-/g, '') || `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).slice(0, 32);

async function send(sdk, item) {
  const { tries, ...payload } = item; // eslint-disable-line no-unused-vars
  await sdk.fn.httpsCallable(sdk.functions, 'submitScore')(payload);
}

const flagOf = (e) => e?.code || 'network';

// Chiamata a fine partita. Se la rete manca il punteggio resta in coda (al massimo 10) e riparte al prossimo invio o all'apertura del menu.
export async function submitScore(payload) {
  const q = jget(localStorage, PENDING, []);
  q.push({ ...payload, runId: newRunId(), tries: 0 });
  jset(localStorage, PENDING, q.slice(-10));
  await flush();
}

export async function flush() {
  let q = jget(localStorage, PENDING, []);
  if (!q.length) return;
  let sdk;
  try { sdk = await ready(); } catch { return; }
  if (!sdk.authI.currentUser) return;
  const keep = [];
  for (const item of q) {
    try { await send(sdk, item); sessionClear(); } catch (e) {
      if (RETRY.has(flagOf(e)) && (item.tries || 0) < 3) keep.push({ ...item, tries: (item.tries || 0) + 1 });
      // altri errori (punteggio non valido, account bloccato…): si scarta, ripetere non servirebbe
    }
  }
  q = jget(localStorage, PENDING, []).filter((x) => !q.some((o) => o.runId === x.runId)); // arrivati nel frattempo
  jset(localStorage, PENDING, [...keep, ...q]);
}

function sessionClear() { try { for (const k of Object.keys(sessionStorage)) if (k.startsWith('board:')) sessionStorage.removeItem(k); } catch { /* */ } }

// ---------- lettura ----------
async function myCountry(sdk, uid) {
  const c = jget(sessionStorage, 'board:country', undefined);
  if (c !== undefined) return c;
  const { fs, dbI } = sdk;
  const snap = await fs.getDoc(fs.doc(dbI, `users/${uid}`));
  const country = snap.exists() ? snap.get('country') || null : null;
  jset(sessionStorage, 'board:country', country);
  return country;
}

// { rows: [{uid, name, score, country}], me: {score, sortKey, pos} | null }
export async function fetchBoard({ game, stage, tab }, force = false) {
  const sdk = await ready();
  const user = sdk.authI.currentUser;
  if (!user) throw new Error('no-user');
  const { fs, dbI } = sdk;
  const country = tab === 'country' ? await myCountry(sdk, user.uid) : null;
  if (tab === 'country' && !country) return { noCountry: true, rows: [], me: null };
  const period = tab === 'week' ? isoWeek(new Date()) : 'all';
  const id = boardId(game, stage);
  const ck = `board:${id}:${period}:${country || ''}`;
  const hit = jget(sessionStorage, ck, null);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data;

  const col = fs.collection(dbI, `boards/${id}/periods/${period}/entries`);
  const where = country ? [fs.where('country', '==', country)] : [];
  const top = await fs.getDocs(fs.query(col, ...where, fs.orderBy('sortKey', 'desc'), fs.limit(LIMIT)));
  const rows = top.docs.map((d) => d.data());
  let me = null;
  const mine = rows.findIndex((r) => r.uid === user.uid);
  if (mine >= 0) me = { ...rows[mine], pos: mine + 1 };
  else {
    const snap = await fs.getDoc(fs.doc(col, user.uid));
    // nella classifica del Paese conta solo se la mia riga è di quel Paese
    if (snap.exists() && (!country || snap.get('country') === country)) {
      const d = snap.data();
      const ahead = await fs.getCount(fs.query(col, ...where, fs.where('sortKey', '>', d.sortKey)));
      me = { ...d, pos: ahead.data().count + 1 };
    }
  }
  const data = { rows, me, noCountry: false };
  jset(sessionStorage, ck, { at: Date.now(), data });
  return data;
}

// ---------- interfaccia ----------
const ui = { game: 'horde', stage: 0, tab: 'week', open: false };

export const fmtScore = (game, s) => {
  if (game !== 'racer') return fmtNum(Math.round(s));
  const m = Math.floor(s / 60); const sec = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
};

export function render(el, { stages = [], signedIn = false } = {}) {
  if (!signedIn) { // invito discreto: nessuna rete, nessun SDK
    el.innerHTML = `<p class="fine bd-invite">${t('boards.invite')} <button class="link" data-act="login">${t('boards.inviteBtn')}</button></p>`;
    el.querySelector('[data-act=login]').addEventListener('click', () => window.dispatchEvent(new CustomEvent('account:open')));
    return;
  }
  flush().catch(() => {});
  el.innerHTML = `<details class="bd"${ui.open ? ' open' : ''}><summary>🏆 ${t('boards.title')}</summary><div class="bd-body"></div></details>`;
  const det = el.querySelector('details'); const body = el.querySelector('.bd-body');
  const draw = async (force = false) => {
    const chip = (attr, val, label, on) => `<button class="${on ? 'on' : ''}" data-${attr}="${val}">${label}</button>`;
    body.innerHTML = `
      <div class="chips bd-games">${BOARD_GAMES.map(([g, k]) => chip('g', g, t(k), g === ui.game)).join('')}</div>
      ${ui.game === 'racer' ? `<div class="chips bd-stages">${stages.map((k, i) => chip('s', i, t(k), i === ui.stage)).join('')}</div>` : ''}
      <div class="chips bd-tabs">${[['week', 'boards.week'], ['all', 'boards.all'], ['country', 'boards.country']].map(([v, k]) => chip('tab', v, t(k), v === ui.tab)).join('')}</div>
      <div class="bd-list" aria-live="polite"><p class="fine">${t('boards.loading')}</p></div>`;
    const list = body.querySelector('.bd-list');
    try {
      const d = await fetchBoard(ui, force);
      if (d.noCountry) { list.innerHTML = `<p class="fine">${t('boards.noCountry')}</p>`; return; }
      if (!d.rows.length) { list.innerHTML = `<p class="fine">${t('boards.empty')}</p>`; return; }
      list.innerHTML = `<ol class="bd-rows">${d.rows.map((r, i) => `<li class="${d.me?.uid === r.uid ? 'me' : ''}"><span class="bd-rank">${i + 1}</span><span class="bd-name">${esc(r.name)}${r.country ? ` <small>${esc(r.country)}</small>` : ''}</span><b>${fmtScore(ui.game, r.score)}</b></li>`).join('')}</ol>
        <p class="bd-me">${d.me ? t('boards.you', { pos: fmtNum(d.me.pos), score: fmtScore(ui.game, d.me.score) }) : t('boards.notYet')}</p>
        <button class="link bd-refresh">${t('boards.refresh')}</button>`;
      list.querySelector('.bd-refresh').addEventListener('click', () => draw(true));
    } catch { list.innerHTML = `<p class="fine">${t('boards.error')} <button class="link bd-refresh">${t('boards.retry')}</button></p>`; list.querySelector('.bd-refresh').addEventListener('click', () => draw(true)); }
  };
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-g],button[data-s],button[data-tab]'); if (!b) return;
    if (b.dataset.g) ui.game = b.dataset.g; if (b.dataset.s != null) ui.stage = +b.dataset.s; if (b.dataset.tab) ui.tab = b.dataset.tab;
    draw();
  });
  det.addEventListener('toggle', () => { ui.open = det.open; if (det.open) draw(); });
  if (ui.open) draw();
}
