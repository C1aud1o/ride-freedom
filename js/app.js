import { isNative, GarminBridge } from './native.js'; // per primo: nell'app installa il Bluetooth nativo
import { Trainer } from './ftms.js';
import { PowerMeter } from './powermeter.js';
import { SensorDebug } from './debug.js';
import { BUILD } from './build.js';
import { watchGuide, GARMIN_RE } from './watchguide.js';
import { ZwiftClick } from './click.js';
import { GEARS, virtualSpeed, powerForSpeed } from './gears.js';
import { HeartRate } from './hr.js';
import { encodeFit, encodeWorkoutFit, encodeZwo } from './fit.js';
import { Strava } from './strava.js';
import { STRAVA_PROXY } from './config.js';
import { setupDebug } from './debugview.js';
import { Strike3D } from './games/strike3d.js';
import { Racer3D } from './games/racer3d.js';
import { Horde } from './games/horde.js';
import { Gruppetto } from './games/gruppetto.js';
import { Mattoni } from './games/mattoni.js';
import { Planata } from './games/planata.js';
import { VideoRide } from './videoride.js';
import { rideStats, renderHistory } from './history.js';
import { shareCard } from './sharecard.js';
import { WorkoutEditor } from './editor.js';
import './ui.js';
import { coach, spokenTime } from './coach.js';
import { parseGpx, at as routeAt, SAMPLES as ROUTES, drawElevation, drawMap } from './route.js';
import { WORKOUTS, WorkoutRunner, drawProfile, duration, tss, fmtTime as fmtClock, parseZwo } from './workouts.js';
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
click.addEventListener('shift', (e) => (activeGame?.active ? activeGame.input(e.detail) : step(e.detail)));
click.addEventListener('hold', (e) => {
  if (activeGame?.active) activeGame.hold?.(e.detail);
  // pressione lunga = comandi musica (solo app Android): annulla il cambio fatto dalla pressione breve
  clearTimeout(mediaTimer);
  const d = e.detail;
  if (d && GarminBridge && $('musicOn').checked && !(activeGame?.active && activeGame.hold)) {
    mediaTimer = setTimeout(() => {
      if (activeGame?.active) activeGame.input(-d); else step(-d);
      GarminBridge.mediaKey({ key: d > 0 ? 'next' : 'playpause' }).then(() => toast(d > 0 ? 'Brano successivo' : 'Play / pausa')).catch((err) => log(`Musica: ${err.message}`));
    }, 800);
  }
});
let mediaTimer = null;
if (GarminBridge) {
  $('musicNative').hidden = false; $('musicWeb').hidden = true;
  $('musicOn').checked = localStorage.getItem('musicOn') === '1';
  $('musicOn').addEventListener('change', () => localStorage.setItem('musicOn', $('musicOn').checked ? '1' : '0'));
}

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
  if (workout && !workout.w.test) { // durante un allenamento + / − regolano l'intensità
    workout.bias = Math.min(1.5, Math.max(0.5, +(workout.bias + dir * 0.05).toFixed(2)));
    toast(`Intensità ${Math.round(workout.bias * 100)}%`); tickWorkout(0); return;
  }
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
const keyDir = (k) => (['ArrowRight', 'ArrowUp', 'PageUp', '+', '=', ' ', 'd', 'D'].includes(k) ? 1 : ['ArrowLeft', 'ArrowDown', 'PageDown', '-', 'a', 'A'].includes(k) ? -1 : 0);
window.addEventListener('keyup', (e) => { if (activeGame?.active && keyDir(e.key)) activeGame.hold?.(0); });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (activeGame?.active) {
    const d = keyDir(e.key);
    if (d) { e.preventDefault(); if (!e.repeat) { activeGame.input(d); activeGame.hold?.(d); } }
    if (e.key === 'Escape') closeGame();
    return;
  }
  if (['ArrowUp', 'ArrowRight', 'PageUp', '+', '='].includes(e.key)) { e.preventDefault(); step(+1); }
  if (['ArrowDown', 'ArrowLeft', 'PageDown', '-'].includes(e.key)) { e.preventDefault(); step(-1); }
  // scorciatoie da PC (solo se nessun pannello è aperto e non si sta scrivendo)
  if (e.target.tagName === 'TEXTAREA' || document.querySelector('.sheet:not([hidden])') || !$('gamePanel').hidden) return;
  if (e.key === ' ' && !e.repeat) { e.preventDefault(); $('startStop').click(); }
  if ((e.key === 'g' || e.key === 'G') && !e.repeat) openGame();
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
    if (route) tickRoute(speedMs, r.log[r.log.length - 1]);
    if (r.log.length % 10 === 0) persist();
    // piccoli picchi: traguardi durante la pedalata
    const m = Math.floor(r.elapsed / 600);
    if (m > (r.lastMilestone || 0)) { r.lastMilestone = m; toast(`${m * 10} minuti! Continua così`); if (!workout) coach.say(`${m * 10} minuti. Continua così!`); }
    const k5 = Math.floor(r.distance / 5000);
    if (k5 > (r.lastKm || 0)) { r.lastKm = k5; toast(`${k5 * 5} km percorsi`); }
  }
  if (state.mode === 'gears') applyMode();
  if (workout && r.running) tickWorkout(1);
  if (r.running) autoShiftTick();
  powerBuf.push(d.power || 0); if (powerBuf.length > 3) powerBuf.shift();
  autoPauseCheck();
  render();
}, 1000);

// ---------- Allenamenti strutturati ----------
let workout = null; let wkLast = null; let wkPower = []; let wkLowCad = 0;
function setMode(m) {
  document.querySelector(`[name=mode][value=${m}]`).checked = true;
  state.mode = m; document.body.dataset.mode = m; state.lastSent = null;
}
function customWorkouts() { try { return JSON.parse(localStorage.getItem('customWorkouts') || '[]'); } catch { return []; } }
function allWorkouts() { return [...customWorkouts(), ...WORKOUTS]; }
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderWorkoutList() {
  $('wkFtp').textContent = state.ftp;
  $('workoutList').innerHTML = `<div class="row2 wk-top"><button class="cta-sm" id="wkNew">Crea allenamento</button><label class="ghost file-btn">Importa .zwo<input id="zwoFile" type="file" accept=".zwo,application/xml,text/xml" hidden></label></div>` + allWorkouts().map((w) => `<div class="wk-wrap"><button class="wk-item" data-wk="${w.id}">
    <span class="row"><b>${escHtml(w.name)}</b><small>${escHtml(w.tag)}${tss(w) ? ` · carico ${tss(w)}` : ''}</small></span>
    <canvas data-prof="${w.id}"></canvas><small>${escHtml(w.desc)}</small></button>
    <span class="wk-tools">${w.test ? '' : `<button class="link" data-edit="${w.id}">${w.custom ? 'Modifica' : 'Copia e modifica'}</button><button class="link" data-fit="${w.id}">Garmin (.FIT)</button><button class="link" data-zwo="${w.id}">.zwo</button>`}${w.custom ? `<button class="link" data-del="${w.id}">Elimina</button>` : ''}</span></div>`).join('');
  const all = allWorkouts();
  requestAnimationFrame(() => document.querySelectorAll('[data-prof]').forEach((c) => drawProfile(c, all.find((w) => w.id === c.dataset.prof), state.ftp)));
  document.querySelectorAll('[data-wk]').forEach((b) => b.addEventListener('click', () => startWorkout(all.find((w) => w.id === b.dataset.wk))));
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Eliminare questo allenamento importato?')) return;
    localStorage.setItem('customWorkouts', JSON.stringify(customWorkouts().filter((w) => w.id !== b.dataset.del))); renderWorkoutList();
  }));
  $('wkNew').addEventListener('click', () => openEditor(null));
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(all.find((w) => w.id === b.dataset.edit))));
  const safeName = (w) => w.name.replace(/[^\w\-àèéìòù ]+/gi, '').trim().replace(/\s+/g, '-') || 'allenamento';
  document.querySelectorAll('[data-fit]').forEach((b) => b.addEventListener('click', () => {
    const w = all.find((x) => x.id === b.dataset.fit);
    offerFile(new File([encodeWorkoutFit(w.name, w.steps, state.ftp)], `${safeName(w)}.fit`, { type: 'application/vnd.ant.fit' }), 'Copialo sull\'orologio in GARMIN/NewFiles (USB) oppure importalo su intervals.icu');
  }));
  document.querySelectorAll('[data-zwo]').forEach((b) => b.addEventListener('click', () => {
    const w = all.find((x) => x.id === b.dataset.zwo);
    offerFile(new File([encodeZwo(w.name, w.steps, state.ftp, w.desc)], `${safeName(w)}.zwo`, { type: 'application/xml' }), 'Importalo su intervals.icu, TrainingPeaks o Zwift');
  }));
  $('zwoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const w = parseZwo(await f.text(), f.name);
      localStorage.setItem('customWorkouts', JSON.stringify([w, ...customWorkouts()].slice(0, 30)));
      toast(`Importato: ${w.name}`); renderWorkoutList();
    } catch (err) { toast(`Import non riuscito: ${err.message}`); }
  });
}
$('openWorkouts').addEventListener('click', () => { renderWorkoutList(); renderRoutePick(); openSheet('workoutSheet'); });

// ---------- Percorsi GPX ----------
let route = null; let routeDist = 0; let routeT = 0; let routeTrace = []; let routeGhost = null;
const ghostKey = (rt) => `ghost:${rt.name}:${Math.round(rt.total)}`;
function ghostTimeAt(dist) { // secondi impiegati dal record per arrivare a quella distanza
  const g = routeGhost; if (!g) return null;
  const i = g.findIndex((d) => d >= dist); if (i < 0) return null; if (i === 0) return 0;
  return (i - 1 + (dist - g[i - 1]) / Math.max(0.1, g[i] - g[i - 1])) * 5;
} let routeRealism = Number(localStorage.getItem('routeRealism')) || 0.5;
function renderRoutePick() {
  $('routeSamples').innerHTML = ROUTES.map((r) => `<button class="wk-item" data-route="${r.id}"><span class="row"><b>${r.name}</b><small>prova</small></span><small>${r.desc}</small></button>`).join('');
  document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => startRoute(ROUTES.find((r) => r.id === b.dataset.route).make())));
  document.querySelectorAll('#routeReal button').forEach((b) => b.classList.toggle('on', +b.dataset.r === routeRealism));
}
document.querySelectorAll('#routeReal button').forEach((b) => b.addEventListener('click', () => {
  routeRealism = +b.dataset.r; localStorage.setItem('routeRealism', routeRealism); renderRoutePick();
}));
$('gpxFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { startRoute(parseGpx(await f.text(), f.name)); } catch (err) { toast(err.message); }
  e.target.value = '';
});
function startRoute(rt) {
  if (workout) finishWorkout(false);
  route = rt; routeDist = 0; routeT = 0; routeTrace = [0];
  try { routeGhost = JSON.parse(localStorage.getItem(ghostKey(rt)) || 'null'); } catch { routeGhost = null; }
  if (state.mode !== 'gears' && state.mode !== 'sim') setMode('gears');
  closeSheet('workoutSheet');
  document.body.classList.add('in-route');
  $('routeCard').hidden = false; $('rtName').textContent = rt.name;
  if (!rt.hasEle) toast('Il GPX non ha le quote: percorso in piano');
  if (!state.ride.running) $('startStop').click();
  tickRoute(0, null);
}
function tickRoute(dm, sample) {
  routeDist += dm;
  if (dm || sample) { routeT += 1; if (routeT % 5 === 0) routeTrace.push(Math.round(routeDist)); }
  const c = routeAt(route, routeDist);
  if (sample) Object.assign(sample, { lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6), ele: +c.ele.toFixed(1) });
  const g = Math.round(c.grade * routeRealism * 2) / 2;
  if (dm) { // annuncia la prossima salita vera (una volta per salita)
    const ahead = routeAt(route, routeDist + 300);
    if (ahead.grade >= 4 && c.grade < 3 && routeDist - (route.lastClimbSaid ?? -1e9) > 800) { route.lastClimbSaid = routeDist; coach.say(`Salita in arrivo: ${Math.round(ahead.grade)} per cento tra 300 metri.`); }
  }
  if (g !== state.grade) { state.grade = g; syncInputs(); applyMode(true); }
  $('rtGrade').textContent = c.grade.toFixed(1);
  $('rtKm').textContent = `${(routeDist / 1000).toFixed(2)} / ${(route.total / 1000).toFixed(1)} km`;
  const gt = ghostTimeAt(routeDist);
  const vs = gt != null && routeT > 10 ? routeT - gt : null;
  $('rtInfo').innerHTML = vs != null
    ? `Contro il tuo record: <b class="${vs <= 0 ? 'ahead' : 'behind'}">${vs <= 0 ? '−' : '+'}${fmtClock(Math.abs(vs))}</b> · quota ${Math.round(c.ele)} m`
    : `${route.gain} m di dislivello · quota ${Math.round(c.ele)} m${routeRealism < 1 ? ` · pendenza al ${routeRealism * 100}%` : ''}${routeGhost ? ' · record da battere' : ''}`;
  drawElevation($('rtProfile'), route, routeDist); drawMap($('rtMap'), route, routeDist);
  if (routeDist >= route.total) {
    coach.say(`Arrivo! ${route.name} completato in ${spokenTime(routeT)}.`);
    routeTrace.push(Math.round(route.total));
    const prevT = routeGhost ? (routeGhost.length - 1) * 5 : Infinity;
    if (routeT < prevT) { try { localStorage.setItem(ghostKey(route), JSON.stringify(routeTrace)); } catch { /* pieno */ } toast(routeGhost ? `Nuovo record: ${fmtClock(routeT)} (−${fmtClock(prevT - routeT)})` : `Tempo: ${fmtClock(routeT)}. La prossima volta sfidi questo record!`); }
    else toast(`Arrivo in ${fmtClock(routeT)}: record ${fmtClock(prevT)}`); gameAudio.sfx('win'); progress.event('routes', 1, 60); stopRoute(); }
}
let lastRouteName = null;
function stopRoute() { lastRouteName = route?.name || lastRouteName; route = null; $('routeCard').hidden = true; document.body.classList.remove('in-route'); state.grade = 0; syncInputs(); applyMode(true); }
$('rtStop').addEventListener('click', () => { if (confirm('Terminare il percorso?')) stopRoute(); });
function startWorkout(w) {
  if (route) stopRoute();
  if (workout && !confirm(`Interrompere "${workout.w.name}"?`)) return;
  workout = new WorkoutRunner(w, state.ftp); wkLast = null; wkPower = []; wkLowCad = 0;
  setMode('erg');
  closeSheet('workoutSheet');
  document.body.classList.add('in-workout');
  $('workoutCard').hidden = false; $('wkName').textContent = w.name; $('wkTotal').textContent = fmtClock(duration(w));
  if (!state.ride.running) $('startStop').click();
  if (!trainer.connected) toast('Collega il rullo: l\'allenamento parte comunque');
  tickWorkout(0);
}
function tickWorkout(dt) {
  if (!workout) return;
  const st = workout.tick(dt);
  if (!st) return finishWorkout(true);
  if (state.erg !== st.target) { state.erg = Math.min(MAX_W, st.target); syncInputs(); render(); applyMode(true); }
  if (wkLast !== st.i) {
    coach.say(`${st.x.label.replace(/(\d+)\/(\d+)/, '$1 di $2')}. ${st.target} watt per ${spokenTime(st.x.d)}.`);
  }
  if (dt && st.next && Math.round(st.left) === 10 && st.x.d >= 40) coach.say(`Ultimi dieci secondi. Poi ${st.nextW} watt.`);
  if (wkLast !== null && wkLast !== st.i) { toast(`${st.x.label}: ${st.target} W`); gameAudio.sfx('go'); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); }
  if (dt && st.next && st.left <= 3.5 && st.left > 0.5) gameAudio.sfx('beep');
  wkLast = st.i;
  $('wkStep').textContent = st.x.label; $('wkTarget').textContent = st.target; $('wkLeft').textContent = fmtClock(st.left);
  $('wkNext').textContent = st.next ? `Poi: ${st.next.label} a ${st.nextW} W` : 'Ultimo tratto!';
  $('wkTotal').textContent = `${fmtClock(workout.t)} / ${fmtClock(workout.total)}`;
  $('wkBias').textContent = workout.w.test ? 'Test: vai fino al limite' : workout.bias !== 1 ? `intensità ${Math.round(workout.bias * 100)}%` : '+ / − regolano l\'intensità';
  drawProfile($('wkProfile'), workout.w, state.ftp, workout.t);
  // test a rampa: finisce quando non riesci più a tenere il ritmo
  if (workout.w.test && dt) {
    wkPower.push(state.data.power || 0);
    wkLowCad = st.i > 0 && currentCadence() < 40 ? wkLowCad + dt : 0;
    if (wkLowCad >= 8) finishWorkout(true);
  }
}
function finishWorkout(completed) {
  const w = workout?.w; if (!w) return;
  workout = null; $('workoutCard').hidden = true; document.body.classList.remove('in-workout');
  if (w.test) {
    let best = 0;
    for (let i = 60; i <= wkPower.length; i++) best = Math.max(best, wkPower.slice(i - 60, i).reduce((a, b) => a + b, 0) / 60);
    if (best > 80) {
      const ftp = Math.round(best * 0.75);
      if (confirm(`Miglior minuto: ${Math.round(best)} W. La tua FTP stimata è ${ftp} W (prima ${state.ftp} W). Salvarla?`)) {
        state.ftp = ftp; $('ftp').value = ftp; localStorage.setItem('ftp', ftp); toast(`FTP aggiornata: ${ftp} W`);
      }
    } else toast('Test troppo breve per stimare la FTP');
    state.erg = Math.round(state.ftp * 0.5); syncInputs(); applyMode(true);
    return;
  }
  if (completed) { coach.say(`${w.name} completato. Grande lavoro!`); toast(`${w.name} completato!`); gameAudio.sfx('win'); progress.event('workouts', 1, 50); }
}
$('wkSkip').addEventListener('click', () => { workout?.skip(); tickWorkout(0); });
$('wkStop').addEventListener('click', () => { if (workout?.w.test) finishWorkout(true); else if (confirm('Terminare l\'allenamento?')) finishWorkout(false); });

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
  $('power').textContent = Math.round($('smooth3').checked && powerBuf.length ? powerBuf.reduce((a, b) => a + b, 0) / powerBuf.length : d.power || 0);
  $('cadence').textContent = hasRealCadence() ? Math.round(d.cadence || 0) : trainer.connected ? `~${Math.round(currentCadence())}` : '0';
  const speed = state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : d.speed || 0;
  $('speed').textContent = speed.toFixed(1);
  $('hr').textContent = d.hr ? d.hr : '--';
  const hz = d.hr ? hrZone(d.hr) : null;
  $('hrZone').textContent = hz ? `Z${hz.z} ${hz.name}` : ''; $('hrZone').style.color = hz?.color || '';
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
function saveHistory(h) {
  // se lo spazio finisce, si tengono le serie solo delle uscite più recenti
  for (let keep = h.length; keep >= 0; keep -= 20) {
    try { localStorage.setItem('rideHistory', JSON.stringify(h.map((x, i) => (i < h.length - keep ? { ...x, series: undefined } : x)))); return; } catch { /* pieno */ }
  }
}
function openHistory() {
  renderHistory($('historyBody'), history(), state.ftp);
  $('hsUseFtp')?.addEventListener('click', (e) => { state.ftp = +e.target.dataset.ftp; $('ftp').value = state.ftp; localStorage.setItem('ftp', state.ftp); toast(`FTP: ${state.ftp} W`); openHistory(); });
  for (const id of ['settingsSheet', 'finishSheet']) closeSheet(id);
  openSheet('historySheet');
}
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
      ${goalHtml(hist)}
      ${week.length ? `<span class="streak">● ${week.length} ${week.length === 1 ? 'allenamento' : 'allenamenti'} negli ultimi 7 giorni</span>` : ''}
      <button class="cta" id="welcomeConnect">Collega il rullo</button>
      <button class="ghost" id="welcomeHistory">Storico e record</button>`;
  }
  $('welcomeConnect')?.addEventListener('click', () => $('connectTrainer').click());
  $('welcomeHistory')?.addEventListener('click', openHistory);
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
  shift: (d) => shift(d),
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
  horde: { game: new Horde($('gameCanvas'), gameHooks, gameAudio), title: "L'Orda", help: 'tieni + / − per sterzare · watt = colpi · sprint = overdrive' },
  racer: { game: new Racer3D($('gameCanvas'), gameHooks, gameAudio), title: 'Turbo Pedali 3D', help: '+ destra · − sinistra · sprint = oggetto' },
  shooter: { game: new Strike3D($('gameCanvas'), gameHooks, gameAudio), title: 'Pedal Strike', help: '+ salta · − bomba · sprint = OVERDRIVE' },
  gruppetto: { game: new Gruppetto($('gameCanvas'), gameHooks, gameAudio), title: 'Gruppetto', help: '+ destra · − sinistra · tieni premuto per curvare' },
  mattoni: { game: new Mattoni($('gameCanvas'), gameHooks, gameAudio), title: 'Mattoni', help: 'tieni + / − per muoverti · cadenza = velocità palla' },
  planata: { game: new Planata($('gameCanvas'), gameHooks, gameAudio), title: 'Planata', help: 'watt = quota · tieni + / − per spostarti' },
  video: { game: new VideoRide($('gameCanvas'), gameHooks), title: 'Video', help: '+ / − cambiano marcia · il video segue la tua velocità', noAudio: true },
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
  activeGame = g.game; window.__game = g.game; // accesso per la diagnostica e i test automatici
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
  const d = e.clientX - r.left < r.width / 2 ? -1 : +1;
  activeGame.input(d); activeGame.hold?.(d);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('gameCanvas').addEventListener(ev, () => activeGame?.active && activeGame.hold?.(0));
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
    hist.push({ t: Date.now(), dur: Math.round(r.elapsed), km: +(r.distance / 1000).toFixed(2), avgW, kj: Math.round(r.energy), ...rideStats(r.log) });
    saveHistory(hist.slice(-200)); r.historySaved = true; persist();
  }
  const week = hist.filter((h) => Date.now() - h.t < 7 * 864e5).length;
  const mins = Math.round(r.elapsed / 60);
  $('finishTitle').textContent = mins >= 60 ? 'Che giro!' : mins >= 30 ? 'Ottimo lavoro!' : r.elapsed >= 60 ? 'Fatto!' : 'Allenamento finito';
  $('finishPraise').textContent = r.elapsed >= 60 ? `${mins} minuti in sella, ${Math.round(r.energy)} kJ di lavoro. ${week > 1 ? `È il tuo ${week}° allenamento questa settimana.` : 'Ottimo inizio di settimana.'}` : '';
  $('finishCompare').textContent = prev && r.elapsed >= 60 && prev.avgW ? (avgW > prev.avgW ? `+${avgW - prev.avgW} W medi rispetto all'ultima volta` : avgW === prev.avgW ? 'Stessa potenza media dell\'ultima volta: costanza!' : '') : '';
  const gl = goalState(hist);
  $('finishNudge').textContent = gl ? (gl.done >= gl.goal ? `Obiettivo della settimana raggiunto: ${gl.done}/${gl.goal} minuti!` : `Settimana: ${gl.done}/${gl.goal} minuti. Ne mancano ${gl.goal - gl.done}.`) : 'Domani ti aspettano nuove sfide nei giochi. Ci vediamo in sella.';
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

$('openHistory').addEventListener('click', openHistory);
$('finishHistory').addEventListener('click', openHistory);

// ---------- Pausa automatica, potenza 3 s, schermo intero ----------
const powerBuf = []; let idleSec = 0; let moveSec = 0; let autoPaused = false;
for (const id of ['autoPause', 'smooth3']) {
  const saved = localStorage.getItem(id); if (saved != null) $(id).checked = saved === '1';
  $(id).addEventListener('change', () => { localStorage.setItem(id, $(id).checked ? '1' : '0'); render(); });
}
function autoPauseCheck() {
  if (!$('autoPause').checked || !trainer.connected) { autoPaused = false; return; }
  const moving = (state.data.power || 0) > 5 || (state.data.speed || 0) > 2;
  const r = state.ride;
  if (r.running && !moving) {
    if (++idleSec >= 5 && !activeGame?.active) { $('startStop').click(); autoPaused = true; toast('In pausa: riparte quando pedali'); }
  } else idleSec = 0;
  if (autoPaused && !r.running && moving) { autoPaused = false; $('startStop').click(); toast('Si riparte!'); }
  // partenza automatica: sessione nuova e pedali da 3 secondi
  if (!r.running && !autoPaused && r.elapsed === 0 && moving) { if (++moveSec >= 3) { $('startStop').click(); toast('Registrazione avviata'); } } else moveSec = 0;
  if (r.running) autoPaused = autoPaused && !r.running;
}
$('startStop').addEventListener('click', () => { if (state.ride.running) idleSec = 0; });
$('fullscreen').addEventListener('click', () => {
  closeSheet('settingsSheet');
  if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Schermo intero non disponibile qui'));
});
if (!document.documentElement.requestFullscreen) $('fullscreen').hidden = true;

$('shareImg').addEventListener('click', async () => {
  const r = state.ride; if (!r.log.length) { toast('Nessun dato da condividere'); return; }
  const st = rideStats(r.log); const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  const mins = Math.round(r.elapsed / 60);
  const stats = [['Potenza media', avgW, 'W'], ['Tempo', fmtTime(r.elapsed), ''], ['Distanza', (r.distance / 1000).toFixed(1), 'km'], ['Energia', Math.round(r.energy), 'kJ']];
  if (st.np) stats.push(['Normalizzata', st.np, 'W']);
  if (st.best[1200]) stats.push(['Migliori 20 min', st.best[1200], 'W']); else if (st.best[60]) stats.push(['Miglior minuto', st.best[60], 'W']);
  const res = await shareCard({
    title: $('finishTitle').textContent || `${mins} minuti in sella`,
    date: new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
    stats, series: st.series, ftp: state.ftp, route: route?.name || lastRouteName,
  });
  if (res === 'saved') toast('Immagine salvata');
});

// ---------- Zone di frequenza cardiaca (in % del battito massimo) ----------
const HR_ZONES = [[0.6, 'Recupero', '#8a8f98'], [0.7, 'Fondo', '#4d8dff'], [0.8, 'Tempo', '#2fbf71'], [0.9, 'Soglia', '#f2c230'], [Infinity, 'Massimale', '#ff4d4d']];
function hrMax() { return Number(localStorage.getItem('hrMax')) || Math.max(170, ...history().map((h) => h.maxHr || 0)) || 185; }
function hrZone(hr) { const k = hr / hrMax(); const i = HR_ZONES.findIndex(([m]) => k < m); return { z: i + 1, name: HR_ZONES[i][1], color: HR_ZONES[i][2] }; }
$('hrMax').value = localStorage.getItem('hrMax') || '';
$('hrMax').addEventListener('change', (e) => { const v = Math.round(+e.target.value); if (v >= 120 && v <= 220) localStorage.setItem('hrMax', v); else { localStorage.removeItem('hrMax'); e.target.value = ''; } render(); });

// ---------- Backup: esporta / importa i dati tra dispositivi ----------
const NO_BACKUP = /^(stravaConfig|ride-freedom-session)$/;
$('backupOut').addEventListener('click', () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!NO_BACKUP.test(k)) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: 'ride-freedom', version: 1, date: new Date().toISOString(), data })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ride-freedom-dati-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Dati esportati');
});
$('backupIn').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'ride-freedom' || typeof j.data !== 'object') throw new Error('Non è un file di Ride Freedom');
    // lo storico si unisce (niente doppioni), il resto si sovrascrive
    const mine = history(); const theirs = JSON.parse(j.data.rideHistory || '[]');
    const merged = [...new Map([...mine, ...theirs].map((h) => [h.t, h])).values()].sort((a, b) => a.t - b.t);
    if (!confirm(`Importare ${theirs.length} uscite e le impostazioni del file? Lo storico verrà unito (${merged.length} uscite in totale).`)) return;
    for (const [k, v] of Object.entries(j.data)) if (!NO_BACKUP.test(k) && k !== 'rideHistory') localStorage.setItem(k, v);
    saveHistory(merged.slice(-200));
    toast('Dati importati: ricarico…'); setTimeout(() => location.reload(), 900);
  } catch (err) { toast(`Importazione non riuscita: ${err.message}`); }
});

// ---------- Obiettivo settimanale ----------
function goalState(hist) {
  const goal = Number(localStorage.getItem('weekGoal')) || 0; if (!goal) return null;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const done = Math.round(hist.filter((h) => h.t >= d.getTime()).reduce((a, h) => a + h.dur, 0) / 60);
  return { goal, done };
}
function goalHtml(hist) {
  const g = goalState(hist); if (!g) return '';
  const pct = Math.min(100, Math.round((g.done / g.goal) * 100));
  return `<div class="goal"><span class="goal-txt"><b>${g.done}</b> / ${g.goal} min questa settimana${pct >= 100 ? ' · raggiunto!' : ''}</span><span class="goal-bar"><i style="width:${pct}%"></i></span></div>`;
}
function renderGoalChips() { const g = Number(localStorage.getItem('weekGoal')) || 0; document.querySelectorAll('#goalChips button').forEach((b) => b.classList.toggle('on', +b.dataset.g === g)); }
document.querySelectorAll('#goalChips button').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('weekGoal', b.dataset.g); renderGoalChips(); renderWelcome(); }));
renderGoalChips();

// ---------- Editor allenamenti ed esportazione ----------
const editor = new WorkoutEditor($('editorBody'), {
  ftp: state.ftp,
  onSave: (w) => {
    const list = customWorkouts().filter((x) => x.id !== w.id);
    localStorage.setItem('customWorkouts', JSON.stringify([w, ...list].slice(0, 30)));
    closeSheet('editorSheet'); toast(`Salvato: ${w.name}`);
    renderWorkoutList(); openSheet('workoutSheet');
  },
});
function openEditor(w) {
  editor.ftp = state.ftp; editor.open(w);
  $('editorTitle').textContent = w?.custom ? 'Modifica allenamento' : 'Crea allenamento';
  closeSheet('workoutSheet'); openSheet('editorSheet');
}
// file da salvare: sul telefono si apre la condivisione (Drive, email, Garmin…), sul PC si scarica
async function offerFile(file, hint) {
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); toast(hint); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Scaricato ${file.name}. ${hint}`);
}

// ---------- Cambio automatico (tiene la cadenza scelta) e coach vocale ----------
let shiftHold = 0; const cadBuf = [];
function autoShiftTick() {
  if (state.mode !== 'gears' || !$('autoShift').checked || activeGame?.active) { cadBuf.length = 0; return; }
  const cad = currentCadence(); if (cad < 40) { cadBuf.length = 0; return; }
  cadBuf.push(cad); if (cadBuf.length > 3) cadBuf.shift();
  if (shiftHold > 0) { shiftHold--; return; }
  if (cadBuf.length < 3) return;
  const avg = cadBuf.reduce((a, b) => a + b, 0) / 3; const target = Number(localStorage.getItem('autoCad')) || 90;
  // fuori di più di 6 rpm per 3 secondi: una marcia alla volta, poi si aspetta che la gamba si adatti
  if (avg < target - 6 && state.gear > 0) { shift(-1); shiftHold = 3; cadBuf.length = 0; }
  else if (avg > target + 6 && state.gear < GEARS.length - 1) { shift(+1); shiftHold = 3; cadBuf.length = 0; }
}
function renderAutoShift() {
  const on = localStorage.getItem('autoShift') === '1'; const c = Number(localStorage.getItem('autoCad')) || 90;
  $('autoShift').checked = on; $('cadChips').hidden = !on;
  document.querySelectorAll('#cadChips button').forEach((b) => b.classList.toggle('on', +b.dataset.c === c));
}
$('autoShift').addEventListener('change', () => { localStorage.setItem('autoShift', $('autoShift').checked ? '1' : '0'); renderAutoShift(); if ($('autoShift').checked) toast('Il cambio segue la tua cadenza: + e − restano attivi'); });
document.querySelectorAll('#cadChips button').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('autoCad', b.dataset.c); renderAutoShift(); }));
renderAutoShift();
$('coachOn').checked = coach.on;
$('coachOn').addEventListener('change', () => { coach.on = $('coachOn').checked; if (coach.on) coach.say('Ciao! Sono il tuo coach. Ti avviso a ogni cambio di ritmo.', { force: true }); });
