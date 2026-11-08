// Sincronizzazione: parte PURA (nessuna rete, nessun localStorage), testabile in Node.
// Regole di merge: docs/account-architettura.md sez. 4.4. Mai perdere dati locali.

export const MAX_RIDES = 200;
export const MAX_WORKOUTS = 30;
export const PREF_KEYS = ['ftp', 'mass', 'weekGoal', 'autoShift', 'autoCad', 'routeRealism', 'usePm', 'coachOn', 'musicOn',
  'audioMode', 'gameMuted', 'gameGlow', 'clickMap', 'videoRef', 'lang', 'units'];
export const HR_KEYS = ['hrMax'];
const GAMES_MAX_KEYS = 150;
const GAMES_MAX_BYTES = 600_000; // un documento Firestore arriva a 1 MiB: i fantasmi si fermano prima

// ---------- serie di potenza: Uint16 little-endian in base64 ----------
export function encodeSeries(arr) {
  const n = Math.min(arr.length, 720);
  const u = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) { const v = Math.max(0, Math.min(65535, Math.round(arr[i]) || 0)); u[2 * i] = v & 255; u[2 * i + 1] = v >> 8; }
  let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
export function decodeSeries(b64) {
  try {
    const s = atob(b64); const out = [];
    for (let i = 0; i + 1 < s.length; i += 2) out.push(s.charCodeAt(i) | (s.charCodeAt(i + 1) << 8));
    return out;
  } catch { return []; }
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const rnd = (v) => (Number.isFinite(v) ? Math.round(v) : NaN);

// ---------- uscite ----------
// Uscita locale → documento Firestore (null se le regole la rifiuterebbero). `hrOk` = consenso al battito nel cloud.
export function rideToDoc(r, { hrOk = false, src = 'app' } = {}) {
  if (!r || !Number.isInteger(r.t) || r.t < 1262304000000) return null;
  const dur = rnd(r.dur); const avgW = rnd(r.avgW); const kj = rnd(r.kj); const km = Number(r.km);
  if (!isInt(dur, 60, 86400) || !isInt(avgW, 0, 1500) || !isInt(kj, 0, 30000)) return null;
  if (!(km >= 0 && km <= 1500) || km * 3600 > dur * 80) return null;
  const d = { t: r.t, dur, km: +km.toFixed(3), avgW, kj, src };
  const np = rnd(r.np); if (isInt(np, 0, 1500)) d.np = np;
  const maxW = rnd(r.maxW); if (isInt(maxW, 0, 3000)) d.maxW = maxW;
  if (r.best && typeof r.best === 'object') {
    const lim = { 5: 3000, 60: 2500, 300: 1500, 1200: 1000 }; const b = {};
    for (const k of Object.keys(lim)) { const v = rnd(r.best[k]); if (isInt(v, 0, lim[k])) b[k] = v; }
    if (Object.keys(b).length) d.best = b;
  }
  if (Array.isArray(r.series) && r.series.length) { d.series = encodeSeries(r.series); d.seriesV = 1; }
  if (hrOk) {
    const avgHr = rnd(r.avgHr); const maxHr = rnd(r.maxHr); const hr = {};
    if (isInt(avgHr, 25, 240)) hr.avgHr = avgHr;
    if (isInt(maxHr, 25, 250)) hr.maxHr = maxHr;
    if (Object.keys(hr).length) d.hr = hr;
  }
  return d;
}
// Documento remoto → uscita locale
export function docToRide(d) {
  const r = { t: d.t, dur: d.dur, km: d.km, avgW: d.avgW, kj: d.kj };
  if (d.np != null) r.np = d.np;
  if (d.maxW != null) r.maxW = d.maxW;
  if (d.best) r.best = { ...d.best };
  if (typeof d.series === 'string') { const s = decodeSeries(d.series); if (s.length) r.series = s; }
  if (d.hr) { if (d.hr.avgHr != null) r.avgHr = d.hr.avgHr; if (d.hr.maxHr != null) r.maxHr = d.hr.maxHr; }
  return r;
}
const rideScore = (r) => (r.series?.length ? 4 : 0) + (r.best ? 1 : 0) + (r.np != null ? 1 : 0);
// Due versioni della stessa uscita: vince la più completa, i campi mancanti si prendono dall'altra
export function mergeRide(a, b) {
  const [base, other] = rideScore(b) > rideScore(a) ? [b, a] : [a, b];
  const out = { ...base };
  for (const k of ['np', 'maxW', 'best', 'series', 'avgHr', 'maxHr']) if (out[k] == null && other[k] != null) out[k] = other[k];
  return out;
}
// Locale + documenti remoti [{id, deleted?, ...campi}] → { list, changed }. Tiene le 200 più recenti, come l'app.
export function mergeRides(local, remoteDocs) {
  const map = new Map(local.map((r) => [String(r.t), r]));
  let changed = false;
  for (const d of remoteDocs) {
    const id = String(d.id ?? d.t);
    if (d.deleted === true) { if (map.delete(id)) changed = true; continue; }
    if (!Number.isInteger(d.t)) continue;
    const incoming = docToRide(d); const mine = map.get(id);
    if (!mine) { map.set(id, incoming); changed = true; continue; }
    const merged = mergeRide(mine, incoming);
    if (JSON.stringify(merged) !== JSON.stringify(mine)) { map.set(id, merged); changed = true; }
  }
  let list = [...map.values()].sort((a, b) => a.t - b.t);
  if (list.length > MAX_RIDES) { list = list.slice(-MAX_RIDES); changed = true; }
  return { list, changed };
}
// La versione locale ha qualcosa che il documento remoto non ha? Allora va (ri)caricata.
export function rideNeedsUpload(local, remote, { hrOk = false } = {}) {
  if (!remote) return true;
  if (local.series?.length && !remote.series?.length) return true;
  if (hrOk && (local.avgHr != null || local.maxHr != null) && remote.avgHr == null && remote.maxHr == null) return true;
  if (local.best && !remote.best) return true;
  return false;
}

// ---------- allenamenti ----------
export function workoutToDoc(w) {
  if (!w || typeof w.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(w.id) || !Array.isArray(w.steps) || w.steps.length > 400) return null;
  const d = { name: String(w.name || '').slice(0, 80) || '—', steps: w.steps };
  if (w.tag != null) d.tag = String(w.tag).slice(0, 60);
  if (w.desc != null) d.desc = String(w.desc).slice(0, 600);
  if (Array.isArray(w.blocks) && w.blocks.length <= 200) d.blocks = w.blocks;
  d.custom = true;
  return JSON.parse(JSON.stringify(d)); // niente undefined (Firestore li rifiuta)
}
export const docToWorkout = (id, d) => {
  const w = { id, name: d.name, tag: d.tag ?? '', desc: d.desc ?? '', steps: d.steps, custom: true };
  if (d.blocks) w.blocks = d.blocks;
  return w;
};
// `pending` = id con modifiche locali non ancora inviate: vincono sul remoto.
export function mergeWorkouts(local, remoteDocs, pending = new Set()) {
  const map = new Map(local.map((w) => [w.id, w]));
  let changed = false;
  for (const d of remoteDocs) {
    if (pending.has(d.id)) continue;
    if (d.deleted === true) { if (map.delete(d.id)) changed = true; continue; }
    if (!Array.isArray(d.steps)) continue;
    const incoming = docToWorkout(d.id, d);
    if (JSON.stringify(map.get(d.id)) !== JSON.stringify(incoming)) { map.set(d.id, incoming); changed = true; }
  }
  const have = new Set(local.map((w) => w.id));
  // l'ordine locale resta (più recenti prima); i nuovi arrivano in testa
  const list = [...[...map.values()].filter((w) => !have.has(w.id)), ...local.filter((w) => map.has(w.id)).map((w) => map.get(w.id))].slice(0, MAX_WORKOUTS);
  return { list, changed };
}

// ---------- impostazioni: valore per chiave, vince il timbro più recente ----------
// local: {k: stringa}, localStamps: {k: ms}; remote: {values, stamps}
export function mergePrefs(local, localStamps, remote, keys) {
  const rv = remote?.values || {}; const rs = remote?.stamps || {};
  const apply = {}; const values = {}; const stamps = {}; let upload = false;
  for (const k of keys) {
    const lv = local[k]; const ls = localStamps[k] || 0; const hasR = rv[k] != null; const rst = Number(rs[k]) || 0;
    if (hasR && (lv == null || rst > ls) && String(rv[k]) !== lv) { apply[k] = String(rv[k]); values[k] = String(rv[k]); stamps[k] = rst; }
    else if (lv != null) {
      values[k] = lv; stamps[k] = ls || Date.now();
      if (!hasR || String(rv[k]) !== lv) upload = true;
    } else if (hasR) { values[k] = String(rv[k]); stamps[k] = rst; }
  }
  return { apply, values, stamps, upload };
}

// ---------- record dei giochi: vince il migliore ----------
export const GAME_KEY_RE = /^(?:[A-Za-z0-9]+Best\d*|racer3dStage|rfProgress|ghost:.+)$/;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function parse(v) { try { return JSON.parse(v); } catch { return undefined; } }
export function betterGame(key, a, b) { // a = locale, b = remoto: restituisce il valore da tenere (stringa)
  if (a == null) return b; if (b == null) return a;
  if (a === b) return a;
  if (/^racer3dBest\d+$/.test(key)) { const x = num(a); const y = num(b); if (!(x > 0)) return b; if (!(y > 0)) return a; return y < x ? b : a; } // tempo: il minore
  if (/Best\d*$/.test(key) || key === 'racer3dStage') { const x = num(a); const y = num(b); if (x == null) return b; if (y == null) return a; return y > x ? b : a; }
  if (key === 'rfProgress') {
    const x = parse(a); const y = parse(b);
    if (!x || typeof x !== 'object') return b; if (!y || typeof y !== 'object') return a;
    const out = { ...y, ...x, xp: Math.max(x.xp || 0, y.xp || 0) };
    out.achievements = { ...(y.achievements || {}), ...(x.achievements || {}) };
    out.stats = { ...(y.stats || {}) };
    for (const [k, v] of Object.entries(x.stats || {})) out.stats[k] = typeof v === 'number' && typeof out.stats[k] === 'number' ? Math.max(v, out.stats[k]) : v;
    const out2 = JSON.stringify(out);
    return out2 === a ? a : out2;
  }
  if (key.startsWith('ghost:')) { const x = parse(a); const y = parse(b); if (!Array.isArray(x)) return b; if (!Array.isArray(y)) return a; return y.length < x.length ? b : a; } // meno punti = più veloce
  return a;
}
// local/remote: mappe {chiave: stringa}. Restituisce i valori da applicare in locale e il documento da caricare.
export function mergeGames(local, remoteValues) {
  const rv = remoteValues || {}; const apply = {}; const values = {}; let upload = false; let bytes = 0;
  const keys = [...new Set([...Object.keys(local), ...Object.keys(rv)])].filter((k) => GAME_KEY_RE.test(k)).sort((a, b) => Number(a.startsWith('ghost:')) - Number(b.startsWith('ghost:')));
  for (const k of keys) {
    const best = betterGame(k, local[k], rv[k]);
    if (best == null) continue;
    if (best !== local[k]) apply[k] = best;
    if (best !== rv[k]) upload = true;
    const size = k.length + best.length;
    if (Object.keys(values).length >= GAMES_MAX_KEYS || bytes + size > GAMES_MAX_BYTES) { if (k.startsWith('ghost:')) continue; }
    values[k] = best; bytes += size;
  }
  return { apply, values, upload };
}

// ---------- hash semplice per accorgersi che un dato locale è cambiato ----------
export function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return String(h); }
