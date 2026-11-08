// Storico: statistiche di ogni uscita (potenza normalizzata, migliori potenze, serie per il grafico)
// e pannello con settimane, record e lista delle uscite. Tutto resta solo su questo dispositivo.

import { t, fmtDate as fmtD, fmtDec } from './i18n.js';

const BESTS = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min']];

// statistiche dal registro a 1 Hz della sessione
export function rideStats(log) {
  const p = log.map((x) => x.power || 0);
  const best = {};
  for (const [d] of BESTS) {
    if (p.length < d) continue;
    let sum = p.slice(0, d).reduce((a, b) => a + b, 0); let m = sum;
    for (let i = d; i < p.length; i++) { sum += p[i] - p[i - d]; if (sum > m) m = sum; }
    best[d] = Math.round(m / d);
  }
  // potenza normalizzata: media mobile 30 s alla quarta
  let np = 0;
  if (p.length >= 30) {
    let sum = p.slice(0, 30).reduce((a, b) => a + b, 0); let acc = 0; let n = 0;
    for (let i = 30; i <= p.length; i++) { acc += (sum / 30) ** 4; n++; if (i < p.length) sum += p[i] - p[i - 30]; }
    np = Math.round((acc / n) ** 0.25);
  }
  const hrs = log.map((x) => x.hr).filter(Boolean);
  // serie compatta per il grafico: una media ogni 10 s
  const series = [];
  for (let i = 0; i < p.length; i += 10) { const c = p.slice(i, i + 10); series.push(Math.round(c.reduce((a, b) => a + b, 0) / c.length)); }
  return { np, maxW: Math.round(Math.max(0, ...p)), best, maxHr: hrs.length ? Math.max(...hrs) : null, avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null, series: series.slice(0, 720) };
}

const fmtDate = (ms) => fmtD(new Date(ms), { weekday: 'short', day: 'numeric', month: 'short' });
const weekStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

export function renderHistory(el, hist, ftp) {
  if (!hist.length) {
    el.innerHTML = `<p class="fine hs-empty">${t('history.empty')}</p>`;
    return;
  }
  // settimane (ultime 8)
  const now = weekStart(Date.now()); const weeks = [];
  for (let k = 7; k >= 0; k--) {
    const ws = now - k * 7 * 864e5; const rides = hist.filter((h) => weekStart(h.t) === ws);
    weeks.push({ ws, min: Math.round(rides.reduce((a, h) => a + h.dur, 0) / 60), n: rides.length, kj: rides.reduce((a, h) => a + (h.kj || 0), 0) });
  }
  const thisWeek = weeks[weeks.length - 1];
  // record di sempre e degli ultimi 30 giorni
  const rec = (filter) => Object.fromEntries(BESTS.map(([d]) => [d, Math.max(0, ...hist.filter(filter).map((h) => h.best?.[d] || 0))]));
  const all = rec(() => true); const recent = rec((h) => Date.now() - h.t < 30 * 864e5);
  const ftpGuess = all[1200] ? Math.round(all[1200] * 0.95) : null;
  const totKm = hist.reduce((a, h) => a + (h.km || 0), 0); const totH = hist.reduce((a, h) => a + h.dur, 0) / 3600;
  el.innerHTML = `
    <section class="hs-block">
      <div class="hs-kpis">
        <div><b>${thisWeek.min}</b><small>${t('history.kpi.minutes')}</small></div>
        <div><b>${thisWeek.n}</b><small>${t('history.kpi.rides')}</small></div>
        <div><b>${Math.round(totKm)}</b><small>${t('history.kpi.km')}</small></div>
        <div><b>${fmtDec(totH, 1)}</b><small>${t('history.kpi.hours')}</small></div>
      </div>
      <canvas id="hsWeeks" class="hs-weeks"></canvas>
      <p class="fine">${t('history.weeksNote')}</p>
    </section>
    <section class="hs-block">
      <h3>${t('history.records')}</h3>
      <div class="hs-bests">${BESTS.map(([d, l]) => `<div><small>${l}</small><b>${all[d] || '–'}</b><span>${recent[d] ? t('history.last30', { w: recent[d] }) : '—'}</span></div>`).join('')}</div>
      ${ftpGuess ? `<p class="fine">${t('history.ftpGuess', { ftp: ftpGuess, current: ftp })}${Math.abs(ftpGuess - ftp) > 5 ? ` <button class="link" id="hsUseFtp" data-ftp="${ftpGuess}">${t('history.useFtp', { ftp: ftpGuess })}</button>` : ''}</p>` : `<p class="fine">${t('history.ftpHelp')}</p>`}
    </section>
    <section class="hs-block">
      <h3>${t('history.rides')}</h3>
      <div class="hs-list">${[...hist].reverse().map((h, i) => `<details class="hs-ride">
        <summary><span><b>${fmtDate(h.t)}</b><small>${t('history.rideLine', { min: Math.round(h.dur / 60), km: h.km, w: h.avgW })}${h.np ? ` · NP ${h.np}` : ''}</small></span>${h.series ? `<canvas data-spark="${hist.length - 1 - i}" class="hs-spark"></canvas>` : ''}</summary>
        ${h.series ? `<canvas data-big="${hist.length - 1 - i}" class="hs-big"></canvas>` : ''}
        <dl class="hs-dl">
          <div><dt>${t('history.energy')}</dt><dd>${h.kj} kJ</dd></div>
          ${h.maxW ? `<div><dt>${t('history.peak')}</dt><dd>${h.maxW} W</dd></div>` : ''}
          ${h.avgHr ? `<div><dt>${t('history.avgHr')}</dt><dd>${h.avgHr}</dd></div>` : ''}
          ${h.np ? `<div><dt>${t('history.intensity')}</dt><dd>${Math.round((h.np / ftp) * 100)}%</dd></div>` : ''}
          ${h.best?.[60] ? `<div><dt>${t('history.bestMinute')}</dt><dd>${h.best[60]} W</dd></div>` : ''}
          ${h.best?.[1200] ? `<div><dt>${t('history.best20')}</dt><dd>${h.best[1200]} W</dd></div>` : ''}
        </dl></details>`).join('')}</div>
    </section>`;
  requestAnimationFrame(() => {
    bars(el.querySelector('#hsWeeks'), weeks.map((w) => w.min), weeks.map((w) => fmtD(new Date(w.ws), { day: 'numeric', month: 'numeric' })));
    el.querySelectorAll('[data-spark]').forEach((c) => line(c, hist[c.dataset.spark].series, ftp, false));
    el.querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => { const c = d.querySelector('[data-big]'); if (d.open && c) line(c, hist[c.dataset.big].series, ftp, true); }));
  });
}

function setup(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); const W = c.clientWidth || 280; const H = c.clientHeight || 80;
  c.width = W * dpr; c.height = H * dpr; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, W, H };
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function bars(c, values, labels) {
  if (!c) return;
  const { g, W, H } = setup(c); const max = Math.max(30, ...values) * 1.18; const bw = W / values.length;
  values.forEach((v, i) => {
    const h = (v / max) * (H - 20);
    g.fillStyle = i === values.length - 1 ? css('--accent') || '#d9ff3d' : 'rgba(255,255,255,.22)';
    g.beginPath(); g.roundRect(i * bw + 4, H - 16 - h, bw - 8, Math.max(2, h), 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '10px Barlow, sans-serif'; g.textAlign = 'center';
    g.fillText(labels[i], i * bw + bw / 2, H - 3);
    if (v) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText(v, i * bw + bw / 2, H - 20 - h); }
  });
}

// grafico della potenza (punti ogni 10 s) con la linea della FTP
function line(c, s, ftp, big) {
  if (!c || !s?.length) return;
  const { g, W, H } = setup(c); const max = Math.max(ftp * 1.3, ...s) * 1.05;
  const x = (i) => (i / Math.max(1, s.length - 1)) * W; const y = (v) => H - (v / max) * H;
  const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(217,255,61,.45)'); grad.addColorStop(1, 'rgba(217,255,61,0)');
  g.beginPath(); g.moveTo(0, H); s.forEach((v, i) => g.lineTo(x(i), y(v))); g.lineTo(W, H); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); s.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(0, y(v)))); g.strokeStyle = '#d9ff3d'; g.lineWidth = big ? 1.5 : 1; g.stroke();
  if (big) {
    g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(0, y(ftp)); g.lineTo(W, y(ftp)); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '11px Barlow, sans-serif'; g.fillText(`FTP ${ftp} W`, 6, y(ftp) - 4);
    const mins = Math.round((s.length * 10) / 60); g.textAlign = 'right'; g.fillText(`${mins} min`, W - 4, H - 4);
  }
}
