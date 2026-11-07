import { isNative, GarminBridge } from './native.js'; // per primo: nell'app installa il Bluetooth nativo
import { Trainer } from './ftms.js';
import { PowerMeter } from './powermeter.js';
import { SensorDebug } from './debug.js';
import { BUILD } from './build.js';
import { watchGuide, GARMIN_RE } from './watchguide.js';
import { ZwiftClick } from './click.js';
import { GEARS, virtualSpeed, powerForSpeed } from './gears.js';
import { HeartRate } from './hr.js';
import { encodeFit } from './fit.js';
import { Strava } from './strava.js';
import { STRAVA_PROXY } from './config.js';
import { setupDebug } from './debugview.js';
import { Strike3D } from './games/strike3d.js';
import { Racer3D } from './games/racer3d.js';
import { Horde } from './games/horde.js';
import { GameAudio } from './games/audio.js';
import { Progress } from './games/progress.js';

const $ = (id) => document.getElementById(id);
const trainer = new Trainer();
const pm = new PowerMeter();
const garminDbg = { dbg: new SensorDebug('garmin', 'Ponte Garmin') };
const click = new ZwiftClick();
const hrm = new HeartRate();

const MAX_W = 600; // limite dichiarato del Van Rysel D100

const state = {
  mode: 'gears',
  gear: 11, // indice (0-based) => marcia 12
  grade: 0,
  erg: 150,
  resistance: 30,
  mass: Number(localStorage.getItem('mass')) || 80,
  ftp: Number(localStorage.getItem('ftp')) || 200,
  data: { power: 0, cadence: 0, speed: 0, hr: null },
  cadenceSmooth: 0,
  speedSmooth: 0, // m/s dal rullo, smussata
  lastSent: null,
  lastSentAt: 0,
  ride: { running: false, start: 0, elapsed: 0, distance: 0, energy: 0, powerSum: 0, samples: 0, log: [], saved: true },
  hrFromSensor: false,
};

// ---------- UI helpers ----------
function log(msg) {
  const el = $('log');
  el.textContent = `${new Date().toLocaleTimeString()}  ${msg}\n` + el.textContent.slice(0, 2000);
}
function setStatus(id, text, ok) {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
  el.closest('.sensor')?.classList.toggle('on', !!ok);
}
function fmtTime(s) {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = Math.floor(s % 60);
  return (h ? `${h}:` : '') + `${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
}

if (!('bluetooth' in navigator)) {
  $('unsupported').hidden = false;
  $('connectTrainer').disabled = true;
  $('connectClick').disabled = true;
  $('connectHr').disabled = true;
}

// ---------- Connessioni ----------
$('connectTrainer').addEventListener('click', async () => {
  if (trainer.connected) { trainer.disconnect(); return; }
  try {
    setStatus('trainerStatus', 'Connessione…');
    const name = await trainer.connect();
    log(`Connesso a ${name}`);
  } catch (err) {
    setStatus('trainerStatus', 'Non connesso');
    log(`Errore rullo: ${err.message}`);
    trainer.dbg.log(`Errore: ${err.message}`);
  }
});

trainer.addEventListener('connected', (e) => {
  const { name, ftms, features } = e.detail;
  setStatus('trainerStatus', `${name || 'Rullo'}${ftms ? ' · FTMS' : ''}`, true);
  log(`Funzioni: ERG ${features.power ? '✓' : '✗'} · Pendenza ${features.simulation ? '✓' : '✗'} · Resistenza ${features.resistance ? '✓' : '✗'}`);
  if (!trainer.controllable) log('Il rullo è in sola lettura (nessun controllo resistenza).');
  state.lastSent = null;
  applyMode(true);
});
trainer.addEventListener('disconnected', async () => {
  setStatus('trainerStatus', 'Disconnesso');
  log('Rullo disconnesso');
});
trainer.addEventListener('log', (e) => log(e.detail));
trainer.addEventListener('data', (e) => {
  const d = { ...e.detail };
  if (state.hrFromSensor) delete d.hr; // la fascia/orologio ha la precedenza
  if (pmActive()) { delete d.power; if (state.pmCadence) delete d.cadence; } // vince il misuratore di potenza
  Object.assign(state.data, d);
  render();
});

$('connectClick').addEventListener('click', async () => {
  if (click.device?.gatt?.connected) { click.disconnect(); return; }
  try {
    setStatus('clickStatus', 'Connessione…');
    const name = await click.connect();
    setStatus('clickStatus', name, true);
    log(`Connesso a ${name} (sperimentale)`);
  } catch (err) {
    setStatus('clickStatus', 'Non connesso');
    log(`Errore Click: ${err.message}`);
    click.dbg.log(`Errore: ${err.message}`);
  }
});
click.addEventListener('disconnected', () => {
  setStatus('clickStatus', 'Non connesso');
});
click.addEventListener('shift', (e) => (activeGame?.active ? activeGame.input(e.detail) : shift(e.detail)));

$('connectHr').addEventListener('click', async () => {
  if (hrm.connected) { hrm.disconnect(); return; }
  try {
    setStatus('hrStatus', 'Connessione…');
    const name = await hrm.connect();
    state.hrFromSensor = true;
    setStatus('hrStatus', name, true);
    log(`Cardio connesso: ${name}`);
  } catch (err) {
    setStatus('hrStatus', 'Non connesso');
    log(`Errore cardio: ${err.message}`);
    hrm.dbg.log(`Errore: ${err.message}`);
  }
});
hrm.addEventListener('hr', (e) => { state.data.hr = e.detail; render(); });
hrm.addEventListener('disconnected', () => {
  state.hrFromSensor = false;
  state.data.hr = null;
  setStatus('hrStatus', 'Non connesso');
});

// ---------- Modalità e comandi ----------
document.querySelectorAll('[name=mode]').forEach((r) => r.addEventListener('change', () => {
  state.mode = r.value;
  document.body.dataset.mode = state.mode;
  state.lastSent = null;
  applyMode(true);
}));

function shift(dir) {
  const next = Math.min(GEARS.length - 1, Math.max(0, state.gear + dir));
  if (next === state.gear) return;
  state.gear = next;
  if (navigator.vibrate) navigator.vibrate(15);
  render();
  applyMode(true);
}

function step(dir) {
  if (state.mode === 'gears') return shift(dir);
  if (state.mode === 'erg') state.erg = Math.min(MAX_W, Math.max(0, state.erg + dir * 5));
  if (state.mode === 'sim') state.grade = Math.min(15, Math.max(-10, +(state.grade + dir * 0.5).toFixed(1)));
  if (state.mode === 'resistance') state.resistance = Math.min(100, Math.max(0, state.resistance + dir * 5));
  syncInputs();
  render();
  applyMode(true);
}

$('up').addEventListener('click', () => step(+1));
$('down').addEventListener('click', () => step(-1));

// Tastiera / telecomandi Bluetooth che inviano frecce o pagina su/giù
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (activeGame?.active) {
    if (['ArrowRight', 'ArrowUp', 'PageUp', '+', '=', ' '].includes(e.key)) { e.preventDefault(); activeGame.input(+1); }
    if (['ArrowLeft', 'ArrowDown', 'PageDown', '-'].includes(e.key)) { e.preventDefault(); activeGame.input(-1); }
    if (e.key === 'Escape') closeGame();
    return;
  }
  if (['ArrowUp', 'ArrowRight', 'PageUp', '+', '='].includes(e.key)) { e.preventDefault(); step(+1); }
  if (['ArrowDown', 'ArrowLeft', 'PageDown', '-'].includes(e.key)) { e.preventDefault(); step(-1); }
});

$('grade').addEventListener('input', (e) => { state.grade = +e.target.value; render(); applyMode(true); });
$('erg').addEventListener('input', (e) => { state.erg = +e.target.value; render(); applyMode(true); });
$('resistance').addEventListener('input', (e) => { state.resistance = +e.target.value; render(); applyMode(true); });
$('ftp').addEventListener('change', (e) => {
  state.ftp = Math.min(500, Math.max(80, +e.target.value || 200));
  e.target.value = state.ftp;
  localStorage.setItem('ftp', state.ftp);
  render();
});
$('mass').addEventListener('change', (e) => {
  state.mass = Math.min(200, Math.max(30, +e.target.value || 80));
  e.target.value = state.mass;
  localStorage.setItem('mass', state.mass);
});

function syncInputs() {
  $('grade').value = state.grade;
  $('erg').value = state.erg;
  $('resistance').value = state.resistance;
  $('mass').value = state.mass;
  $('ftp').value = state.ftp;
}

// Calcola il target per la modalità corrente
// Cadenza (rpm) usata dal cambio virtuale.
// Il D100 non trasmette la cadenza nei dati FTMS. Con lo Zwift Cog la trasmissione reale
// è fissa, quindi la velocità del volano è proporzionale alla pedalata: la stimiamo.
// 7.37 rpm per km/h viene dai dati del D100 (campo extra ≈ cadenza×10 = velocità×7.37).
const RPM_PER_KMH = 7.37;
function pmActive() { return pm.connected && state.usePm; }
function hasRealCadence() { return trainer.hasCadence || (pmActive() && state.pmCadence); }
function currentCadence() {
  if (hasRealCadence()) return state.cadenceSmooth;
  return state.speedSmooth * 3.6 * RPM_PER_KMH;
}

// Velocità virtuale (m/s) nella marcia scelta: cadenza × rapporto × ruota.
function currentVirtualSpeed() {
  const cad = currentCadence();
  return cad < 15 ? 0 : virtualSpeed(cad, GEARS[state.gear]);
}

function gearTarget() {
  const v = currentVirtualSpeed();
  if (v <= 0) return 0;
  return Math.min(MAX_W, powerForSpeed(v, { grade: state.grade, mass: state.mass }));
}

let sending = false;
async function applyMode(force = false) {
  if (!trainer.connected || !trainer.controllable || sending) return;
  let key; let fn;
  switch (state.mode) {
    case 'gears': {
      const [minW, maxW] = trainer.ranges.power;
      const w = Math.round(Math.min(Math.max(gearTarget(), Math.max(minW, 0)), maxW || MAX_W));
      // evita di intasare il Bluetooth: invia solo variazioni significative
      if (!force && state.lastSent?.mode === 'gears' && Math.abs(state.lastSent.value - w) < 3) return;
      key = { mode: 'gears', value: w }; fn = () => trainer.setTargetPower(w);
      break;
    }
    case 'erg':
      key = { mode: 'erg', value: state.erg }; fn = () => trainer.setTargetPower(state.erg); break;
    case 'sim':
      key = { mode: 'sim', value: state.grade }; fn = () => trainer.setSimulation({ grade: state.grade }); break;
    case 'resistance':
      key = { mode: 'resistance', value: state.resistance }; fn = () => trainer.setResistancePercent(state.resistance); break;
    default: return;
  }
  if (!force && state.lastSent?.mode === key.mode && state.lastSent.value === key.value) return;
  const now = performance.now();
  if (!force && now - state.lastSentAt < 900) return;
  sending = true;
  try {
    await fn();
    state.lastSent = key;
    state.lastSentAt = now;
    $('target').textContent = describeTarget(key);
  } catch (err) {
    log(err.message);
  } finally {
    sending = false;
  }
}

function describeTarget(k) {
  if (k.mode === 'gears' || k.mode === 'erg') return `${k.value} W`;
  if (k.mode === 'sim') return `${k.value.toFixed(1)} %`;
  return `${k.value} %`;
}

// ---------- Sessione ----------
$('startStop').addEventListener('click', () => {
  const r = state.ride;
  r.running = !r.running;
  if (r.running) { r.start = performance.now() - r.elapsed * 1000; requestWakeLock(); }
  $('startStop').textContent = r.running ? 'Pausa' : 'Avvia';
  $('startStop').classList.toggle('running', r.running);
});
$('reset').addEventListener('click', () => {
  if (!state.ride.saved && !confirm('Azzerare la sessione? I dati non salvati in .FIT andranno persi.')) return;
  Object.assign(state.ride, { running: false, elapsed: 0, distance: 0, energy: 0, powerSum: 0, samples: 0, log: [], saved: true, stravaUrl: null, historySaved: false });
  renderWelcome();
  stravaMsg('');
  persist();
  $('startStop').textContent = 'Avvia';
  $('startStop').classList.remove('running');
  closeSheet('finishSheet');
  render();
});

let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* non supportato */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.ride.running && (!wakeLock || wakeLock.released)) requestWakeLock();
});

// Ciclo principale: 1 Hz
setInterval(() => {
  const d = state.data;
  state.cadenceSmooth = state.cadenceSmooth * 0.5 + (d.cadence || 0) * 0.5;
  state.speedSmooth = state.speedSmooth * 0.5 + ((d.speed || 0) / 3.6) * 0.5;
  const r = state.ride;
  if (r.running) {
    r.elapsed = (performance.now() - r.start) / 1000;
    const speedMs = state.mode === 'gears' ? currentVirtualSpeed() : (d.speed || 0) / 3.6;
    r.distance += speedMs;
    r.energy += (d.power || 0) / 1000;
    r.powerSum += d.power || 0;
    r.samples += 1;
    r.log.push({
      t: Date.now(), power: Math.round(d.power || 0), cadence: Math.round(trainer.hasCadence ? d.cadence || 0 : currentCadence()),
      hr: d.hr || null, speed: +speedMs.toFixed(3), distance: +r.distance.toFixed(1),
    });
    r.saved = false;
    if (r.log.length % 10 === 0) persist();
    // piccoli picchi: traguardi durante la pedalata
    const m = Math.floor(r.elapsed / 600);
    if (m > (r.lastMilestone || 0)) { r.lastMilestone = m; toast(`${m * 10} minuti! Continua così`); }
    const k5 = Math.floor(r.distance / 5000);
    if (k5 > (r.lastKm || 0)) { r.lastKm = k5; toast(`${k5 * 5} km percorsi`); }
  }
  if (state.mode === 'gears') applyMode();
  render();
}, 1000);

// ---------- Render ----------
const ZONES = [
  { id: 'Z1', name: 'Recupero', max: 0.55 }, { id: 'Z2', name: 'Fondo', max: 0.75 }, { id: 'Z3', name: 'Tempo', max: 0.9 },
  { id: 'Z4', name: 'Soglia', max: 1.05 }, { id: 'Z5', name: 'VO2max', max: 1.2 }, { id: 'Z6', name: 'Anaerobico', max: 1.5 },
  { id: 'Z7', name: 'Sprint', max: Infinity },
];
const cassetteEls = GEARS.map((_, i) => {
  const el = document.createElement('i');
  el.style.height = `${10 + (GEARS.length - 1 - i) * 0.85}px`; // marce agili = pignoni grandi
  $('cassette').append(el);
  return el;
});

// ---------- Pannelli ----------
function openSheet(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
function closeSheet(id) { $(id).hidden = true; document.body.style.overflow = ''; }
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet(b.dataset.close)));
document.querySelectorAll('.sheet').forEach((sh) => sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(sh.id); }));
$('openSettings').addEventListener('click', () => openSheet('settingsSheet'));
$('openDebug').addEventListener('click', () => closeSheet('settingsSheet'));
function render() {
  const d = state.data; const r = state.ride;
  $('power').textContent = Math.round(d.power || 0);
  $('cadence').textContent = hasRealCadence() ? Math.round(d.cadence || 0) : trainer.connected ? `~${Math.round(currentCadence())}` : '0';
  const speed = state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : d.speed || 0;
  $('speed').textContent = speed.toFixed(1);
  $('hr').textContent = d.hr ? d.hr : '--';
  $('time').textContent = fmtTime(r.elapsed);
  $('distance').textContent = (r.distance / 1000).toFixed(2);
  $('avgPower').textContent = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  $('kj').textContent = Math.round(r.energy);
  $('saveFit').disabled = !r.log.length;
  $('shareFit').disabled = !r.log.length;
  $('finishRide').disabled = !r.log.length;
  $('uploadStrava').disabled = !r.log.length || stravaBusy;

  $('gearNum').textContent = state.gear + 1;
  $('gearRatio').textContent = GEARS[state.gear].toFixed(2);
  // cassetta: il pignone acceso è la marcia attuale
  cassetteEls.forEach((el, i) => { el.className = i === state.gear ? 'on' : i < state.gear ? 'past' : ''; });
  // zone di potenza sulla FTP
  const pct = (d.power || 0) / state.ftp;
  const z = ZONES.findIndex((zz) => pct < zz.max);
  const zone = ZONES[z < 0 ? ZONES.length - 1 : z];
  $('zone').textContent = d.power ? `${zone.id} ${zone.name}` : '—';
  document.documentElement.style.setProperty('--zone', d.power ? `var(--${zone.id.toLowerCase()})` : 'var(--z1)');
  $('zoneFill').style.left = `${Math.min(100, (pct / 1.7) * 100)}%`;
  $('gradeVal').textContent = `${state.grade.toFixed(1)} %`;
  $('ergVal').textContent = `${state.erg} W`;
  $('resVal').textContent = `${state.resistance} %`;
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === Number(state[b.dataset.preset])));

  const big = { gears: state.gear + 1, erg: `${state.erg}`, sim: state.grade.toFixed(1), resistance: state.resistance };
  const unit = { gears: `rapporto ${GEARS[state.gear].toFixed(2)}`, erg: 'W target', sim: '% pendenza', resistance: '% resistenza' };
  $('controlValue').textContent = big[state.mode];
  $('controlUnit').textContent = unit[state.mode];
}

// ---------- Registrazione e file FIT ----------
const STORE = 'ride-freedom-session';
function persist() {
  try {
    const r = state.ride;
    localStorage.setItem(STORE, JSON.stringify({ elapsed: r.elapsed, distance: r.distance, energy: r.energy,
      powerSum: r.powerSum, samples: r.samples, log: r.log, saved: r.saved, stravaUrl: r.stravaUrl || null, historySaved: !!r.historySaved }));
  } catch { /* spazio esaurito o storage non disponibile */ }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.log?.length) {
      Object.assign(state.ride, saved, { running: false });
      log(`Sessione precedente ripristinata (${fmtTime(saved.elapsed)}). Premi Avvia per continuare o salvala in .FIT.`);
    }
  } catch { /* ignora */ }
}
window.addEventListener('pagehide', persist);

function fitFile() {
  const bytes = encodeFit(state.ride.log);
  const d = new Date(state.ride.log[0].t);
  const pad = (n) => String(n).padStart(2, '0');
  const name = `ride-freedom-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.fit`;
  return new File([bytes], name, { type: 'application/vnd.ant.fit' });
}

$('saveFit').addEventListener('click', () => {
  try {
    const file = fitFile();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    state.ride.saved = true; persist();
    log(`Salvato ${file.name}`);
  } catch (err) { log(`Errore salvataggio: ${err.message}`); }
});

$('shareFit').addEventListener('click', async () => {
  try {
    const file = fitFile();
    await navigator.share({ files: [file], title: 'Allenamento Ride Freedom' });
    state.ride.saved = true; persist();
  } catch (err) { if (err.name !== 'AbortError') log(`Errore condivisione: ${err.message}`); }
});
try {
  $('shareFit').hidden = !navigator.canShare?.({ files: [new File([new Uint8Array(1)], 'x.fit', { type: 'application/vnd.ant.fit' })] });
} catch { /* non supportato */ }

// ---------- preset (scelta al posto dei cursori) ----------
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  state[b.dataset.preset] = Number(b.dataset.v);
  if (navigator.vibrate) navigator.vibrate(10);
  syncInputs(); render(); applyMode(true);
}));

// ---------- traguardi ----------
let toastTimer = null;
function toast(text) {
  const el = $('toast'); el.textContent = text; el.classList.add('show');
  if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- storico, benvenuto, bentornato ----------
function history() { try { return JSON.parse(localStorage.getItem('rideHistory') || '[]'); } catch { return []; } }
function saveHistory(h) { try { localStorage.setItem('rideHistory', JSON.stringify(h)); } catch { /* pieno */ } }
function renderWelcome() {
  const el = $('welcome');
  const hist = history();
  const riding = trainer.connected || state.ride.log.length;
  if (riding) { el.hidden = true; return; }
  el.hidden = false;
  if (!hist.length) {
    el.innerHTML = `<h2>Pronto a pedalare?</h2>
      <p>Tre passi e sei in sella.</p>
      <ol><li>Collega il rullo dalla spia "Rullo" qui sopra</li><li>Scegli la modalità: con Cambio usi le marce virtuali</li><li>Premi Avvia e pedala: − e + cambiano marcia</li></ol>
      <button class="cta" id="welcomeConnect">Collega il rullo</button>`;
  } else {
    const last = hist[hist.length - 1];
    const week = hist.filter((h) => Date.now() - h.t < 7 * 864e5);
    const days = Math.floor((Date.now() - last.t) / 864e5);
    const when = days === 0 ? 'oggi' : days === 1 ? 'ieri' : `${days} giorni fa`;
    el.innerHTML = `<h2>Bentornato</h2>
      <p>Ultimo allenamento ${when}.</p>
      <dl class="stats"><div><dt>Minuti</dt><dd>${Math.round(last.dur / 60)}</dd></div><div><dt>W medi</dt><dd>${last.avgW}</dd></div><div><dt>km</dt><dd>${last.km}</dd></div></dl>
      ${week.length ? `<span class="streak">● ${week.length} ${week.length === 1 ? 'allenamento' : 'allenamenti'} negli ultimi 7 giorni</span>` : ''}
      <button class="cta" id="welcomeConnect">Collega il rullo</button>`;
  }
  $('welcomeConnect')?.addEventListener('click', () => $('connectTrainer').click());
}
trainer.addEventListener('connected', () => renderWelcome());
trainer.addEventListener('disconnected', () => renderWelcome());

setupDebug({ trainer, click, hrm, extra: [pm, garminDbg], appLog: () => $('log').textContent });
$('appVersion').textContent = `${isNative ? 'App Android' : 'Web'} · versione ${BUILD}`;

// ---------- Misuratore di potenza esterno ----------
state.usePm = localStorage.getItem('usePm') !== '0';
$('usePm').checked = state.usePm;
$('usePm').addEventListener('change', (e) => { state.usePm = e.target.checked; localStorage.setItem('usePm', state.usePm ? '1' : '0'); render(); });
$('connectPm').addEventListener('click', async () => {
  if (pm.connected) { pm.disconnect(); return; }
  try {
    setStatus('pmStatus', 'connessione…');
    const name = await pm.connect();
    setStatus('pmStatus', name, true);
    $('connectPm').textContent = 'Scollega';
    log(`Misuratore di potenza: ${name}`);
  } catch (err) { setStatus('pmStatus', 'non collegato'); log(`Errore misuratore: ${err.message}`); pm.dbg.log(`Errore: ${err.message}`); }
});
pm.addEventListener('data', (e) => {
  if (!state.usePm) return;
  const d = e.detail;
  state.data.power = d.power;
  if (d.cadence != null) { state.data.cadence = d.cadence; state.pmCadence = true; }
  render();
});
pm.addEventListener('disconnected', () => { state.pmCadence = false; setStatus('pmStatus', 'non collegato'); $('connectPm').textContent = 'Collega misuratore'; });

// ---------- Ponte verso Garmin (solo app Android) ----------
$('garminNative').hidden = !isNative;
$('garminWeb').hidden = isNative;
let garminTimer = null; let garminHintTimer = null; let lastGarminStatus = null; let conflictTimer = null;
// Un Garmin collegato al telefono (Garmin Connect) ma che non usa il sensore: quasi sempre è il
// motivo per cui resta su "Connecting". Lo segnaliamo con la guida illustrata.
async function checkGarminConflict() {
  if (!GarminBridge || !$('garminOn').checked) { $('garminBanner').hidden = true; $('garminConflict').hidden = true; return; }
  let names = [];
  try { names = (await GarminBridge.connectedDevices()).devices || []; } catch { /* plugin vecchio */ }
  if (lastGarminStatus?.devices) names.push(...lastGarminStatus.devices.split(', '));
  const users = (lastGarminStatus?.users || '').toLowerCase();
  const linked = [...new Set(names)].filter((n) => GARMIN_RE.test(n) && !users.includes(n.toLowerCase()));
  const show = linked.length > 0 && !(lastGarminStatus?.usersCount > 0);
  if (show) {
    const name = linked[0];
    const html = watchGuide(name);
    $('garminConflict').innerHTML = `<b>${name} è collegato al telefono con Garmin Connect.</b> Per usarlo come sensore scollegalo per un momento:${html}`;
    $('garminBanner').innerHTML = `<h2>Scollega ${name} dal telefono</h2><p>È collegato tramite Garmin Connect, quindi non riesce ad agganciare il sensore "RideFreedom".</p>${html}`;
  }
  $('garminConflict').hidden = !show;
  $('garminBanner').hidden = !show;
}
function pushGarmin() {
  const d = state.data;
  const speed = state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : d.speed || 0;
  const pedaling = (d.power || 0) > 0 || speed > 1;
  GarminBridge.update({ power: Math.round(d.power || 0), cadence: pedaling ? Math.round(currentCadence()) : 0, speedKmh: +speed.toFixed(2) }).catch(() => {});
}
async function setGarmin(on) {
  localStorage.setItem('garminOn', on ? '1' : '0');
  if (!GarminBridge) return;
  clearInterval(garminTimer);
  if (on) {
    try {
      await GarminBridge.start({ name: 'RideFreedom' });
      setStatus('garminStatus', 'in attesa del Garmin…');
      garminTimer = setInterval(pushGarmin, 500);
      garminDbg.dbg.setStatus('In attesa');
      clearInterval(conflictTimer); conflictTimer = setInterval(checkGarminConflict, 5000); setTimeout(checkGarminConflict, 1500);
      // se dopo un minuto nessuno usa il sensore, suggerisci la causa più probabile
      clearTimeout(garminHintTimer);
      garminHintTimer = setTimeout(() => { $('garminHint').hidden = false; }, 60000);
      log('Ponte Garmin attivo: il telefono è visibile come sensore di potenza "RideFreedom"');
    } catch (err) {
      setStatus('garminStatus', 'errore'); $('garminOn').checked = false; log(`Garmin: ${err.message}`);
    }
  } else {
    await GarminBridge.stop().catch(() => {});
    setStatus('garminStatus', 'spento');
    clearInterval(conflictTimer); checkGarminConflict();
  }
}
if (GarminBridge) {
  GarminBridge.addListener('status', (st) => {
    if (!$('garminOn').checked) return;
    // "connesso" non basta: il Garmin di solito è già connesso al telefono per Garmin Connect.
    // Il sensore è in uso solo quando un dispositivo si iscrive ai dati di potenza o velocità/cadenza.
    const inUse = (st.usersCount || 0) > 0;
    garminDbg.dbg.status = inUse ? 'Connesso (in uso)' : st.advertising ? 'In attesa' : st.running ? 'Avvio' : 'Spento';
    garminDbg.dbg.setValues({ visibile: !!st.advertising, connessi: st.connected || 0, dispositivi: st.devices || '-', inUso: st.users || '-' });
    if (inUse) { clearTimeout(garminHintTimer); $('garminHint').hidden = true; }
    lastGarminStatus = st; checkGarminConflict();
    setStatus('garminStatus', inUse ? `in uso: ${st.users}` : st.advertising ? 'in attesa del Garmin…' : st.running ? 'avvio…' : 'spento', inUse);
  });
  GarminBridge.addListener('error', (ev) => log(`Garmin: ${ev.message}`));
  GarminBridge.addListener('log', (ev) => { log(`Garmin · ${ev.message}`); garminDbg.dbg.log(ev.message); });
  $('garminOn').addEventListener('change', (e) => setGarmin(e.target.checked));
  if (localStorage.getItem('garminOn') === '1') { $('garminOn').checked = true; setGarmin(true); }
}

// ---------- Gioco ----------
let gradeBeforeGame = 0;
const progress = new Progress();
const gameHooks = {
  progress,
  connected: () => trainer.connected,
  speedKmh: () => (state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : state.data.speed || 0),
  stats: () => ({ power: Math.round(state.data.power || 0), cadence: Math.round(currentCadence()), gear: state.mode === 'gears' ? state.gear + 1 : null }),
  setGrade: (g) => {
    state.grade = g == null ? gradeBeforeGame : Math.max(-10, Math.min(15, g));
    syncInputs(); render(); applyMode(true);
  },
};
const gameAudio = new GameAudio();
// sblocco dell'audio al primo tocco (WebView e browser lo tengono sospeso finché l'utente non interagisce)
const unlockAudio = () => {
  const c = gameAudio.ensure();
  if (c) { const b = c.createBuffer(1, 1, 22050); const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); }
};
// resta in ascolto finché il contesto non è davvero attivo (Android lo sospende anche quando l'app va in background)
for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, () => { if (gameAudio.ctx?.state !== 'running') unlockAudio(); }, { capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && gameAudio.ctx?.state !== 'running') gameAudio.ctx?.resume().catch(() => {}); });
$('audioTest').addEventListener('click', async () => {
  const out = [];
  try {
    const c = gameAudio.ensure();
    if (!c) { $('audioResult').textContent = 'Web Audio non disponibile in questo browser.'; return; }
    out.push(`stato iniziale: ${c.state}`);
    if (c.state !== 'running') await c.resume().catch((e) => out.push(`resume: ${e.message}`));
    out.push(`stato: ${c.state} · ${c.sampleRate} Hz`);
    if (gameAudio.muted) out.push('ATTENZIONE: audio dei giochi disattivato (pulsante Audio nei giochi)');
    gameAudio.sfx('pickup');
    const t0 = c.currentTime;
    await new Promise((r) => setTimeout(r, 600));
    out.push(c.currentTime > t0 ? 'orologio audio in movimento: OK' : 'orologio audio fermo: il sistema blocca l\'audio');
    const nJ = Object.keys(gameAudio.jingles || {}).length;
    out.push(`jingle caricati: ${nJ}/9`);
    if (nJ) setTimeout(() => gameAudio.jingle('win'), 200);
    out.push('Senti una scala di note e poi un jingle? Se no, alza il volume multimediale del telefono.');
  } catch (err) { out.push(`errore: ${err.message}`); }
  $('audioResult').textContent = out.join(' · ');
  log(`Test audio: ${out.join(' | ')}`);
});
const games = {
  horde: { game: new Horde($('gameCanvas'), gameHooks, gameAudio), title: "L'Orda", help: '+ / − corsia · watt = colpi · sprint = overdrive' },
  racer: { game: new Racer3D($('gameCanvas'), gameHooks, gameAudio), title: 'Turbo Pedali 3D', help: '+ destra · − sinistra · sprint = oggetto' },
  shooter: { game: new Strike3D($('gameCanvas'), gameHooks, gameAudio), title: 'Pedal Strike', help: '+ salta · − bomba · sprint = OVERDRIVE' },
};
let activeGame = null;

function openGame() {
  $('gamePanel').hidden = false;
  $('gameMenu').hidden = false;
  progress.renderMenu($('progressPanel'));
  $('gameTitle').textContent = 'Giochi';
  $('gameHelp').textContent = '';
  document.body.classList.add('game-open');
}
function startGame(kind) {
  const g = games[kind];
  gameAudio.ensure(); // l'audio va sbloccato da un tocco dell'utente
  gradeBeforeGame = state.grade;
  // il gioco controlla la pendenza: serve la modalità Cambio o Pendenza
  if (state.mode !== 'gears' && state.mode !== 'sim') {
    document.querySelector('[name=mode][value=gears]').checked = true;
    state.mode = 'gears'; document.body.dataset.mode = 'gears'; state.lastSent = null;
  }
  if (trainer.connected && !state.ride.running) $('startStop').click();
  $('gameMenu').hidden = true;
  $('gameTitle').textContent = g.title;
  $('gameHelp').textContent = g.help;
  requestWakeLock();
  activeGame = g.game;
  activeGame.start();
}
function closeGame() {
  if (activeGame) { // dal gioco si torna al menu, dal menu si esce
    activeGame.stop();
    activeGame = null;
    openGame();
    return;
  }
  $('gamePanel').hidden = true;
  document.body.classList.remove('game-open');
}
document.querySelectorAll('.game-card').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.game)));
$('openGame').addEventListener('click', openGame);
$('closeGame').addEventListener('click', closeGame);
$('muteGame').textContent = gameAudio.muted ? 'Audio no' : 'Audio sì';
$('muteGame').addEventListener('click', () => { $('muteGame').textContent = gameAudio.toggleMute() ? 'Audio no' : 'Audio sì'; });
$('gameCanvas').addEventListener('pointerdown', (e) => {
  if (!activeGame?.active) return;
  const r = e.currentTarget.getBoundingClientRect();
  activeGame.input(e.clientX - r.left < r.width / 2 ? -1 : +1);
});
// ---------- Strava ----------
const strava = new Strava(STRAVA_PROXY);
let stravaBusy = false;
function stravaMsg(text, html = false) { for (const id of ['stravaMsg', 'stravaNote']) $(id)[html ? 'innerHTML' : 'textContent'] = text; }
function renderStrava() {
  $('stravaSite').textContent = location.origin;
  $('stravaDomain').textContent = location.hostname;
  $('stravaId').value = strava.cfg.clientId || '';
  $('stravaSecret').value = strava.cfg.clientSecret || '';
  $('stravaSetup').hidden = strava.connected || strava.publicMode;
  $('stravaPublic').hidden = strava.connected || !strava.publicMode;
  $('stravaLinked').hidden = !strava.connected;
  $('stravaAuto').checked = !!strava.cfg.auto;
  $('uploadStrava').hidden = !strava.connected;
  setStatus('stravaStatus', strava.connected ? `collegato${strava.athlete ? ` · ${strava.athlete}` : ''}` : 'non collegato', strava.connected);
}
$('stravaConnect').addEventListener('click', () => {
  const id = $('stravaId').value.trim(); const secret = $('stravaSecret').value.trim();
  if (!/^\d+$/.test(id) || secret.length < 20) { stravaMsg('Controlla Client ID (solo numeri) e Client Secret (stringa lunga).'); return; }
  strava.setCredentials(id, secret);
  persist();
  strava.authorize().catch((err) => stravaMsg(`Errore: ${err.message}`));
});
$('stravaPublicConnect').addEventListener('click', async () => {
  persist();
  try { await strava.authorize(); } catch (err) { stravaMsg(`Errore: ${err.message}`); }
});
$('stravaDisconnect').addEventListener('click', () => { strava.disconnect(); renderStrava(); stravaMsg('Strava scollegato.'); });
$('stravaAuto').addEventListener('change', (e) => { strava.cfg.auto = e.target.checked; strava.save(); });

async function uploadToStrava() {
  const r = state.ride;
  if (!r.log.length || stravaBusy) return;
  if (r.stravaUrl) { stravaMsg(`Già caricato: <a href="${r.stravaUrl}" target="_blank" rel="noopener">apri su Strava</a>`, true); return; }
  stravaBusy = true; render();
  try {
    const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
    const res = await strava.upload(fitFile(), {
      name: `Rullo · ${fmtTime(r.elapsed)} · ${avgW} W`,
      description: `Allenamento sul rullo con Ride Freedom. Potenza media ${avgW} W, ${Math.round(r.energy)} kJ, ${(r.distance / 1000).toFixed(1)} km.`,
      externalId: `ridefreedom-${r.log[0].t}`,
    }, (m) => stravaMsg(m));
    r.saved = true;
    if (res.url) { r.stravaUrl = res.url; stravaMsg(`${res.message} <a href="${res.url}" target="_blank" rel="noopener">Apri l'attività</a>`, true); }
    else stravaMsg(res.message);
    persist();
    log(res.message);
  } catch (err) {
    stravaMsg(`Errore Strava: ${err.message}. Il file .FIT resta disponibile con "Salva .FIT".`);
    log(`Errore Strava: ${err.message}`);
  } finally { stravaBusy = false; render(); }
}
$('uploadStrava').addEventListener('click', uploadToStrava);
$('finishRide').addEventListener('click', () => {
  const r = state.ride;
  if (r.running) $('startStop').click(); // pausa
  const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  $('finishSummary').innerHTML = [['Tempo', fmtTime(r.elapsed)], ['km', (r.distance / 1000).toFixed(2)], ['W medi', avgW], ['kJ', Math.round(r.energy)]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  // il "picco" e la "fine": celebrare, confrontare, invitare a tornare
  const hist = history();
  const prev = hist[hist.length - 1];
  if (!r.historySaved && r.elapsed >= 60) {
    hist.push({ t: Date.now(), dur: Math.round(r.elapsed), km: +(r.distance / 1000).toFixed(2), avgW, kj: Math.round(r.energy) });
    saveHistory(hist.slice(-60)); r.historySaved = true; persist();
  }
  const week = hist.filter((h) => Date.now() - h.t < 7 * 864e5).length;
  const mins = Math.round(r.elapsed / 60);
  $('finishTitle').textContent = mins >= 60 ? 'Che giro!' : mins >= 30 ? 'Ottimo lavoro!' : r.elapsed >= 60 ? 'Fatto!' : 'Allenamento finito';
  $('finishPraise').textContent = r.elapsed >= 60 ? `${mins} minuti in sella, ${Math.round(r.energy)} kJ di lavoro. ${week > 1 ? `È il tuo ${week}° allenamento questa settimana.` : 'Ottimo inizio di settimana.'}` : '';
  $('finishCompare').textContent = prev && r.elapsed >= 60 && prev.avgW ? (avgW > prev.avgW ? `+${avgW - prev.avgW} W medi rispetto all'ultima volta` : avgW === prev.avgW ? 'Stessa potenza media dell\'ultima volta: costanza!' : '') : '';
  $('finishNudge').textContent = 'Domani ti aspettano nuove sfide nei giochi. Ci vediamo in sella.';
  $('stravaMsg').innerHTML = r.stravaUrl
    ? `Già su Strava. <a href="${r.stravaUrl}" target="_blank" rel="noopener">Apri l'attività</a>`
    : strava.connected ? '' : 'Collega Strava dalle impostazioni per caricare in automatico.';
  openSheet('finishSheet');
  if (strava.connected && strava.cfg.auto && !r.stravaUrl) uploadToStrava();
});
strava.handleRedirect().then((res) => {
  if (res) { stravaMsg(res.message); log(res.message); openSheet('settingsSheet'); }
  renderStrava();
}).catch((err) => { stravaMsg(`Errore collegamento Strava: ${err.message}`); renderStrava(); });
renderStrava();

restore();
renderWelcome();
syncInputs();
document.body.dataset.mode = state.mode;
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
