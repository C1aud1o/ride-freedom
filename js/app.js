import { Trainer } from './ftms.js';
import { ZwiftClick } from './click.js';
import { GEARS, virtualSpeed, powerForSpeed } from './gears.js';
import { HeartRate } from './hr.js';
import { encodeFit } from './fit.js';
import { setupDebug } from './debugview.js';
import { Game } from './game.js';
import { Shooter } from './shooter.js';

const $ = (id) => document.getElementById(id);
const trainer = new Trainer();
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
  $('connectTrainer').textContent = 'Disconnetti';
  log(`Funzioni: ERG ${features.power ? '✓' : '✗'} · Pendenza ${features.simulation ? '✓' : '✗'} · Resistenza ${features.resistance ? '✓' : '✗'}`);
  if (!trainer.controllable) log('Il rullo è in sola lettura (nessun controllo resistenza).');
  state.lastSent = null;
  applyMode(true);
});
trainer.addEventListener('disconnected', async () => {
  setStatus('trainerStatus', 'Disconnesso');
  $('connectTrainer').textContent = 'Connetti rullo';
  log('Rullo disconnesso');
});
trainer.addEventListener('log', (e) => log(e.detail));
trainer.addEventListener('data', (e) => {
  const d = { ...e.detail };
  if (state.hrFromSensor) delete d.hr; // la fascia/orologio ha la precedenza
  Object.assign(state.data, d);
  render();
});

$('connectClick').addEventListener('click', async () => {
  if (click.device?.gatt?.connected) { click.disconnect(); return; }
  try {
    setStatus('clickStatus', 'Connessione…');
    const name = await click.connect();
    setStatus('clickStatus', name, true);
    $('connectClick').textContent = 'Disconnetti Click';
    log(`Connesso a ${name} (sperimentale)`);
  } catch (err) {
    setStatus('clickStatus', 'Non connesso');
    log(`Errore Click: ${err.message}`);
    click.dbg.log(`Errore: ${err.message}`);
  }
});
click.addEventListener('disconnected', () => {
  setStatus('clickStatus', 'Non connesso');
  $('connectClick').textContent = 'Connetti Zwift Click';
});
click.addEventListener('shift', (e) => (activeGame?.active ? activeGame.input(e.detail) : shift(e.detail)));

$('connectHr').addEventListener('click', async () => {
  if (hrm.connected) { hrm.disconnect(); return; }
  try {
    setStatus('hrStatus', 'Connessione…');
    const name = await hrm.connect();
    state.hrFromSensor = true;
    setStatus('hrStatus', name, true);
    $('connectHr').textContent = 'Disconnetti cardio';
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
  $('connectHr').textContent = 'Connetti cardio';
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
}

// Calcola il target per la modalità corrente
// Cadenza (rpm) usata dal cambio virtuale.
// Il D100 non trasmette la cadenza nei dati FTMS. Con lo Zwift Cog la trasmissione reale
// è fissa, quindi la velocità del volano è proporzionale alla pedalata: la stimiamo.
// 7.37 rpm per km/h viene dai dati del D100 (campo extra ≈ cadenza×10 = velocità×7.37).
const RPM_PER_KMH = 7.37;
function currentCadence() {
  if (trainer.hasCadence) return state.cadenceSmooth;
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
});
$('reset').addEventListener('click', () => {
  if (!state.ride.saved && !confirm('Azzerare la sessione? I dati non salvati in .FIT andranno persi.')) return;
  Object.assign(state.ride, { running: false, elapsed: 0, distance: 0, energy: 0, powerSum: 0, samples: 0, log: [], saved: true });
  persist();
  $('startStop').textContent = 'Avvia';
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
  }
  if (state.mode === 'gears') applyMode();
  render();
}, 1000);

// ---------- Render ----------
function render() {
  const d = state.data; const r = state.ride;
  $('power').textContent = Math.round(d.power || 0);
  $('cadence').textContent = trainer.hasCadence ? Math.round(d.cadence || 0) : trainer.connected ? `~${Math.round(currentCadence())}` : '0';
  const speed = state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : d.speed || 0;
  $('speed').textContent = speed.toFixed(1);
  $('hr').textContent = d.hr ? d.hr : '--';
  $('time').textContent = fmtTime(r.elapsed);
  $('distance').textContent = (r.distance / 1000).toFixed(2);
  $('avgPower').textContent = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  $('kj').textContent = Math.round(r.energy);
  $('saveFit').disabled = !r.log.length;
  $('shareFit').disabled = !r.log.length;

  $('gearNum').textContent = state.gear + 1;
  $('gearRatio').textContent = GEARS[state.gear].toFixed(2);
  $('gearBar').style.width = `${((state.gear + 1) / GEARS.length) * 100}%`;
  $('gradeVal').textContent = `${state.grade.toFixed(1)} %`;
  $('ergVal').textContent = `${state.erg} W`;
  $('resVal').textContent = `${state.resistance} %`;

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
      powerSum: r.powerSum, samples: r.samples, log: r.log, saved: r.saved }));
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

setupDebug({ trainer, click, hrm, appLog: () => $('log').textContent });

// ---------- Gioco ----------
let gradeBeforeGame = 0;
const gameHooks = {
  connected: () => trainer.connected,
  speedKmh: () => (state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : state.data.speed || 0),
  stats: () => ({ power: Math.round(state.data.power || 0), gear: state.mode === 'gears' ? state.gear + 1 : null }),
  setGrade: (g) => {
    state.grade = g == null ? gradeBeforeGame : Math.max(-10, Math.min(15, g));
    syncInputs(); render(); applyMode(true);
  },
};
const games = {
  racer: { game: new Game($('gameCanvas'), gameHooks), title: 'Turbo Pedali', help: '+ destra · − sinistra (o tocca i lati)' },
  shooter: { game: new Shooter($('gameCanvas'), gameHooks), title: 'Pedal Strike', help: '+ salta · − bomba · più watt = più colpi' },
};
let activeGame = null;

function openGame() {
  $('gamePanel').hidden = false;
  $('gameMenu').hidden = false;
  $('gameTitle').textContent = 'Giochi';
  $('gameHelp').textContent = '';
  document.body.classList.add('game-open');
}
function startGame(kind) {
  const g = games[kind];
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
  activeGame?.stop();
  activeGame = null;
  $('gamePanel').hidden = true;
  document.body.classList.remove('game-open');
}
document.querySelectorAll('.game-card').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.game)));
$('openGame').addEventListener('click', openGame);
$('closeGame').addEventListener('click', closeGame);
$('gameCanvas').addEventListener('pointerdown', (e) => {
  if (!activeGame?.active) return;
  const r = e.currentTarget.getBoundingClientRect();
  activeGame.input(e.clientX - r.left < r.width / 2 ? -1 : +1);
});
restore();
syncInputs();
document.body.dataset.mode = state.mode;
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
