// Sfide del mese. Si calcolano SOLO dallo storico locale (rideHistory): funzionano anche senza account.
// Con l'account il server (onRideCreated) assegna la medaglia per km e uscite; la zona 2 resta locale.
// Gli id e gli obiettivi devono coincidere con DEFAULT_CHALLENGES in functions/src/challenges.ts (c'è un test che lo controlla).
// Modulo puro (nessun DOM, nessuna traduzione): i testi stanno in locales/*.json sotto "challenges.*".

// metric: 'km' | 'rides' | 'z2' (minuti in zona 2). Vale per ogni mese; per cambiare un mese basta aggiungerlo a BY_MONTH.
export const CHALLENGES = [
  { id: 'km300', metric: 'km', target: 300 },
  { id: 'rides10', metric: 'rides', target: 10 },
  { id: 'z2h2', metric: 'z2', target: 120 },
];
// Sfide diverse per un mese preciso ("YYYY-MM"), ad esempio: '2026-12': [{ id: 'km200', metric: 'km', target: 200 }]
export const BY_MONTH = {};

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const challengesFor = (month) => BY_MONTH[month] || CHALLENGES;

// zona 2 (Coggan): dal 56% al 75% della FTP. La serie dello storico ha una media ogni 10 s.
export const Z2_LO = 0.56;
export const Z2_HI = 0.75;
export function z2Minutes(series, ftp) {
  if (!Array.isArray(series) || !(ftp > 0)) return 0;
  let n = 0;
  for (const w of series) if (w >= ftp * Z2_LO && w <= ftp * Z2_HI) n++;
  return (n * 10) / 60;
}

// valori del mese dallo storico: { km, rides, z2 }. Le uscite importate non contano (come sul server).
export function monthTotals(hist, month, ftp) {
  const tot = { km: 0, rides: 0, z2: 0 };
  for (const h of hist || []) {
    if (!h || h.src === 'import' || monthKey(new Date(h.t)) !== month) continue;
    tot.km += Number(h.km) || 0;
    tot.rides += 1;
    tot.z2 += z2Minutes(h.series, ftp);
  }
  return tot;
}

// elenco con avanzamento: [{ id, metric, target, value, pct, done }]
export function progress(hist, month = monthKey(), ftp = 200) {
  const tot = monthTotals(hist, month, ftp);
  return challengesFor(month).map((c) => {
    const value = tot[c.metric] || 0;
    return { ...c, value, pct: Math.min(100, Math.floor((value / c.target) * 100)), done: value >= c.target };
  });
}

// sfide completate dall'ultima uscita (non lo erano prima di aggiungerla)
export function newlyDone(histBefore, histAfter, month = monthKey(), ftp = 200) {
  const before = new Set(progress(histBefore, month, ftp).filter((c) => c.done).map((c) => c.id));
  return progress(histAfter, month, ftp).filter((c) => c.done && !before.has(c.id));
}

// medaglie ottenute, ricordate sul dispositivo: { "2026-11:km300": millisecondi }
const KEY = 'challengeDone';
export function loadDone() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
export function markDone(list, month = monthKey(), now = Date.now()) {
  if (!list.length) return;
  const d = loadDone();
  for (const c of list) d[`${month}:${c.id}`] ||= now;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* pieno */ }
}
