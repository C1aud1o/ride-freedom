// Sincronizzazione offline-first (E4). Si carica solo dopo il login (vedi account/ui.js).
// Il localStorage resta la fonte per l'interfaccia; il cloud è una copia. Merge per id, mai si toglie un dato locale
// se non c'è una lapide esplicita. Niente listener in tempo reale: pull incrementale a cursore + coda locale.
import {
  PREF_KEYS, HR_KEYS, GAME_KEY_RE, rideToDoc, mergeRides, rideNeedsUpload, docToRide, workoutToDoc, mergeWorkouts, mergePrefs, mergeGames, hash,
} from './sync-core.js';

const KEYS = { uid: 'sync:uid', queue: 'sync:queue', stamps: 'sync:stamps', tomb: 'sync:tomb:workouts', vals: 'sync:vals', last: 'sync:last', bad: 'sync:bad', force: 'sync:force' };
const cursorKey = (c) => `sync:cursor:${c}`;
const jget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const emit = () => { try { window.dispatchEvent(new CustomEvent('account:sync', { detail: getStatus() })); } catch { /* niente finestra */ } };

let epoch = 0; let runEpoch = 0; // stopSync() cambia epoch: un ciclo ancora in corso smette di scrivere nel localStorage
const guard = () => { if (runEpoch !== epoch) throw new Error('stopped'); };
let status = 'idle'; // idle | syncing | synced | pending | error
let lastError = null; let lastAt = 0; let running = false; let again = false; let ctx = null; let timer = null;
export const getStatus = () => ({ status, pending: loadQueue().length, error: lastError, at: lastAt, bad: jget(KEYS.bad, 0) });

// ---------- coda ----------
const loadQueue = () => jget(KEYS.queue, []);
function enqueue(items) {
  const q = loadQueue();
  for (const it of items) {
    const i = q.findIndex((x) => x.col === it.col && x.id === it.id);
    if (i >= 0) q[i] = { ...q[i], ...it }; else q.push(it);
  }
  jset(KEYS.queue, q);
}
// Chiamata dall'app quando cambia un dato (uscita salvata, allenamento salvato/eliminato). Senza account sincronizzato non fa nulla.
export function dataChanged(col, id, opts = {}) {
  if (!localStorage.getItem(KEYS.uid)) return;
  id = String(id);
  if (col === 'workouts' && opts.deleted) { const t = jget(KEYS.tomb, []); if (!t.includes(id)) jset(KEYS.tomb, [...t, id]); }
  enqueue([{ col, id, src: opts.src || 'app' }]);
  schedule();
}
function schedule(ms = 3000) {
  if (!ctx) { if (status !== 'syncing') { status = 'pending'; emit(); } return; }
  status = running ? status : 'pending'; emit();
  clearTimeout(timer); timer = setTimeout(() => syncNow(), ms);
}

// ---------- accesso ai dati locali ----------
const readRides = () => jget('rideHistory', []);
function writeRides(list) {
  for (let keep = list.length; keep >= 0; keep -= 20) {
    if (jset('rideHistory', list.map((x, i) => (i < list.length - keep ? { ...x, series: undefined } : x)))) return;
  }
}
const readWorkouts = () => jget('customWorkouts', []);
const ts = (t) => (t && typeof t.seconds === 'number' ? `${t.seconds}:${t.nanoseconds || 0}` : null);

async function pullCollection(name, onDocs) {
  const { fs, dbI } = ctx.sdk; const col = fs.collection(dbI, `users/${ctx.uid}/${name}`);
  const first = localStorage.getItem(cursorKey(name)) == null;
  const all = [];
  for (;;) {
    const cur = localStorage.getItem(cursorKey(name));
    const parts = [fs.orderBy('updatedAt'), fs.limit(100)];
    if (cur) { const [s, n] = cur.split(':').map(Number); parts.unshift(fs.where('updatedAt', '>', new fs.Timestamp(s, n))); }
    const snap = await fs.getDocs(fs.query(col, ...parts)); guard();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (docs.length) { onDocs(docs, first); all.push(...docs); const c = ts(docs[docs.length - 1].updatedAt); if (c) localStorage.setItem(cursorKey(name), c); }
    if (docs.length < 100) break;
  }
  guard();
  if (first && !all.length) localStorage.setItem(cursorKey(name), '0:0');
  return { first, all };
}

// ---------- uscite ----------
async function syncRides() {
  let remoteMap = new Map();
  const { first, all } = await pullCollection('rides', (docs) => {
    docs.forEach((d) => remoteMap.set(d.id, d.deleted ? null : docToRide(d)));
    const { list, changed } = mergeRides(readRides(), docs);
    if (changed) writeRides(list);
  });
  if (first) { // primo accesso su questo dispositivo: ciò che c'è solo qui (o è più completo) si carica
    const items = readRides().filter((r) => remoteMap.get(String(r.t)) !== null && rideNeedsUpload(r, remoteMap.get(String(r.t)), { hrOk: ctx.hrOk }))
      .map((r) => ({ col: 'rides', id: String(r.t), src: remoteMap.has(String(r.t)) ? 'app' : 'import' }));
    enqueue(items);
  }
  return all.length;
}
// ---------- allenamenti ----------
async function syncWorkouts() {
  const { first } = await pullCollection('workouts', (docs) => {
    const pending = new Set(loadQueue().filter((x) => x.col === 'workouts').map((x) => x.id));
    const { list, changed } = mergeWorkouts(readWorkouts(), docs, pending);
    if (changed) jset('customWorkouts', list);
    if (docs.some((d) => d.deleted)) { const t = new Set(jget(KEYS.tomb, [])); docs.filter((d) => d.deleted).forEach((d) => t.delete(d.id)); jset(KEYS.tomb, [...t]); }
    firstWk.ids.push(...docs.filter((d) => !d.deleted).map((d) => d.id));
  });
  if (first) enqueue(readWorkouts().filter((w) => !firstWk.ids.includes(w.id)).map((w) => ({ col: 'workouts', id: w.id })));
}
const firstWk = { ids: [] };

// ---------- impostazioni ----------
const localVals = (keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)]).filter(([, v]) => v != null));
const gameVals = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (GAME_KEY_RE.test(k)) o[k] = localStorage.getItem(k); } return o; };
const applyLocal = (obj) => { for (const [k, v] of Object.entries(obj)) { try { localStorage.setItem(k, v); } catch { /* pieno */ } } };

async function syncSettings() {
  const { fs, dbI } = ctx.sdk; const base = `users/${ctx.uid}/settings`;
  // 1. timbri: una chiave cambiata da questo dispositivo dopo l'ultima sincronizzazione vale "adesso"
  const stamps = jget(KEYS.stamps, {}); const vals = jget(KEYS.vals, {}); const last = jget(KEYS.last, {});
  const dirty = new Set(); const now = Date.now();
  for (const k of [...PREF_KEYS, ...HR_KEYS]) {
    const cur = localStorage.getItem(k);
    if (k in vals && vals[k] !== cur && cur != null) { stamps[k] = now; dirty.add(HR_KEYS.includes(k) ? 'hr' : 'prefs'); }
  }
  const games = gameVals(); if (hash(JSON.stringify(games)) !== last.games) dirty.add('games');
  // 2. cosa è cambiato in remoto
  const remote = {};
  const cur = localStorage.getItem(cursorKey('settings'));
  const parts = [fs.orderBy('updatedAt'), fs.limit(10)];
  if (cur) { const [s, n] = cur.split(':').map(Number); parts.unshift(fs.where('updatedAt', '>', new fs.Timestamp(s, n))); }
  const snap = await fs.getDocs(fs.query(fs.collection(dbI, base), ...parts)); guard();
  snap.docs.forEach((d) => { remote[d.id] = d.data(); });
  const c = snap.docs.length ? ts(snap.docs[snap.docs.length - 1].data().updatedAt) : null;
  if (c) localStorage.setItem(cursorKey('settings'), c); else if (!cur) localStorage.setItem(cursorKey('settings'), '0:0');
  for (const id of Object.keys(remote)) dirty.add(id);
  if (!cur) ['prefs', 'games', 'hr'].forEach((id) => dirty.add(id)); // primo accesso: si carica anche ciò che c'è solo qui
  for (const id of jget(KEYS.force, [])) dirty.add(id);
  jset(KEYS.force, []);
  if (!ctx.hrOk) dirty.delete('hr');

  for (const id of dirty) {
    if (!(id in remote)) { const g = await fs.getDoc(fs.doc(dbI, `${base}/${id}`)); guard(); remote[id] = g.exists() ? g.data() : null; }
    const rd = remote[id]; const stamp = { updatedAt: fs.serverTimestamp() };
    if (id === 'games') {
      const m = mergeGames(games, rd?.values);
      applyLocal(m.apply);
      if (m.upload) await fs.setDoc(fs.doc(dbI, `${base}/games`), { values: m.values, ...stamp }, { merge: true });
    } else {
      const keys = id === 'hr' ? HR_KEYS : PREF_KEYS;
      const m = mergePrefs(localVals(keys), stamps, rd, keys);
      applyLocal(m.apply); Object.assign(stamps, Object.fromEntries(Object.keys(m.apply).map((k) => [k, m.stamps[k]])));
      if (m.upload) { Object.assign(stamps, m.stamps); await fs.setDoc(fs.doc(dbI, `${base}/${id}`), { values: m.values, stamps: m.stamps, ...stamp }, { merge: true }); }
    }
  }
  // 3. nuovo punto di riferimento
  const newVals = {}; for (const k of [...PREF_KEYS, ...HR_KEYS]) { const v = localStorage.getItem(k); if (v != null) newVals[k] = v; }
  jset(KEYS.vals, newVals); jset(KEYS.stamps, stamps);
  jset(KEYS.last, { games: hash(JSON.stringify(gameVals())) });
}

// ---------- invio ----------
const PERMANENT = new Set(['permission-denied', 'invalid-argument', 'failed-precondition', 'out-of-range']);
async function pushOne(it) {
  const { fs, dbI } = ctx.sdk;
  if (it.col === 'rides') {
    const r = readRides().find((x) => String(x.t) === it.id);
    if (!r) return 'drop';
    const d = rideToDoc(r, { hrOk: ctx.hrOk, src: it.src === 'import' ? 'import' : 'app' });
    if (!d) return 'bad';
    await fs.setDoc(fs.doc(dbI, `users/${ctx.uid}/rides/${it.id}`), { ...d, updatedAt: fs.serverTimestamp() });
    return 'ok';
  }
  if (it.col === 'workouts') {
    const w = readWorkouts().find((x) => x.id === it.id);
    if (!w) {
      if (!jget(KEYS.tomb, []).includes(it.id)) return 'drop';
      await fs.setDoc(fs.doc(dbI, `users/${ctx.uid}/workouts/${it.id}`), { name: '—', steps: [], deleted: true, updatedAt: fs.serverTimestamp() });
      return 'ok';
    }
    const d = workoutToDoc(w); if (!d) return 'bad';
    await fs.setDoc(fs.doc(dbI, `users/${ctx.uid}/workouts/${it.id}`), { ...d, updatedAt: fs.serverTimestamp() });
    return 'ok';
  }
  return 'drop';
}
async function push() {
  const q = loadQueue(); const keep = []; let bad = jget(KEYS.bad, 0); let failure = null;
  for (let i = 0; i < q.length; i += 10) {
    const chunk = q.slice(i, i + 10);
    const res = await Promise.allSettled(chunk.map(pushOne)); guard();
    res.forEach((r, j) => {
      if (r.status === 'fulfilled') { if (r.value === 'bad') bad++; return; }
      if (PERMANENT.has(r.reason?.code?.replace('firestore/', ''))) { bad++; return; }
      keep.push(chunk[j]); failure = r.reason;
    });
  }
  jset(KEYS.queue, [...keep, ...loadQueue().filter((x) => !q.some((y) => y.col === x.col && y.id === x.id))]);
  jset(KEYS.bad, bad);
  if (failure) throw failure;
}

// ---------- ciclo ----------
export async function syncNow() {
  if (!ctx) return;
  if (running) { again = true; return; }
  running = true; runEpoch = epoch; status = 'syncing'; emit(); clearTimeout(timer);
  try {
    firstWk.ids = [];
    await syncRides(); await syncWorkouts(); await syncSettings(); await push();
    lastError = null; lastAt = Date.now(); status = loadQueue().length ? 'pending' : 'synced';
  } catch (e) {
    if (runEpoch === epoch) { lastError = e?.code || e?.message || 'error'; status = 'error'; }
  } finally {
    running = false; if (runEpoch === epoch) emit();
    if (again && ctx) { again = false; schedule(500); }
  }
}
const onOnline = () => { if (ctx) syncNow(); };
const onVisible = () => { if (ctx && document.visibilityState === 'visible' && Date.now() - lastAt > 60_000) syncNow(); };

// Avvia la sincronizzazione per questo utente. `hrOk` = consenso al battito nel cloud (si può aggiornare con setHrOk).
export function startSync({ sdk, uid, hrOk }) {
  ctx = { sdk, uid, hrOk: !!hrOk };
  localStorage.setItem(KEYS.uid, uid);
  window.addEventListener('online', onOnline); document.addEventListener('visibilitychange', onVisible);
  return syncNow();
}
export function setHrOk(v) {
  if (!ctx) return;
  const was = ctx.hrOk; ctx.hrOk = !!v;
  if (v && !was) { // consenso appena dato: il battito già presente nelle uscite locali e la frequenza massima salgono nel cloud
    enqueue(readRides().filter((r) => r.avgHr != null || r.maxHr != null).map((r) => ({ col: 'rides', id: String(r.t), src: 'import' })));
    jset(KEYS.force, [...new Set([...jget(KEYS.force, []), 'hr'])]);
    schedule(500);
  }
}
export function stopSync() {
  epoch++; again = false; ctx = null; clearTimeout(timer); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible);
  status = 'idle'; emit();
}
// L'account è stato eliminato o ceduto: via i riferimenti di sincronizzazione (i dati locali restano)
export function resetSyncState() {
  const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('sync:')) keys.push(k); }
  keys.forEach((k) => localStorage.removeItem(k)); // prima si raccolgono, poi si tolgono: l'ordine delle chiavi cambia mentre si cancella
}
export const syncedUid = () => localStorage.getItem(KEYS.uid);
// Dopo aver revocato il consenso al battito: se serve ricaricare le uscite con il battito, lo decide il server (cancella); in locale non si tocca nulla.
