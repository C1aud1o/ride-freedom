// Allenamenti strutturati in ERG: il rullo imposta da solo i watt di ogni tratto (in % della tua FTP).
// Libreria originale + test FTP a rampa. + / − durante l'allenamento alzano o abbassano l'intensità del 5%.

import { t } from './i18n.js';

const s = (d, p, label) => ({ d, p, label });
const ramp = (d, p, to, label) => ({ d, p, to, label });
// n ripetizioni con etichetta "Ripetuta i/n" (la chiave sceglie il nome); i recuperi sono tra una ripetizione e l'altra
const reps = (n, on, off, key = 'workouts.step.rep') => Array.from({ length: n }, (_, i) => [
  { ...on, label: t(key, { i: i + 1, n }) }, ...(off && i < n - 1 ? [{ ...off, label: t('workouts.step.rest') }] : []),
]).flat();

// Libreria: gli id restano fissi, nomi/descrizioni/etichette vengono dalle traduzioni (workouts.<id>.*).
// È una funzione perché cambiando lingua i testi vanno rifatti.
export function workouts() {
  const WARM = [ramp(300, 0.45, 0.7, t('workouts.step.warm')), s(120, 0.75, t('workouts.step.approach'))];
  const COOL = [ramp(300, 0.6, 0.4, t('workouts.step.cool'))];
  const meta = (id) => ({ id, name: t(`workouts.${id}.name`), tag: t(`workouts.${id}.tag`), desc: t(`workouts.${id}.desc`) });
  return [
    { ...meta('sblocco'), steps: [...WARM, ...reps(4, s(30, 1.05), s(150, 0.6), 'workouts.step.stride'), s(240, 0.6, t('workouts.step.endurance')), ...COOL] },
    { ...meta('fondo'), steps: [...WARM, s(1800, 0.68, t('workouts.step.endurance')), ...COOL] },
    { ...meta('sweet'), steps: [...WARM, ...reps(3, s(600, 0.9), s(300, 0.55), 'workouts.step.block'), ...COOL] },
    { ...meta('soglia'), steps: [...WARM, ...reps(2, s(900, 1.0), s(420, 0.55), 'workouts.step.threshold'), ...COOL] },
    { ...meta('vo2'), steps: [...WARM, ...reps(5, s(180, 1.15), s(180, 0.5)), ...COOL] },
    { ...meta('piramide'), steps: [...WARM, ...[1, 2, 3, 4, 3, 2, 1].flatMap((m, i, a) => [s(m * 60, 1.0 + (4 - m) * 0.05, t('workouts.step.stepN', { i: i + 1, n: a.length })), ...(i < a.length - 1 ? [s(m * 60, 0.55, t('workouts.step.rest'))] : [])]), ...COOL] },
    { ...meta('trenta'), steps: [...WARM, ...reps(8, s(30, 1.2), s(30, 0.5), 'workouts.step.set1'), s(300, 0.5, t('workouts.step.rest')), ...reps(8, s(30, 1.2), s(30, 0.5), 'workouts.step.set2'), ...COOL] },
    // allenamenti dei piani (js/plans.js): sempre in % FTP, durate pensate per chi si allena 3-4 volte a settimana
    { ...meta('facile'), steps: [ramp(300, 0.45, 0.65, t('workouts.step.warm')), s(1200, 0.62, t('workouts.step.easy')), ...COOL] },
    { ...meta('costante'), steps: [ramp(300, 0.45, 0.65, t('workouts.step.warm')), s(1800, 0.68, t('workouts.step.endurance')), ...COOL] },
    { ...meta('tempo'), steps: [...WARM, ...reps(2, s(720, 0.82), s(300, 0.55), 'workouts.step.block'), ...COOL] },
    { ...meta('lungo60'), steps: [ramp(300, 0.45, 0.65, t('workouts.step.warm')), s(3000, 0.68, t('workouts.step.endurance')), ...COOL] },
    { ...meta('lungo75'), steps: [ramp(300, 0.45, 0.65, t('workouts.step.warm')), s(3900, 0.68, t('workouts.step.endurance')), ...COOL] },
    { ...meta('lungo90'), steps: [ramp(300, 0.45, 0.65, t('workouts.step.warm')), s(4800, 0.68, t('workouts.step.endurance')), ...COOL] },
    { ...meta('ramp'), test: true,
      steps: [{ d: 300, w: 90, label: t('workouts.step.warm') }, ...Array.from({ length: 40 }, (_, i) => ({ d: 60, w: 100 + i * 20, label: t('workouts.step.rampStep', { i: i + 1 }) }))] },
  ];
}

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

// ---------- Import .zwo (formato aperto XML usato da molti siti di allenamenti) ----------
export function parseZwo(text, fileName = t('editor.fallbackName')) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error(t('zwo.invalid'));
  const wk = doc.querySelector('workout'); if (!wk) throw new Error(t('zwo.none'));
  const num = (el, a, d = 0) => { const v = parseFloat(el.getAttribute(a) ?? el.getAttribute(a.toLowerCase())); return Number.isFinite(v) ? v : d; };
  const steps = [];
  for (const el of wk.children) {
    const tag = el.tagName.toLowerCase(); const d = Math.round(num(el, 'Duration'));
    if (tag === 'warmup' || tag === 'cooldown' || tag === 'ramp') {
      steps.push({ d, p: num(el, 'PowerLow', 0.5), to: num(el, 'PowerHigh', 0.5), label: t(tag === 'warmup' ? 'editor.label.warm' : tag === 'cooldown' ? 'editor.label.cool' : 'editor.label.ramp') });
    } else if (tag === 'steadystate') {
      steps.push({ d, p: num(el, 'Power', num(el, 'PowerLow', 0.6)), label: t('editor.label.steady') });
    } else if (tag === 'intervalst') {
      const n = Math.round(num(el, 'Repeat', 1));
      for (let i = 0; i < n; i++) {
        steps.push({ d: Math.round(num(el, 'OnDuration')), p: num(el, 'OnPower', 1), label: t('workouts.step.rep', { i: i + 1, n }) });
        steps.push({ d: Math.round(num(el, 'OffDuration')), p: num(el, 'OffPower', 0.5), label: t('workouts.step.rest') });
      }
    } else if (tag === 'freeride' || tag === 'maxeffort') {
      steps.push({ d, p: tag === 'maxeffort' ? 1.5 : 0.65, label: t(tag === 'maxeffort' ? 'zwo.maxEffort' : 'zwo.free') });
    }
  }
  const valid = steps.filter((x) => x.d > 0);
  if (!valid.length) throw new Error(t('zwo.empty'));
  const name = doc.querySelector('workout_file > name')?.textContent?.trim() || fileName.replace(/\.zwo$/i, '');
  const desc = doc.querySelector('workout_file > description')?.textContent?.trim().slice(0, 200) || t('zwo.fromFile');
  const mins = Math.round(duration({ steps: valid }) / 60);
  return { id: `zwo-${Date.now()}`, name, tag: t('zwo.tag', { mins }), desc, steps: valid, custom: true };
}
