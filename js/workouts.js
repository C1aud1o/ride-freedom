// Allenamenti strutturati in ERG: il rullo imposta da solo i watt di ogni tratto (in % della tua FTP).
// Libreria originale + test FTP a rampa. + / − durante l'allenamento alzano o abbassano l'intensità del 5%.

const s = (d, p, label) => ({ d, p, label });
const ramp = (d, p, to, label) => ({ d, p, to, label });
const reps = (n, on, off, extraLabel = 'Ripetuta') => Array.from({ length: n }, (_, i) => [
  { ...on, label: `${extraLabel} ${i + 1}/${n}` }, ...(off && i < n - 1 ? [{ ...off, label: 'Recupero' }] : []),
]).flat();
const WARM = [ramp(300, 0.45, 0.7, 'Riscaldamento'), s(120, 0.75, 'Avvicinamento')];
const COOL = [ramp(300, 0.6, 0.4, 'Defaticamento')];

export const WORKOUTS = [
  { id: 'sblocco', name: 'Sblocco', tag: 'Facile · 30 min', desc: 'Gambe leggere con qualche accelerazione breve. Ideale il giorno dopo uno sforzo.',
    steps: [...WARM, ...reps(4, s(30, 1.05), s(150, 0.6), 'Allungo'), s(240, 0.6, 'Fondo'), ...COOL] },
  { id: 'fondo', name: 'Fondo lento', tag: 'Z2 · 45 min', desc: 'Resistenza aerobica: la base di tutto. Ritmo da chiacchierata.',
    steps: [...WARM, s(1800, 0.68, 'Fondo'), ...COOL] },
  { id: 'sweet', name: 'Sweet spot 3×10', tag: 'Medio · 55 min', desc: 'Tre blocchi poco sotto soglia: il miglior rapporto tra fatica e progresso.',
    steps: [...WARM, ...reps(3, s(600, 0.9), s(300, 0.55), 'Blocco'), ...COOL] },
  { id: 'soglia', name: 'Soglia 2×15', tag: 'Duro · 55 min', desc: 'Due tratti alla tua FTP. Alza il "soffitto" della tua potenza sostenibile.',
    steps: [...WARM, ...reps(2, s(900, 1.0), s(420, 0.55), 'Soglia'), ...COOL] },
  { id: 'vo2', name: 'VO2max 5×3', tag: 'Molto duro · 45 min', desc: 'Ripetute brevi e intense per allargare il motore.',
    steps: [...WARM, ...reps(5, s(180, 1.15), s(180, 0.5)), ...COOL] },
  { id: 'piramide', name: 'Piramide', tag: 'Medio · 45 min', desc: 'Sali e scendi di intensità: 1-2-3-4-3-2-1 minuti, recuperi uguali.',
    steps: [...WARM, ...[1, 2, 3, 4, 3, 2, 1].flatMap((m, i, a) => [s(m * 60, 1.0 + (4 - m) * 0.05, `Gradino ${i + 1}/${a.length}`), ...(i < a.length - 1 ? [s(m * 60, 0.55, 'Recupero')] : [])]), ...COOL] },
  { id: 'trenta', name: '30/30', tag: 'Duro · 35 min', desc: '2 serie di 8 × 30 secondi forti e 30 facili. Corte ma intense.',
    steps: [...WARM, ...reps(8, s(30, 1.2), s(30, 0.5), 'Serie 1:'), s(300, 0.5, 'Recupero'), ...reps(8, s(30, 1.2), s(30, 0.5), 'Serie 2:'), ...COOL] },
  { id: 'ramp', name: 'Test FTP a rampa', tag: 'Test · 15-25 min', test: true, desc: 'Si parte facile e ogni minuto aumenta di 20 W finché non ce la fai più. La tua FTP = 75% del miglior minuto. Smetti di pedalare (o premi Termina) quando sei al limite.',
    steps: [{ d: 300, w: 90, label: 'Riscaldamento' }, ...Array.from({ length: 40 }, (_, i) => ({ d: 60, w: 100 + i * 20, label: `Gradino ${i + 1}` }))] },
];

export const duration = (w) => w.steps.reduce((a, x) => a + x.d, 0);
// stima del carico (TSS) dalla potenza normalizzata semplificata
export function tss(w) {
  if (w.test) return null;
  let sum = 0; let t = 0;
  for (const x of w.steps) { const p = x.to != null ? (x.p + x.to) / 2 : x.p; sum += p ** 4 * x.d; t += x.d; }
  const IF = (sum / t) ** 0.25;
  return Math.round((t * IF * IF) / 36);
}

export class WorkoutRunner {
  constructor(w, ftp) { this.w = w; this.ftp = ftp; this.t = 0; this.bias = 1; this.done = false; this.total = duration(w); }

  locate(t = this.t) {
    let acc = 0;
    for (let i = 0; i < this.w.steps.length; i++) {
      const x = this.w.steps[i];
      if (t < acc + x.d) return { i, x, into: t - acc, left: acc + x.d - t };
      acc += x.d;
    }
    return null;
  }

  wattsOf(x, into = 0) {
    if (x.w != null) return x.w;
    const p = x.to != null ? x.p + (x.to - x.p) * (into / x.d) : x.p;
    return p * this.ftp;
  }

  // avanza di dt secondi; restituisce lo stato corrente
  tick(dt) {
    if (this.done) return null;
    this.t += dt;
    const cur = this.locate();
    if (!cur) { this.done = true; return null; }
    const target = Math.round((this.wattsOf(cur.x, cur.into) * (this.w.test ? 1 : this.bias)) / 5) * 5;
    const next = this.w.steps[cur.i + 1];
    return { ...cur, target, next, nextW: next ? Math.round(this.wattsOf(next) * (this.w.test ? 1 : this.bias) / 5) * 5 : null };
  }

  skip() { const cur = this.locate(); if (cur) this.t += cur.left + 0.01; }
}

// disegna il profilo dell'allenamento (barre colorate per zona) con l'indicatore di avanzamento
export function drawProfile(canvas, w, ftp, t = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth || 300; const H = canvas.clientHeight || 60;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const total = duration(w); const r = new WorkoutRunner(w, ftp);
  const maxW = Math.max(...w.steps.map((x) => Math.max(r.wattsOf(x, 0), r.wattsOf(x, x.d)))) * 1.08;
  let acc = 0;
  for (const x of w.steps) {
    const x0 = (acc / total) * W; const x1 = ((acc + x.d) / total) * W;
    const h0 = (r.wattsOf(x, 0) / maxW) * H; const h1 = (r.wattsOf(x, x.d) / maxW) * H;
    const pct = r.wattsOf(x, x.d / 2) / ftp;
    g.fillStyle = zoneColor(pct); g.globalAlpha = t != null && acc + x.d < t ? 0.45 : 1;
    g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H - h0); g.lineTo(x1, H - h1); g.lineTo(x1, H); g.closePath(); g.fill();
    acc += x.d;
  }
  g.globalAlpha = 1;
  if (t != null) { const x = (Math.min(t, total) / total) * W; g.fillStyle = '#ffffff'; g.fillRect(x - 1, 0, 2, H); }
}

export function zoneColor(pct) {
  return pct < 0.55 ? '#8a8f98' : pct < 0.75 ? '#4d8dff' : pct < 0.9 ? '#2fbf71' : pct < 1.05 ? '#f2c230' : pct < 1.2 ? '#ff8a3d' : '#ff4d4d';
}

export const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, '0')}`; };
