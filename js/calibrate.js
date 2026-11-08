// Calibrazione della cadenza per i rulli che non la trasmettono (es. Van Rysel D100 con Zwift Cog).
// La cadenza viene stimata dalla velocità del volano: rpm = km/h × fattore. Il fattore dipende dalla
// corona usata sulla bici, quindi lo si misura: l'utente pedala a tempo con un metronomo (85 rpm) per
// qualche secondo, mentre il rullo tiene una resistenza leggera e costante.
import { t } from './i18n.js';

export const DEFAULT_FACTOR = 7.37;
const BPM = 85; // un bip per ogni giro di pedale
const SETTLE = 6; // secondi per prendere il ritmo
const MEASURE = 15; // secondi di misura

export function loadFactor() {
  try { const f = Number(localStorage.getItem('cadFactor')); return f >= 2 && f <= 20 ? f : DEFAULT_FACTOR; } catch { return DEFAULT_FACTOR; }
}

// fattore dai campioni: mediana dei km/h (robusta a un colpo di pedale fuori tempo)
export function factorFrom(kmhSamples, rpm = BPM) {
  const s = kmhSamples.filter((v) => v > 3).sort((a, b) => a - b);
  if (s.length < 5) return null;
  const med = s[Math.floor(s.length / 2)];
  const f = rpm / med;
  return f >= 2 && f <= 20 ? +f.toFixed(2) : null;
}

// hooks: { speedKmh(), realCadence() → numero|null, hold(on) → blocca/sblocca la resistenza costante, onDone(f) }
export function runCalibration(hooks) {
  const box = document.createElement('div');
  box.className = 'calib';
  box.innerHTML = `<div class="calib-box" role="dialog" aria-modal="true">
    <h2>${t('calib.title')}</h2>
    <p class="calib-msg">${t('calib.ready')}</p>
    <div class="calib-beat" aria-hidden="true"></div>
    <p class="calib-count"></p>
    <div class="row2"><button class="ghost calib-cancel">${t('ui.cancel')}</button><button class="cta calib-go">${t('calib.start')}</button></div>
  </div>`;
  document.body.appendChild(box);
  const msg = box.querySelector('.calib-msg'); const beat = box.querySelector('.calib-beat');
  const count = box.querySelector('.calib-count'); const go = box.querySelector('.calib-go');
  let timer = null; let tick = null; let ac = null;
  const close = () => { clearInterval(timer); clearInterval(tick); hooks.hold(false); try { ac?.close(); } catch { /* */ } box.remove(); };
  box.querySelector('.calib-cancel').addEventListener('click', close);

  const click = () => {
    beat.classList.remove('on'); void beat.offsetWidth; beat.classList.add('on');
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = 1200; g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.07);
    } catch { /* senza audio resta il metronomo visivo */ }
  };

  go.addEventListener('click', () => {
    go.disabled = true; hooks.hold(true);
    msg.textContent = t('calib.follow', { rpm: BPM });
    tick = setInterval(click, 60000 / BPM); click();
    const kmh = []; const real = []; let sec = 0;
    timer = setInterval(() => {
      sec++;
      if (sec <= SETTLE) { count.textContent = t('calib.settle', { s: SETTLE - sec + 1 }); return; }
      kmh.push(hooks.speedKmh());
      const rc = hooks.realCadence(); if (rc) real.push(rc);
      count.textContent = t('calib.measure', { s: SETTLE + MEASURE - sec });
      if (sec < SETTLE + MEASURE) return;
      clearInterval(timer); clearInterval(tick);
      // con un sensore di cadenza vero si usa la cadenza misurata, non quella del metronomo
      const rpm = real.length >= 5 ? real.reduce((a, b) => a + b, 0) / real.length : BPM;
      const f = factorFrom(kmh, rpm);
      hooks.hold(false);
      if (!f) { msg.textContent = t('calib.failed'); count.textContent = ''; go.disabled = false; go.textContent = t('calib.retry'); return; }
      try { localStorage.setItem('cadFactor', String(f)); } catch { /* */ }
      hooks.onDone(f);
      msg.textContent = t('calib.done', { f: f.toFixed(2) }); count.textContent = '';
      go.hidden = true; box.querySelector('.calib-cancel').textContent = t('ui.close');
    }, 1000);
  });
}
