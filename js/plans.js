// Piani di allenamento: logica pura (nessun DOM, nessuna traduzione). I testi stanno in locales/*.json sotto "plans.*".
// Un piano è un elenco di uscite; ogni uscita è un allenamento della libreria (js/workouts.js) in un giorno preciso
// contato dal giorno di partenza scelto. Tutto resta nel localStorage ("plan"), senza account.
// Principi e fonti: docs/piani.md.

export const RECOVER_DAYS = 2; // un'uscita saltata si può recuperare entro 2 giorni
export const DAY_MS = 864e5;

// settimana = elenco di [idAllenamento, giornoDellaSettimana (0 = giorno di partenza)]
const wk = (...items) => items.map(([id, d]) => ({ wk: id, d }));
const W3 = [0, 2, 4]; const W4 = [0, 2, 3, 5];
const row = (offs, ...ids) => wk(...ids.map((id, i) => [id, offs[i]]));

// "deload" = settimane di scarico (meno carico per assorbire gli allenamenti); "tests" = settimane con il test a rampa
export const PLANS = [
  { // 3 settimane, 3 uscite da 30-40 minuti, test FTP il 2° giorno e alla fine
    id: 'primipassi', deload: [], perWeek: 3,
    weeks: [row(W3, 'facile', 'ramp', 'facile'), row(W3, 'costante', 'facile', 'sblocco'), row(W3, 'costante', 'sblocco', 'ramp')],
  },
  { // 6 settimane: 3 di carico, scarico, picco, scarico + test finale
    id: 'piuftp', deload: [4, 6], perWeek: 4,
    weeks: [
      row(W3, 'ramp', 'fondo', 'sweet'),
      row(W4, 'sweet', 'facile', 'tempo', 'fondo'),
      row(W4, 'soglia', 'facile', 'sweet', 'fondo'),
      row(W3, 'fondo', 'sblocco', 'facile'),
      row(W4, 'soglia', 'facile', 'piramide', 'fondo'),
      row(W3, 'facile', 'sblocco', 'ramp'),
    ],
  },
  { // 8 settimane: zona 2 lunga che cresce + 1 lavoro a settimana, scarico alle settimane 4 e 8
    id: 'fondoinv', deload: [4, 8], perWeek: 3,
    weeks: [
      row([0, 2, 5], 'ramp', 'facile', 'lungo60'),
      row([0, 2, 5], 'sweet', 'facile', 'lungo60'),
      row([0, 2, 5], 'tempo', 'facile', 'lungo75'),
      row([0, 2, 5], 'facile', 'fondo', 'lungo60'),
      row([0, 2, 5], 'sweet', 'facile', 'lungo75'),
      row([0, 2, 5], 'tempo', 'facile', 'lungo90'),
      row([0, 2, 5], 'sweet', 'facile', 'lungo90'),
      row([0, 2, 5], 'facile', 'lungo60', 'ramp'),
    ],
  },
  { // 4 settimane: riprendere dopo una pausa, senza fretta
    id: 'ritorno', deload: [4], perWeek: 3,
    weeks: [row(W3, 'facile', 'facile', 'costante'), row(W3, 'costante', 'sblocco', 'fondo'), row(W3, 'costante', 'sweet', 'lungo60'), row(W3, 'facile', 'sblocco', 'ramp')],
  },
];

export const planById = (id) => PLANS.find((p) => p.id === id) || null;
export const totalSessions = (p) => p.weeks.reduce((a, w) => a + w.length, 0);

// ---------- giorni (numero di giorni locali: nessun problema con l'ora legale) ----------
export const dayNum = (d = new Date()) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
export const dayDate = (n) => { const u = new Date(n * DAY_MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
export const dayFromInput = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS) : null; };
export const inputFromDay = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

// ---------- stato ----------
// { id, start, done: { "w.i": giorno }, skipped: { "w.i": 1 }, moved: { "w.i": giorno } }
export function startPlan(id, start) {
  if (!planById(id) || !Number.isFinite(start)) return null;
  return { v: 1, id, start, done: {}, skipped: {}, moved: {} };
}

// uscite con il giorno effettivo (spostato o originale)
export function sessionsOf(state) {
  const p = state && planById(state.id); if (!p) return [];
  const out = [];
  p.weeks.forEach((week, w) => week.forEach((x, i) => {
    const key = `${w}.${i}`; const orig = state.start + w * 7 + x.d;
    out.push({ key, w, i, wk: x.wk, orig, day: state.moved?.[key] ?? orig });
  }));
  return out.sort((a, b) => a.day - b.day || a.w - b.w || a.i - b.i);
}

// 'done' | 'skipped' | 'today' | 'late' (da recuperare) | 'missed' | 'future'
export function statusOf(s, state, today) {
  if (state.done?.[s.key] != null) return 'done';
  if (state.skipped?.[s.key]) return 'skipped';
  if (s.day > today) return 'future';
  if (s.day === today) return 'today';
  return today - s.day <= RECOVER_DAYS ? 'late' : 'missed';
}
export const withStatus = (state, today) => sessionsOf(state).map((s) => ({ ...s, status: statusOf(s, state, today) }));

// uscite da fare adesso: prima quelle di oggi, poi quelle da recuperare (la più vecchia per prima)
export function due(state, today) {
  const l = withStatus(state, today).filter((s) => s.status === 'today' || s.status === 'late');
  return [...l.filter((s) => s.status === 'today'), ...l.filter((s) => s.status === 'late')];
}
export const nextSession = (state, today) => withStatus(state, today).find((s) => s.status === 'future') || null;

// avanzamento: uscite fatte, settimana del piano in corso, uscite della settimana
export function progress(state, today) {
  const p = planById(state?.id); if (!p) return null;
  const all = withStatus(state, today);
  const done = all.filter((s) => s.status === 'done').length;
  const week = Math.min(p.weeks.length, Math.max(1, Math.floor((today - state.start) / 7) + 1));
  const inWeek = all.filter((s) => s.w === week - 1);
  const finished = all.every((s) => s.status === 'done' || s.status === 'skipped' || s.status === 'missed');
  return {
    total: all.length, done, week, weeks: p.weeks.length, started: today >= state.start,
    weekDone: inWeek.filter((s) => s.status === 'done').length, weekTotal: inWeek.length, inWeek, finished,
    deload: p.deload.includes(week),
  };
}

// fine di un allenamento: se era quello in programma (oggi o da recuperare) lo segna fatto. Restituisce { state, session } o null.
export function complete(state, workoutId, today) {
  if (!state) return null;
  const s = due(state, today).find((x) => x.wk === workoutId);
  if (!s) return null;
  return { state: { ...state, done: { ...state.done, [s.key]: today } }, session: s };
}
export function skip(state, key) { return state.skipped?.[key] ? state : { ...state, skipped: { ...state.skipped, [key]: 1 } }; }
// sposta a un giorno non passato; se era saltata torna da fare
export function move(state, key, toDay, today) {
  if (!Number.isFinite(toDay) || toDay < today || state.done?.[key] != null) return state;
  const skipped = { ...state.skipped }; delete skipped[key];
  return { ...state, skipped, moved: { ...state.moved, [key]: toDay } };
}

// ---------- promemoria ----------
export const REMIND_BASE_ID = 7000; // id delle notifiche locali del piano (7000..7059)
export const REMIND_MAX = 60;
// notifiche da programmare: una per uscita non fatta né saltata, dal giorno di oggi in poi, all'ora "HH:MM"
export function reminders(state, time, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || ''); if (!state || !m) return [];
  const today = dayNum(now); const out = [];
  for (const s of withStatus(state, today)) {
    if (s.status === 'done' || s.status === 'skipped' || s.day < today) continue;
    const d = dayDate(s.day); d.setHours(+m[1], +m[2], 0, 0);
    if (d.getTime() <= now.getTime()) continue;
    out.push({ id: REMIND_BASE_ID + out.length, at: d, key: s.key, wk: s.wk });
    if (out.length >= REMIND_MAX) break;
  }
  return out;
}

// ---------- salvataggio locale ----------
const KEY = 'plan';
export function loadPlan() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && planById(s.id) && Number.isFinite(s.start) ? s : null; } catch { return null; }
}
export function savePlan(state) {
  try { if (state) localStorage.setItem(KEY, JSON.stringify(state)); else localStorage.removeItem(KEY); } catch { /* pieno */ }
}
