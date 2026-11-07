// Percorsi: carichi un GPX (da Strava, Komoot, Garmin…) e la pendenza segue il tracciato.
// La posizione finisce anche nel .FIT, così Strava mostra la mappa.

const R = 6371000;
const hav = (a, b) => {
  const toR = Math.PI / 180; const dLat = (b.lat - a.lat) * toR; const dLon = (b.lon - a.lon) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export function parseGpx(text, name = 'Percorso') {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('File GPX non valido');
  let pts = [...doc.querySelectorAll('trkpt')]; if (!pts.length) pts = [...doc.querySelectorAll('rtept')];
  const raw = pts.map((p) => ({ lat: +p.getAttribute('lat'), lon: +p.getAttribute('lon'), ele: p.querySelector('ele') ? +p.querySelector('ele').textContent : null }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (raw.length < 2) throw new Error('Il GPX non contiene una traccia');
  const title = doc.querySelector('trk > name, metadata > name, rte > name')?.textContent?.trim() || name.replace(/\.gpx$/i, '');
  return build(title, raw);
}

// costruisce distanze cumulative e pendenze levigate (il GPS è rumoroso)
export function build(name, raw) {
  const pts = []; let d = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i) { const step = hav(raw[i - 1], raw[i]); if (step < 0.5) continue; d += step; }
    pts.push({ ...raw[i], d });
  }
  const hasEle = pts.some((p) => p.ele != null);
  if (!hasEle) pts.forEach((p) => { p.ele = 0; });
  // quota levigata con finestra di ~60 m
  const sm = pts.map((p, i) => {
    let s = 0; let n = 0;
    for (let j = i; j >= 0 && p.d - pts[j].d <= 30; j--) { s += pts[j].ele ?? 0; n++; }
    for (let j = i + 1; j < pts.length && pts[j].d - p.d <= 30; j++) { s += pts[j].ele ?? 0; n++; }
    return s / n;
  });
  pts.forEach((p, i) => { p.e = sm[i]; });
  let gain = 0; for (let i = 1; i < pts.length; i++) gain += Math.max(0, pts[i].e - pts[i - 1].e);
  return { name, pts, total: d, gain: Math.round(gain), hasEle };
}

// punto e pendenza a una certa distanza
export function at(route, dist) {
  const p = route.pts; dist = Math.max(0, Math.min(route.total, dist));
  let lo = 0; let hi = p.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m].d <= dist) lo = m; else hi = m; }
  const a = p[lo]; const b = p[hi]; const k = b.d > a.d ? (dist - a.d) / (b.d - a.d) : 0;
  // pendenza sui 100 m davanti a te (più stabile del singolo segmento)
  const ahead = (x) => { const q = Math.min(route.total, x); let i = lo; while (i < p.length - 1 && p[i].d < q) i++; return p[i]; };
  const back = a; const front = ahead(dist + 100);
  const grade = front.d > back.d ? ((front.e - back.e) / (front.d - back.d)) * 100 : 0;
  return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k, ele: a.e + (b.e - a.e) * k, grade: Math.max(-15, Math.min(20, grade)) };
}

// percorsi di prova inventati (nessun file necessario): una salita e un circuito ondulato
export const SAMPLES = [
  { id: 'colle', name: 'Colle di prova', desc: '8 km in salita, media 5,5% con un tratto al 9%', make: () => synth('Colle di prova', 8000, (d) => 40 + d * 0.055 + Math.max(0, Math.min(1, (d - 4500) / 1200)) * 40 - Math.max(0, Math.min(1, (d - 6500) / 600)) * 20, 45.9, 9.4) },
  { id: 'onde', name: 'Colline ondulate', desc: '20 km di saliscendi brevi, ottimi per il cambio', make: () => synth('Colline ondulate', 20000, (d) => 120 + 25 * Math.sin(d / 900) + 12 * Math.sin(d / 310), 43.7, 11.2) },
  { id: 'piano', name: 'Lungolago', desc: '15 km quasi piatti per il fondo', make: () => synth('Lungolago', 15000, (d) => 200 + 3 * Math.sin(d / 1500), 45.8, 9.1) },
];
function synth(name, len, eleFn, lat0, lon0) {
  const raw = [];
  for (let d = 0; d <= len; d += 20) {
    const a = d / 1800; // traccia sinuosa
    raw.push({ lat: lat0 + (d / 111000) * 0.7 + Math.sin(a) * 0.004, lon: lon0 + (d / 78000) * 0.7 + Math.cos(a * 0.7) * 0.004, ele: eleFn(d) });
  }
  return build(name, raw);
}

// profilo altimetrico con il punto in cui sei
export function drawElevation(canvas, route, dist = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); const W = canvas.clientWidth || 300; const H = canvas.clientHeight || 70;
  canvas.width = W * dpr; canvas.height = H * dpr; const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const es = route.pts.map((p) => p.e); const lo = Math.min(...es); const hi = Math.max(lo + 30, ...es);
  const x = (d) => (d / route.total) * W; const y = (e) => H - 4 - ((e - lo) / (hi - lo)) * (H - 12);
  g.beginPath(); g.moveTo(0, H); route.pts.forEach((p) => g.lineTo(x(p.d), y(p.e))); g.lineTo(W, H); g.closePath();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fill();
  if (dist != null) {
    g.save(); g.beginPath(); g.rect(0, 0, x(dist), H); g.clip();
    g.beginPath(); g.moveTo(0, H); route.pts.forEach((p) => g.lineTo(x(p.d), y(p.e))); g.lineTo(W, H); g.closePath();
    g.fillStyle = 'rgba(217,255,61,.5)'; g.fill(); g.restore();
    const cur = at(route, dist); g.fillStyle = '#fff'; g.beginPath(); g.arc(x(dist), y(cur.ele), 4, 0, Math.PI * 2); g.fill();
  }
}

// mappa semplice (solo la traccia, nessun servizio esterno)
export function drawMap(canvas, route, dist = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); const W = canvas.clientWidth || 120; const H = canvas.clientHeight || 120;
  canvas.width = W * dpr; canvas.height = H * dpr; const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lats = route.pts.map((p) => p.lat); const lons = route.pts.map((p) => p.lon);
  const k = Math.cos((lats[0] * Math.PI) / 180);
  const minX = Math.min(...lons) * k; const maxX = Math.max(...lons) * k; const minY = Math.min(...lats); const maxY = Math.max(...lats);
  const s = Math.min((W - 16) / (maxX - minX || 1e-6), (H - 16) / (maxY - minY || 1e-6));
  const px = (p) => [8 + (p.lon * k - minX) * s + (W - 16 - (maxX - minX) * s) / 2, H - 8 - (p.lat - minY) * s - (H - 16 - (maxY - minY) * s) / 2];
  g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.3)';
  g.beginPath(); route.pts.forEach((p, i) => { const [a, b] = px(p); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke();
  if (dist != null) {
    g.strokeStyle = '#d9ff3d'; g.beginPath(); let first = true;
    for (const p of route.pts) { if (p.d > dist) break; const [a, b] = px(p); if (first) { g.moveTo(a, b); first = false; } else g.lineTo(a, b); }
    g.stroke();
    const [a, b] = px(at(route, dist)); g.fillStyle = '#fff'; g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill();
  }
}
