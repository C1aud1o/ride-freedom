import { t, LANGS, setLang, getLang, fmtDate, fmtDec, fmtNum } from './i18n.js'; // per primo: carica le traduzioni prima del render
import { isNative, GarminBridge } from './native.js'; // nell'app installa il Bluetooth nativo
import { Trainer } from './trainers/index.js';
import { PowerMeter } from './powermeter.js';
import { SensorDebug } from './debug.js';
import { BUILD } from './build.js';
import { watchGuide, GARMIN_RE, WATCH_BRANDS, brandGuide } from './watchguide.js';
import { ZwiftClick } from './click.js';
import { GEARS, virtualSpeed, powerForSpeed } from './gears.js';
import { HeartRate } from './hr.js';
import { encodeFit, encodeWorkoutFit, encodeZwo } from './fit.js';
import { Strava } from './strava.js';
import { STRAVA_PROXY, GOATCOUNTER_URL, SENTRY_DSN } from './config.js';
import { initMonitoring, track, consentAsked, consentGiven, setConsent } from './monitor.js';
import { buildReportUrl } from './report.js';
import { setupDebug } from './debugview.js';
import { rideStats, renderHistory } from './history.js';
// glowSetting vive qui (stessa chiave di games/kit3d.js) per non caricare three.js all'avvio
const glowSetting = { get on() { return localStorage.getItem('gameGlow') !== '0'; }, set on(v) { localStorage.setItem('gameGlow', v ? '1' : '0'); } };
import './ui.js';
import { coach, spokenTime } from './coach.js';
import { party, badges } from './celebrate.js';
import { initAccount, dataChanged, accountsAvailable, submitGameScore, renderBoards } from './account/index.js';
import * as challenges from './challenges.js';
import { createClickNav } from './clicknav.js';
import { parseGpx, at as routeAt, SAMPLES as ROUTES, drawElevation, drawMap } from './route.js';
import { workouts, WorkoutRunner, drawProfile, duration, tss, fmtTime as fmtClock, parseZwo } from './workouts.js';
import { GameAudio } from './games/audio.js';
import { Progress } from './games/progress.js';

const $ = (id) => document.getElementById(id);
const trainer = new Trainer();
const pm = new PowerMeter();
const garminDbg = { dbg: new SensorDebug('garmin', 'Garmin bridge') };
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
  if (!el) return;
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
let lastTrainer = null; // nome, protocollo, funzioni e servizi del rullo collegato (per "Segnala il tuo rullo")
$('connectTrainer').addEventListener('click', async () => {
  if (trainer.connected) { trainer.disconnect(); return; }
  try {
    setStatus('trainerStatus', t('status.connecting'));
    const name = await trainer.connect();
    log(`Connected to ${name}`);
  } catch (err) {
    setStatus('trainerStatus', t('sensor.notConnected'));
    $('connectHelp').hidden = false; // nessun rullo scelto o collegamento fallito: soluzioni concrete
    log(`Trainer error: ${err.message}`);
    trainer.dbg.log(`Error: ${err.message}`);
  }
});

trainer.addEventListener('connected', (e) => {
  const { name, ftms, protocol, features } = e.detail;
  $('connectHelp').hidden = true;
  const proto = protocol && protocol !== 'CP/CSC' ? protocol : ftms ? 'FTMS' : '';
  setStatus('trainerStatus', `${name || t('home.trainer')}${proto ? ` · ${proto}` : ''}`, true);
  log(`Features: ERG ${features.power ? '✓' : '✗'} · Grade ${features.simulation ? '✓' : '✗'} · Resistance ${features.resistance ? '✓' : '✗'}`);
  if (!trainer.controllable) log('Trainer is read-only (no resistance control).');
  state.lastSent = null;
  applyMode(true);
  lastTrainer = { name: name || '', protocol: protocol === 'CP/CSC' ? 'CPS' : (protocol || (ftms ? 'FTMS' : '')), features, services: [...trainer.services] };
  track('trainer', lastTrainer.protocol || 'unknown');
  offerTrainerReport(lastTrainer.name);
});
trainer.addEventListener('disconnected', async () => {
  setStatus('trainerStatus', t('sensor.disconnected'));
  log('Trainer disconnected');
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
  if (click.connected) {
    // Zwift Play = due controller: dal primo si può collegare anche il secondo
    if (!(click.canAddSecond && confirm(t('click.addSecond')))) { click.disconnect(); return; }
  }
  try {
    setStatus('clickStatus', t('status.connecting'));
    const name = await click.connect();
    setStatus('clickStatus', t('sensor.connected', { name }), true);
    log(`Connected to ${name} (experimental)`);
  } catch (err) {
    setStatus('clickStatus', click.connected ? t('sensor.connected', { name: click.label }) : t('sensor.notConnected'), click.connected);
    log(`Click error: ${err.message}`);
    click.dbg.log(`Error: ${err.message}`);
  }
});
click.addEventListener('disconnected', () => {
  if (click.connected) setStatus('clickStatus', t('sensor.connected', { name: click.label }), true); else setStatus('clickStatus', t('sensor.notConnected'));
});
click.addEventListener('shift', (e) => { if (clickNav.active) return; if (activeGame?.active) activeGame.input(e.detail); else step(e.detail); });
click.addEventListener('combo', () => { clearTimeout(mediaTimer); clickNav.toggle(); });
click.addEventListener('hold', (e) => {
  if (clickNav.hold(e.detail)) return; // in modalità navigazione i tasti muovono la selezione
  if (activeGame?.active) activeGame.hold?.(e.detail);
  // pressione lunga = comandi musica (solo app Android): annulla il cambio fatto dalla pressione breve
  clearTimeout(mediaTimer);
  const d = e.detail;
  if (d && GarminBridge && $('musicOn').checked && !(activeGame?.active && activeGame.hold)) {
    mediaTimer = setTimeout(() => {
      if (activeGame?.active) activeGame.input(-d); else step(-d);
      GarminBridge.mediaKey({ key: d > 0 ? 'next' : 'playpause' }).then(() => toast(d > 0 ? t('music.next') : t('music.playPause'))).catch((err) => log(`Music: ${err.message}`));
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
    setStatus('hrStatus', t('status.connecting'));
    const name = await hrm.connect();
    state.hrFromSensor = true;
    setStatus('hrStatus', name, true);
    log(`Heart rate connected: ${name}`);
  } catch (err) {
    setStatus('hrStatus', t('sensor.notConnected'));
    log(`Heart rate error: ${err.message}`);
    hrm.dbg.log(`Error: ${err.message}`);
  }
});
hrm.addEventListener('hr', (e) => { state.data.hr = e.detail; render(); });
hrm.addEventListener('disconnected', () => {
  state.hrFromSensor = false;
  state.data.hr = null;
  setStatus('hrStatus', t('sensor.notConnected'));
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
    toast(t('workout.intensity', { pct: Math.round(workout.bias * 100) })); tickWorkout(0); return;
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
window.addEventListener('keyup', (e) => { if (clickNav.active && keyDir(e.key)) { clickNav.hold(0); return; } if (activeGame?.active && keyDir(e.key)) activeGame.hold?.(0); });
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (clickNav.active && keyDir(e.key) && e.key !== ' ') { e.preventDefault(); if (!e.repeat) clickNav.hold(keyDir(e.key)); return; }
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
      key = { mode: 'sim', value: state.grade }; fn = () => trainer.setSimulation({ grade: state.grade, mass: state.mass }); break;
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
  if (r.running) $('reportHint').hidden = true; // niente inviti mentre si pedala
  if (r.running) { r.start = performance.now() - r.elapsed * 1000; requestWakeLock(); }
  $('startStop').textContent = r.running ? t('home.pause') : t('home.start');
  $('startStop').classList.toggle('running', r.running);
});
$('reset').addEventListener('click', () => {
  if (!state.ride.saved && !confirm(t('finish.confirmReset'))) return;
  Object.assign(state.ride, { running: false, elapsed: 0, distance: 0, energy: 0, powerSum: 0, samples: 0, log: [], saved: true, stravaUrl: null, historySaved: false });
  renderWelcome();
  stravaMsg('');
  persist();
  $('startStop').textContent = t('home.start');
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
    if (m > (r.lastMilestone || 0)) { r.lastMilestone = m; toast(t('ride.minutes', { n: m * 10 })); if (!workout) coach.say(t('coach.minutes', { n: m * 10 })); }
    const k5 = Math.floor(r.distance / 5000);
    if (k5 > (r.lastKm || 0)) { r.lastKm = k5; toast(t('ride.km', { n: k5 * 5 })); }
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
function allWorkouts() { return [...customWorkouts(), ...workouts()]; }
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderWorkoutList() {
  $('wkFtp').textContent = state.ftp;
  $('workoutList').innerHTML = `<div class="row2 wk-top"><button class="cta-sm" id="wkNew">${t('editor.create')}</button><label class="ghost file-btn"><span>${t('workouts.importZwo')}</span><input id="zwoFile" type="file" accept=".zwo,application/xml,text/xml" hidden></label></div>` + allWorkouts().map((w) => `<div class="wk-wrap"><button class="wk-item" data-wk="${w.id}">
    <span class="row"><b>${escHtml(w.name)}</b><small>${escHtml(w.tag)}${tss(w) ? ` · ${t('workouts.load', { n: tss(w) })}` : ''}</small></span>
    <canvas data-prof="${w.id}"></canvas><small>${escHtml(w.desc)}</small></button>
    <span class="wk-tools">${w.test ? '' : `<button class="link" data-edit="${w.id}">${w.custom ? t('ui.edit') : t('workouts.copyEdit')}</button><button class="link" data-fit="${w.id}">Garmin (.FIT)</button><button class="link" data-zwo="${w.id}">.zwo</button>`}${w.custom ? `<button class="link" data-del="${w.id}">${t('ui.delete')}</button>` : ''}</span></div>`).join('');
  const all = allWorkouts();
  requestAnimationFrame(() => document.querySelectorAll('[data-prof]').forEach((c) => drawProfile(c, all.find((w) => w.id === c.dataset.prof), state.ftp)));
  document.querySelectorAll('[data-wk]').forEach((b) => b.addEventListener('click', () => startWorkout(all.find((w) => w.id === b.dataset.wk))));
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm(t('workouts.confirmDelete'))) return;
    localStorage.setItem('customWorkouts', JSON.stringify(customWorkouts().filter((w) => w.id !== b.dataset.del))); dataChanged('workouts', b.dataset.del, { deleted: true }); renderWorkoutList();
  }));
  $('wkNew').addEventListener('click', () => openEditor(null));
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEditor(all.find((w) => w.id === b.dataset.edit))));
  const safeName = (w) => w.name.replace(/[^\w\-àèéìòù ]+/gi, '').trim().replace(/\s+/g, '-') || t('workouts.fileName');
  document.querySelectorAll('[data-fit]').forEach((b) => b.addEventListener('click', () => {
    const w = all.find((x) => x.id === b.dataset.fit);
    offerFile(new File([encodeWorkoutFit(w.name, w.steps, state.ftp)], `${safeName(w)}.fit`, { type: 'application/vnd.ant.fit' }), t('workouts.fitHint'));
  }));
  document.querySelectorAll('[data-zwo]').forEach((b) => b.addEventListener('click', () => {
    const w = all.find((x) => x.id === b.dataset.zwo);
    offerFile(new File([encodeZwo(w.name, w.steps, state.ftp, w.desc)], `${safeName(w)}.zwo`, { type: 'application/xml' }), t('workouts.zwoHint'));
  }));
  $('zwoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const w = parseZwo(await f.text(), f.name);
      localStorage.setItem('customWorkouts', JSON.stringify([w, ...customWorkouts()].slice(0, 30))); dataChanged('workouts', w.id);
      toast(t('workouts.imported', { name: w.name })); renderWorkoutList();
    } catch (err) { toast(t('workouts.importFailed', { error: err.message })); }
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
  $('routeSamples').innerHTML = ROUTES.map((r) => `<button class="wk-item" data-route="${r.id}"><span class="row"><b>${escHtml(r.name)}</b><small>${t('routes.sample')}</small></span><small>${escHtml(r.desc)}</small></button>`).join('');
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
  if (!rt.hasEle) toast(t('route.noElevation'));
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
    if (ahead.grade >= 4 && c.grade < 3 && routeDist - (route.lastClimbSaid ?? -1e9) > 800) { route.lastClimbSaid = routeDist; coach.say(t('coach.climbAhead', { grade: Math.round(ahead.grade) })); }
  }
  if (g !== state.grade) { state.grade = g; syncInputs(); applyMode(true); }
  $('rtGrade').textContent = c.grade.toFixed(1);
  $('rtKm').textContent = `${fmtDec(routeDist / 1000, 2)} / ${fmtDec(route.total / 1000, 1)} km`;
  const gt = ghostTimeAt(routeDist);
  const vs = gt != null && routeT > 10 ? routeT - gt : null;
  $('rtInfo').innerHTML = vs != null
    ? t('route.vsRecord', { delta: `<b class="${vs <= 0 ? 'ahead' : 'behind'}">${vs <= 0 ? '−' : '+'}${fmtClock(Math.abs(vs))}</b>`, ele: Math.round(c.ele) })
    : `${t('route.info', { gain: route.gain, ele: Math.round(c.ele) })}${routeRealism < 1 ? ` · ${t('route.realism', { pct: routeRealism * 100 })}` : ''}${routeGhost ? ` · ${t('route.beatRecord')}` : ''}`;
  drawElevation($('rtProfile'), route, routeDist); drawMap($('rtMap'), route, routeDist);
  if (routeDist >= route.total) {
    coach.say(t('coach.routeDone', { name: route.name, time: spokenTime(routeT) }));
    routeTrace.push(Math.round(route.total));
    const prevT = routeGhost ? (routeGhost.length - 1) * 5 : Infinity;
    if (routeT < prevT) { try { localStorage.setItem(ghostKey(route), JSON.stringify(routeTrace)); } catch { /* pieno */ } toast(routeGhost ? t('route.newRecord', { time: fmtClock(routeT), delta: fmtClock(prevT - routeT) }) : t('route.firstTime', { time: fmtClock(routeT) })); }
    else toast(t('route.noRecord', { time: fmtClock(routeT), record: fmtClock(prevT) })); gameAudio.sfx('win'); progress.event('routes', 1, 60); stopRoute(); }
}
let lastRouteName = null;
function stopRoute() { lastRouteName = route?.name || lastRouteName; route = null; $('routeCard').hidden = true; document.body.classList.remove('in-route'); state.grade = 0; syncInputs(); applyMode(true); }
$('rtStop').addEventListener('click', () => { if (confirm(t('route.confirmStop'))) stopRoute(); });
function startWorkout(w) {
  if (route) stopRoute();
  if (workout && !confirm(t('workout.confirmInterrupt', { name: workout.w.name }))) return;
  workout = new WorkoutRunner(w, state.ftp); wkLast = null; wkPower = []; wkLowCad = 0;
  setMode('erg');
  closeSheet('workoutSheet');
  document.body.classList.add('in-workout');
  $('workoutCard').hidden = false; $('wkName').textContent = w.name; $('wkTotal').textContent = fmtClock(duration(w));
  if (!state.ride.running) $('startStop').click();
  if (!trainer.connected) toast(t('workout.connectHint'));
  tickWorkout(0);
}
function tickWorkout(dt) {
  if (!workout) return;
  const st = workout.tick(dt);
  if (!st) return finishWorkout(true);
  if (state.erg !== st.target) { state.erg = Math.min(MAX_W, st.target); syncInputs(); render(); applyMode(true); }
  if (wkLast !== st.i) {
    coach.say(t('coach.step', { label: st.x.label.replace(/(\d+)\/(\d+)/, `$1 ${t('coach.of')} $2`), watts: st.target, time: spokenTime(st.x.d) }));
  }
  if (dt && st.next && Math.round(st.left) === 10 && st.x.d >= 40) coach.say(t('coach.last10', { watts: st.nextW }));
  if (wkLast !== null && wkLast !== st.i) { toast(t('workout.stepToast', { label: st.x.label, watts: st.target })); gameAudio.sfx('go'); if (navigator.vibrate) navigator.vibrate([60, 60, 60]); }
  if (dt && st.next && st.left <= 3.5 && st.left > 0.5) gameAudio.sfx('beep');
  wkLast = st.i;
  $('wkStep').textContent = st.x.label; $('wkTarget').textContent = st.target; $('wkLeft').textContent = fmtClock(st.left);
  $('wkNext').textContent = st.next ? t('workout.next', { label: st.next.label, watts: st.nextW }) : t('workout.lastStep');
  $('wkTotal').textContent = `${fmtClock(workout.t)} / ${fmtClock(workout.total)}`;
  $('wkBias').textContent = workout.w.test ? t('workout.testHint') : workout.bias !== 1 ? t('workout.bias', { pct: Math.round(workout.bias * 100) }) : t('workout.biasHint');
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
      if (confirm(t('workout.ftpFound', { best: Math.round(best), ftp, old: state.ftp }))) {
        state.ftp = ftp; $('ftp').value = ftp; localStorage.setItem('ftp', ftp); toast(t('workout.ftpUpdated', { ftp }));
      }
    } else toast(t('workout.testTooShort'));
    state.erg = Math.round(state.ftp * 0.5); syncInputs(); applyMode(true);
    return;
  }
  if (completed) { coach.say(t('coach.workoutDone', { name: w.name })); toast(t('workout.done', { name: w.name })); gameAudio.sfx('win'); progress.event('workouts', 1, 50); }
}
$('wkSkip').addEventListener('click', () => { workout?.skip(); tickWorkout(0); });
$('wkStop').addEventListener('click', () => { if (workout?.w.test) finishWorkout(true); else if (confirm(t('workout.confirmEnd'))) finishWorkout(false); });

// ---------- Render ----------
const ZONES = [
  { id: 'Z1', max: 0.55 }, { id: 'Z2', max: 0.75 }, { id: 'Z3', max: 0.9 },
  { id: 'Z4', max: 1.05 }, { id: 'Z5', max: 1.2 }, { id: 'Z6', max: 1.5 },
  { id: 'Z7', max: Infinity },
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
  $('speed').textContent = fmtDec(speed, 1);
  $('hr').textContent = d.hr ? d.hr : '--';
  const hz = d.hr ? hrZone(d.hr) : null;
  $('hrZone').textContent = hz ? `Z${hz.z} ${hz.name}` : ''; $('hrZone').style.color = hz?.color || '';
  $('time').textContent = fmtTime(r.elapsed);
  $('distance').textContent = fmtDec(r.distance / 1000, 2);
  $('avgPower').textContent = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  $('kj').textContent = Math.round(r.energy);
  $('saveFit').disabled = !r.log.length;
  $('shareFit').disabled = !r.log.length;
  $('garminUp').disabled = !r.log.length;
  $('openFit').disabled = !r.log.length;
  $('finishRide').disabled = !r.log.length;
  $('uploadStrava').disabled = !r.log.length || stravaBusy;

  $('gearNum').textContent = state.gear + 1;
  $('gearRatio').textContent = fmtDec(GEARS[state.gear], 2);
  // cassetta: il pignone acceso è la marcia attuale
  cassetteEls.forEach((el, i) => { el.className = i === state.gear ? 'on' : i < state.gear ? 'past' : ''; });
  // zone di potenza sulla FTP
  const pct = (d.power || 0) / state.ftp;
  const z = ZONES.findIndex((zz) => pct < zz.max);
  const zone = ZONES[z < 0 ? ZONES.length - 1 : z];
  $('zone').textContent = d.power ? `${zone.id} ${t(`zone.power.${zone.id}`)}` : '—';
  document.documentElement.style.setProperty('--zone', d.power ? `var(--${zone.id.toLowerCase()})` : 'var(--z1)');
  $('zoneFill').style.left = `${Math.min(100, (pct / 1.7) * 100)}%`;
  $('gradeVal').textContent = `${fmtDec(state.grade, 1)} %`;
  $('ergVal').textContent = `${state.erg} W`;
  $('resVal').textContent = `${state.resistance} %`;
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === Number(state[b.dataset.preset])));

  const big = { gears: state.gear + 1, erg: `${state.erg}`, sim: fmtDec(state.grade, 1), resistance: state.resistance };
  const unit = { gears: t('ctl.gears', { ratio: fmtDec(GEARS[state.gear], 2) }), erg: t('ctl.erg'), sim: t('ctl.sim'), resistance: t('ctl.resistance') };
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
      log(`Previous session restored (${fmtTime(saved.elapsed)}). Press Start to continue or save it as .FIT.`);
    }
  } catch { /* ignora */ }
}
window.addEventListener('pagehide', persist);

function fitFile() {
  const bytes = encodeFit(state.ride.log);
  const d = new Date(state.ride.log[0].t);
  const pad = (n) => String(n).padStart(2, '0');
  const name = `spindro-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.fit`;
  return new File([bytes], name, { type: 'application/vnd.ant.fit' });
}

// salva un file: nell'app va in Download/Spindro, nel browser si scarica
async function saveFile(file) {
  if (GarminBridge) try {
    const res = await GarminBridge.saveDownload({ name: file.name, mime: file.type || 'application/octet-stream', data: await fileB64(file) });
    return res.path;
  } catch (err) { log(`Native save failed (${err.message}), trying a download`); }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return `Download/${file.name}`;
}
function openExternal(url) {
  if (GarminBridge) GarminBridge.openUrl({ url }).catch(() => window.open(url, '_blank'));
  else window.open(url, '_blank', 'noopener');
}

$('saveFit').addEventListener('click', async () => {
  try {
    const file = fitFile();
    const where = await saveFile(file);
    state.ride.saved = true; persist();
    log(`Saved ${where}`); toast(t('ride.savedTo', { where }));
  } catch (err) { log(`Save error: ${err.message || err}`); }
});

// Garmin non permette ad altre app di caricare su Connect: salviamo il file e apriamo la pagina "Importa"
const GARMIN_IMPORT = 'https://connect.garmin.com/modern/import-data';
$('garminUp').addEventListener('click', async () => {
  try {
    const file = fitFile();
    const where = await saveFile(file);
    state.ride.saved = true; persist();
    $('stravaMsg').innerHTML = t('finish.garminSaved', { where, file: file.name });
    setTimeout(() => openExternal(GARMIN_IMPORT), 700);
  } catch (err) { log(`Garmin error: ${err.message || err}`); }
});

async function fileB64(file) {
  const buf = new Uint8Array(await file.arrayBuffer()); let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
// nell'app: Condividi e Apri con… del sistema (per provare se Garmin Connect o altre app accettano il file)
async function nativeShare(file, mode) {
  await GarminBridge.shareFile({ name: file.name, mime: mode === 'view' ? 'application/vnd.ant.fit' : 'application/octet-stream', data: await fileB64(file), mode });
  state.ride.saved = true; persist();
}
$('shareFit').addEventListener('click', async () => {
  try {
    const file = fitFile();
    if (GarminBridge) { await nativeShare(file, 'send'); return; }
    await navigator.share({ files: [file], title: t('share.fileTitle') });
    state.ride.saved = true; persist();
  } catch (err) { if (err.name !== 'AbortError') log(`Share error: ${err.message}`); }
});
$('openFit').addEventListener('click', async () => {
  try { await nativeShare(fitFile(), 'view'); } catch (err) { log(`Open with: ${err.message}`); toast(t('finish.noOpenApp')); }
});
try {
  $('shareFit').hidden = !GarminBridge && !navigator.canShare?.({ files: [new File([new Uint8Array(1)], 'x.fit', { type: 'application/vnd.ant.fit' })] });
} catch { /* non supportato */ }
$('openFit').hidden = !GarminBridge;

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
  $('hsUseFtp')?.addEventListener('click', (e) => { state.ftp = +e.target.dataset.ftp; $('ftp').value = state.ftp; localStorage.setItem('ftp', state.ftp); toast(t('history.ftpSet', { ftp: state.ftp })); openHistory(); });
  for (const id of ['settingsSheet', 'finishSheet']) closeSheet(id);
  openSheet('historySheet');
}
// card delle sfide del mese: solo dallo storico locale, anche senza account
function renderChallenges(hist, riding) {
  const el = $('challengeCard');
  if (riding || !hist.length) { el.hidden = true; return; }
  const list = challenges.progress(hist, challenges.monthKey(), state.ftp);
  const month = fmtDate(new Date(), { month: 'long' });
  const medals = Object.keys(challenges.loadDone()).length;
  el.hidden = false;
  el.innerHTML = `<h2>${t('challenges.title', { month })}</h2><ul class="ch-list">${list.map((c) => {
    const left = c.metric === 'z2' ? t('challenges.valueMin', { done: Math.round(c.value), target: c.target }) : t('challenges.value', { done: fmtNum(Math.round(c.value)), target: c.target });
    return `<li class="${c.done ? 'done' : ''}" data-ch="${c.id}"><span class="ch-name">${c.done ? '🏅 ' : ''}${t(`challenges.${c.metric}`, { n: c.metric === 'z2' ? c.target / 60 : c.target })}</span><small>${c.done ? t('challenges.completed') : left}</small><span class="goal-bar" role="progressbar" aria-valuenow="${c.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${c.pct}%"></i></span></li>`;
  }).join('')}</ul>${medals ? `<p class="fine">${t('challenges.medals', { count: medals })}</p>` : ''}`;
}
function renderWelcome() {
  const el = $('welcome');
  const hist = history();
  const riding = trainer.connected || state.ride.log.length;
  renderChallenges(hist, riding);
  if (riding) { el.hidden = true; return; }
  el.hidden = false;
  if (!hist.length) {
    el.innerHTML = `<h2>${t('welcome.title')}</h2>
      <p>${t('welcome.subtitle')}</p>
      <ol><li>${t('welcome.step1')}</li><li>${t('welcome.step2')}</li><li>${t('welcome.step3')}</li></ol>
      <button class="cta" id="welcomeConnect">${t('welcome.connect')}</button>`;
  } else {
    const last = hist[hist.length - 1];
    const week = hist.filter((h) => Date.now() - h.t < 7 * 864e5);
    const days = Math.floor((Date.now() - last.t) / 864e5);
    const when = days === 0 ? t('time.today') : days === 1 ? t('time.yesterday') : t('time.daysAgo', { count: days });
    el.innerHTML = `<h2>${t('welcome.back')}</h2>
      <p>${t('welcome.last', { when })}</p>
      <dl class="stats"><div><dt>${t('welcome.minutes')}</dt><dd>${Math.round(last.dur / 60)}</dd></div><div><dt>${t('home.avgPower')}</dt><dd>${last.avgW}</dd></div><div><dt>km</dt><dd>${fmtNum(last.km)}</dd></div></dl>
      ${goalHtml(hist)}
      ${week.length ? `<span class="streak">● ${t('welcome.streak', { count: week.length })}</span>` : ''}
      <button class="cta" id="welcomeConnect">${t('welcome.connect')}</button>
      <button class="ghost" id="welcomeHistory">${t('history.open')}</button>`;
  }
  $('welcomeConnect')?.addEventListener('click', () => $('connectTrainer').click());
  $('welcomeHistory')?.addEventListener('click', openHistory);
}
trainer.addEventListener('connected', () => renderWelcome());
trainer.addEventListener('disconnected', () => renderWelcome());

setupDebug({ trainer, click, hrm, extra: [pm, garminDbg], appLog: () => $('log').textContent });
const showVersion = () => { $('appVersion').textContent = t('about.version', { platform: isNative ? t('about.android') : 'Web', build: BUILD }); };
showVersion();

// ---------- Modalità sviluppatore (7 tocchi sul numero di versione) ----------
const DEV_TAPS = 7;
const devOn = () => localStorage.getItem('devMode') === '1';
function applyDevMode() { document.body.classList.toggle('dev', devOn()); $('devModeOff').checked = devOn(); }
let devTaps = 0; let devTapTimer = null;
function tapVersion() {
  if (devOn()) { toast(t('dev.alreadyOn')); return; }
  devTaps++; clearTimeout(devTapTimer); devTapTimer = setTimeout(() => { devTaps = 0; }, 3000);
  if (devTaps >= DEV_TAPS) {
    devTaps = 0; localStorage.setItem('devMode', '1'); applyDevMode(); toast(t('dev.on'));
  } else if (devTaps >= 3) toast(t('dev.tapsLeft', { count: DEV_TAPS - devTaps }));
}
$('appVersion').addEventListener('click', tapVersion);
$('appVersion').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapVersion(); } });
$('devModeOff').addEventListener('change', (e) => {
  if (e.target.checked) return;
  localStorage.removeItem('devMode'); applyDevMode(); closeDebugPanel(); toast(t('dev.off'));
});
function closeDebugPanel() { if (!$('debugPanel').hidden) $('closeDebug').click(); }
applyDevMode();

// ---------- Segnala un problema (issue GitHub precompilata, senza dati personali) ----------
$('reportIssue').addEventListener('click', () => {
  const dev = [trainer, click, hrm].filter((x) => x?.connected).map((x) => x.device?.name).filter(Boolean).join(', ') || 'none';
  const body = [
    '**What happened?**', '', '', '**What did you expect?**', '', '', '---',
    `App version: ${BUILD}`, `Platform: ${isNative ? 'Android app' : 'Web'}`, `Browser: ${navigator.userAgent}`, `Connected device: ${dev}`, `Language: ${getLang()}`,
  ].join('\n');
  const url = `https://github.com/c1aud1o/ride-freedom/issues/new?title=${encodeURIComponent('Report from Spindro')}&body=${encodeURIComponent(body)}`;
  openExternal(url);
});

// ---------- Monitoraggio e consenso (D1) ----------
initMonitoring({ release: BUILD, environment: isNative ? 'android' : 'web', lang: getLang() });
$('analyticsOn').checked = consentGiven();
$('analyticsOn').addEventListener('change', (e) => { setConsent(e.target.checked); if (e.target.checked) { track('app-open'); track('lang', getLang()); } });
function answerConsent(yes) {
  setConsent(yes); $('analyticsOn').checked = yes; closeSheet('consentSheet');
  if (yes) { track('app-open'); track('lang', getLang()); }
}
$('consentYes').addEventListener('click', () => answerConsent(true));
$('consentNo').addEventListener('click', () => answerConsent(false));
// se statistiche o segnalazione errori non sono configurate (fork, build di prova) non si chiede né si mostra nulla
$('analyticsRow').hidden = !GOATCOUNTER_URL; $('errorsNote').hidden = !SENTRY_DSN; $('privacyGroup').hidden = !GOATCOUNTER_URL && !SENTRY_DSN;
if (GOATCOUNTER_URL && !consentAsked()) openSheet('consentSheet');

// ---------- Segnala il tuo rullo (issue GitHub precompilata, senza dati personali) ----------
function trainerReportUrl() {
  return buildReportUrl({ ...(lastTrainer && trainer.connected ? lastTrainer : {}), native: isNative, android: /Android/i.test(navigator.userAgent), version: BUILD, lang: getLang() });
}
$('reportTrainer').addEventListener('click', () => openExternal(trainerReportUrl()));
function offerTrainerReport(name) { // la prima volta che si collega un rullo con questo nome
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem('seenTrainers') || '[]'); } catch { /* vuoto */ }
  if (!name || seen.includes(name)) return;
  try { localStorage.setItem('seenTrainers', JSON.stringify([...seen, name].slice(-20))); } catch { /* storage non disponibile */ }
  $('reportHintText').textContent = t('trainerReport.first', { name });
  $('reportHint').hidden = false;
}
$('connectHelpRetry').addEventListener('click', () => { $('connectHelp').hidden = true; $('connectTrainer').click(); });
$('connectHelpReport').addEventListener('click', () => openExternal(trainerReportUrl()));
$('reportHintGo').addEventListener('click', () => { $('reportHint').hidden = true; openExternal(trainerReportUrl()); });
$('reportHintLater').addEventListener('click', () => { $('reportHint').hidden = true; });
trainer.addEventListener('disconnected', () => { $('reportHint').hidden = true; });

// ---------- Guide per marca di orologio (B6) ----------
function renderWatchBrand() {
  const sel = $('watchBrand'); const cur = sel.value || localStorage.getItem('watchBrand') || 'garmin';
  sel.innerHTML = WATCH_BRANDS.map((b) => `<option value="${b}">${t(`watch.brand.${b}`)}</option>`).join('');
  sel.value = WATCH_BRANDS.includes(cur) ? cur : 'garmin';
  $('watchBrandGuide').innerHTML = brandGuide(sel.value);
}
$('watchBrand').addEventListener('change', (e) => { try { localStorage.setItem('watchBrand', e.target.value); } catch { /* */ } $('watchBrandGuide').innerHTML = brandGuide(e.target.value); });
window.addEventListener('langchange', renderWatchBrand);
renderWatchBrand();

// ---------- Misuratore di potenza esterno ----------
state.usePm = localStorage.getItem('usePm') !== '0';
$('usePm').checked = state.usePm;
$('usePm').addEventListener('change', (e) => { state.usePm = e.target.checked; localStorage.setItem('usePm', state.usePm ? '1' : '0'); render(); });
$('connectPm').addEventListener('click', async () => {
  if (pm.connected) { pm.disconnect(); return; }
  try {
    setStatus('pmStatus', t('status.connecting'));
    const name = await pm.connect();
    setStatus('pmStatus', name, true);
    $('connectPm').textContent = t('ui.disconnect');
    log(`Power meter: ${name}`);
  } catch (err) { setStatus('pmStatus', t('status.notConnected')); log(`Power meter error: ${err.message}`); pm.dbg.log(`Error: ${err.message}`); }
});
pm.addEventListener('data', (e) => {
  if (!state.usePm) return;
  const d = e.detail;
  state.data.power = d.power;
  if (d.cadence != null) { state.data.cadence = d.cadence; state.pmCadence = true; }
  render();
});
pm.addEventListener('disconnected', () => { state.pmCadence = false; setStatus('pmStatus', t('status.notConnected')); $('connectPm').textContent = t('pm.connect'); });

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
    $('garminConflict').innerHTML = `${t('garmin.linked', { name })}${html}`;
    $('garminBanner').innerHTML = `<h2>${t('garmin.unlinkTitle', { name })}</h2><p>${t('garmin.unlinkBody')}</p>${html}`;
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
      await GarminBridge.start({ name: 'Spindro' });
      setStatus('garminStatus', t('garmin.waiting'));
      garminTimer = setInterval(pushGarmin, 500);
      garminDbg.dbg.setStatus('Waiting');
      clearInterval(conflictTimer); conflictTimer = setInterval(checkGarminConflict, 5000); setTimeout(checkGarminConflict, 1500);
      // se dopo un minuto nessuno usa il sensore, suggerisci la causa più probabile
      clearTimeout(garminHintTimer);
      garminHintTimer = setTimeout(() => { $('garminHint').hidden = false; }, 60000);
      log('Garmin bridge on: the phone is visible as the "Spindro" power sensor');
    } catch (err) {
      setStatus('garminStatus', t('garmin.error')); $('garminOn').checked = false; log(`Garmin: ${err.message}`);
    }
  } else {
    await GarminBridge.stop().catch(() => {});
    setStatus('garminStatus', t('status.off'));
    clearInterval(conflictTimer); checkGarminConflict();
  }
}
if (GarminBridge) {
  GarminBridge.addListener('status', (st) => {
    if (!$('garminOn').checked) return;
    // "connesso" non basta: il Garmin di solito è già connesso al telefono per Garmin Connect.
    // Il sensore è in uso solo quando un dispositivo si iscrive ai dati di potenza o velocità/cadenza.
    const inUse = (st.usersCount || 0) > 0;
    garminDbg.dbg.status = inUse ? 'Connected (in use)' : st.advertising ? 'Waiting' : st.running ? 'Starting' : 'Off';
    garminDbg.dbg.setValues({ visible: !!st.advertising, connected: st.connected || 0, devices: st.devices || '-', inUse: st.users || '-' });
    if (inUse) { clearTimeout(garminHintTimer); $('garminHint').hidden = true; }
    lastGarminStatus = st; checkGarminConflict();
    setStatus('garminStatus', inUse ? t('garmin.inUse', { users: st.users }) : st.advertising ? t('garmin.waiting') : st.running ? t('garmin.starting') : t('status.off'), inUse);
  });
  GarminBridge.addListener('error', (ev) => log(`Garmin: ${ev.message}`));
  GarminBridge.addListener('log', (ev) => { log(`Garmin · ${ev.message}`); garminDbg.dbg.log(ev.message); });
  $('garminOn').addEventListener('change', (e) => setGarmin(e.target.checked));
  if (localStorage.getItem('garminOn') === '1') { $('garminOn').checked = true; setGarmin(true); }
}

// ---------- Gioco ----------
let gradeBeforeGame = 0;
// Classifiche: durata e potenza della partita si misurano qui (1 campione al secondo mentre un gioco è aperto)
let gameRunT0 = 0; let gamePower = []; let gameSampler = null;
function reportGameScore({ game, stage, score }) {
  const dur = Math.round((Date.now() - gameRunT0) / 1000);
  // in demo (rullo non collegato) o senza partita avviata non si invia nulla
  if (!accountsAvailable || !gameRunT0 || dur < 20 || !trainer.connected || !Number.isFinite(score)) { gameRunT0 = 0; return; }
  gameRunT0 = 0;
  const p = gamePower.slice(-Math.max(1, dur));
  const avgW = p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0;
  const maxW = p.length ? Math.max(avgW, ...p) : 0;
  submitGameScore({ game, ...(stage !== undefined ? { stage } : {}), score: game === 'racer' ? score : Math.round(score), durationSec: dur, avgW, maxW });
}
const progress = new Progress();
const gameHooks = {
  progress,
  connected: () => trainer.connected,
  speedKmh: () => (state.mode === 'gears' ? currentVirtualSpeed() * 3.6 : state.data.speed || 0),
  stats: () => ({ power: Math.round(state.data.power || 0), cadence: Math.round(currentCadence()), gear: state.mode === 'gears' ? state.gear + 1 : null }),
  shift: (d) => shift(d),
  runStart: () => { gameRunT0 = Date.now(); },
  runEnd: (r) => reportGameScore(r),
  setGrade: (g) => {
    state.grade = g == null ? gradeBeforeGame : Math.max(-10, Math.min(15, g));
    syncInputs(); render(); applyMode(true);
  },
};
const gameAudio = new GameAudio();
// sblocco dell'audio al primo tocco (WebView e browser lo tengono sospeso finché l'utente non interagisce)
const unlockAudio = () => {
  gameAudio.warmUp();
  const c = gameAudio.useElements() ? null : gameAudio.ensure();
  if (c) { const b = c.createBuffer(1, 1, 22050); const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); }
};
// resta in ascolto finché il contesto non è davvero attivo (Android lo sospende anche quando l'app va in background)
for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, () => { if (gameAudio.ctx?.state !== 'running') unlockAudio(); }, { capture: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && gameAudio.ctx?.state !== 'running') gameAudio.ctx?.resume().catch(() => {}); });
// Test audio: A = Web Audio in tempo reale, B = suoni preparati e riprodotti dal lettore di sistema
async function audioTest(mode) {
  const out = []; const prev = localStorage.getItem('audioMode');
  try {
    localStorage.setItem('audioMode', mode);
    if (gameAudio.muted) out.push('WARNING: game audio was muted (Audio button in games): turning it back on');
    if (gameAudio.muted) gameAudio.toggleMute();
    if (mode === 'web') {
      const c = gameAudio.ensure(); if (!c) throw new Error('Web Audio not available');
      if (c.state !== 'running') await c.resume().catch(() => {});
      out.push(`A · Web Audio: ${c.state}, ${c.sampleRate} Hz`);
      gameAudio.sfx('pickup'); setTimeout(() => gameAudio.jingle('win'), 450);
    } else {
      await gameAudio.playElementSfxPrepare('pickup');
      out.push(gameAudio.sfxUrls?.pickup ? 'B · Player: sound prepared' : 'B · Player: could not prepare the sound');
      gameAudio.sfx('pickup'); setTimeout(() => gameAudio.jingle('win'), 450);
    }
    out.push('Did you hear the notes and then the jingle? If so, pick this method below.');
  } catch (err) { out.push(`error: ${err.message}`); }
  setTimeout(() => { if (prev) localStorage.setItem('audioMode', prev); else localStorage.removeItem('audioMode'); }, 1200);
  $('audioResult').textContent = out.join(' · ');
  log(`Audio test ${mode}: ${out.join(' | ')}`);
}
$('audioTestA').addEventListener('click', () => audioTest('web'));
$('audioTestB').addEventListener('click', () => audioTest('element'));
function renderAudioMode() { const m = localStorage.getItem('audioMode') || 'auto'; document.querySelectorAll('#audioMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m)); }
document.querySelectorAll('#audioMode button').forEach((b) => b.addEventListener('click', () => {
  localStorage.setItem('audioMode', b.dataset.m); gameAudio.stopSong(); gameAudio.warmed = false; gameAudio.warmUp(); renderAudioMode();
  toast(b.dataset.m === 'auto' ? 'Audio: auto' : b.dataset.m === 'web' ? 'Audio: Web Audio' : 'Audio: system player');
}));
renderAudioMode();
// I giochi (e three.js) si scaricano solo alla prima apertura: l'avvio dell'app resta leggero.
const GAME_DEFS = {
  horde: { load: () => import('./games/horde.js').then((m) => m.Horde), title: 'games.horde.name', help: 'games.horde.help' },
  racer: { load: () => import('./games/racer3d.js').then((m) => m.Racer3D), title: 'games.racer.name', help: 'games.racer.help' },
  shooter: { load: () => import('./games/strike3d.js').then((m) => m.Strike3D), title: 'games.shooter.title', help: 'games.shooter.help' },
  gruppetto: { load: () => import('./games/gruppetto.js').then((m) => m.Gruppetto), title: 'games.gruppetto.name', help: 'games.gruppetto.help' },
  mattoni: { load: () => import('./games/mattoni.js').then((m) => m.Mattoni), title: 'games.mattoni.name', help: 'games.mattoni.help' },
  planata: { load: () => import('./games/planata.js').then((m) => m.Planata), title: 'games.planata.name', help: 'games.planata.help' },
  video: { load: () => import('./videoride.js').then((m) => m.VideoRide), title: 'games.video.title', help: 'games.video.help', noAudio: true },
};
const games = {}; // istanze create alla prima apertura
async function loadGame(kind) {
  if (games[kind]) return games[kind];
  const d = GAME_DEFS[kind];
  const Cls = await d.load();
  games[kind] = { ...d, game: d.noAudio ? new Cls($('gameCanvas'), gameHooks) : new Cls($('gameCanvas'), gameHooks, gameAudio) };
  return games[kind];
}
let activeGame = null; let activeKind = null;

function openGame() {
  renderBoards($('boardPanel'), { stages: [0, 1, 2].map((i) => `games.racer.stage${i + 1}.name`) });
  $('gamePanel').hidden = false;
  $('gameMenu').hidden = false;
  progress.renderMenu($('progressPanel'));
  $('gameTitle').textContent = t('games.title');
  $('gameHelp').textContent = '';
  document.body.classList.add('game-open');
}
let gameLoading = false;
async function startGame(kind) {
  if (gameLoading) return;
  gameLoading = true;
  let g;
  try { $('gameMenu').classList.add('loading'); g = await loadGame(kind); } catch { toast(t('games.loadError')); return; } finally { gameLoading = false; $('gameMenu').classList.remove('loading'); }
  if ($('gamePanel').hidden) return; // chiuso mentre si scaricava
  track('game', kind);
  gameAudio.ensure(); // l'audio va sbloccato da un tocco dell'utente
  gradeBeforeGame = state.grade;
  // il gioco controlla la pendenza: serve la modalità Cambio o Pendenza
  if (state.mode !== 'gears' && state.mode !== 'sim') {
    document.querySelector('[name=mode][value=gears]').checked = true;
    state.mode = 'gears'; document.body.dataset.mode = 'gears'; state.lastSent = null;
  }
  if (trainer.connected && !state.ride.running) $('startStop').click();
  $('gameMenu').hidden = true;
  activeKind = kind;
  $('gameTitle').textContent = t(g.title);
  $('gameHelp').textContent = t(g.help);
  requestWakeLock();
  if (accountsAvailable && !gameSampler) gameSampler = setInterval(() => { gamePower.push(Math.min(2500, Math.round(state.data.power || 0))); if (gamePower.length > 10800) gamePower.shift(); }, 1000);
  if (kind !== 'video') clickNav.stop(); // nel gioco + e − tornano al gioco
  activeGame = g.game; window.__game = g.game; // accesso per la diagnostica e i test automatici
  activeGame.start();
}
function closeGame() {
  if (activeGame) { // dal gioco si torna al menu, dal menu si esce
    activeGame.stop();
    activeGame = null; activeKind = null;
    clearInterval(gameSampler); gameSampler = null; gamePower = []; gameRunT0 = 0;
    openGame();
    return;
  }
  $('gamePanel').hidden = true;
  document.body.classList.remove('game-open');
}
document.querySelectorAll('.game-card').forEach((b) => b.addEventListener('click', () => startGame(b.dataset.game)));
$('openGame').addEventListener('click', openGame);
// invito "Accedi per entrare in classifica": chiude i giochi e apre le impostazioni sulla sezione Account
window.addEventListener('account:open', () => {
  if (activeGame) closeGame();
  $('gamePanel').hidden = true; document.body.classList.remove('game-open');
  openSheet('settingsSheet');
  setTimeout(() => document.getElementById('accountGroup')?.scrollIntoView({ block: 'start' }), 150);
});
$('closeGame').addEventListener('click', closeGame);
const showMute = () => { $('muteGame').textContent = gameAudio.muted ? t('games.audioOff') : t('games.audioOn'); };
showMute();
$('muteGame').addEventListener('click', () => { gameAudio.toggleMute(); showMute(); });
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
  setStatus('stravaStatus', strava.connected ? (strava.athlete ? t('strava.linkedAs', { athlete: strava.athlete }) : t('strava.linked')) : t('status.notConnected'), strava.connected);
}
$('stravaConnect').addEventListener('click', () => {
  const id = $('stravaId').value.trim(); const secret = $('stravaSecret').value.trim();
  if (!/^\d+$/.test(id) || secret.length < 20) { stravaMsg(t('strava.badCreds')); return; }
  strava.setCredentials(id, secret);
  persist();
  strava.authorize().catch((err) => stravaMsg(t('ui.error', { error: err.message })));
});
$('stravaPublicConnect').addEventListener('click', async () => {
  persist();
  try { await strava.authorize(); } catch (err) { stravaMsg(t('ui.error', { error: err.message })); }
});
$('stravaDisconnect').addEventListener('click', () => { strava.disconnect(); renderStrava(); stravaMsg(t('strava.disconnected')); });
$('stravaAuto').addEventListener('change', (e) => { strava.cfg.auto = e.target.checked; strava.save(); });

async function uploadToStrava() {
  const r = state.ride;
  if (!r.log.length || stravaBusy) return;
  if (r.stravaUrl) { stravaMsg(t('strava.already', { url: r.stravaUrl }), true); return; }
  stravaBusy = true; render();
  try {
    const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
    const res = await strava.upload(fitFile(), {
      name: t('strava.activityName', { time: fmtTime(r.elapsed), watts: avgW }),
      description: t('strava.activityDesc', { watts: avgW, kj: Math.round(r.energy), km: (r.distance / 1000).toFixed(1) }),
      externalId: `spindro-${r.log[0].t}`,
    }, (m) => stravaMsg(m));
    r.saved = true;
    if (res.url) { r.stravaUrl = res.url; stravaMsg(`${res.message} ${t('strava.openActivity', { url: res.url })}`, true); }
    else stravaMsg(res.message);
    persist();
    log(res.message);
  } catch (err) {
    stravaMsg(t('strava.uploadFailed', { error: err.message }));
    log(`Strava error: ${err.message}`);
  } finally { stravaBusy = false; render(); }
}
$('uploadStrava').addEventListener('click', uploadToStrava);
$('finishRide').addEventListener('click', () => {
  const r = state.ride;
  if (r.running) $('startStop').click(); // pausa
  const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  $('finishSummary').innerHTML = [[t('home.time'), fmtTime(r.elapsed)], ['km', fmtDec(r.distance / 1000, 2)], [t('home.avgPower'), avgW], ['kJ', Math.round(r.energy)]]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  // il "picco" e la "fine": celebrare, confrontare, invitare a tornare
  const hist = history();
  const prev = hist[hist.length - 1];
  // medaglie: record di potenza, uscita più lunga, obiettivo della settimana, costanza
  const medals = [];
  const goalBefore = goalState(hist);
  if (r.elapsed >= 60) {
    const st = rideStats(r.log);
    for (const d of [5, 60, 300, 1200]) {
      const l = t(`finish.dur.${d}`);
      const old = Math.max(0, ...hist.map((h) => h.best?.[d] || 0));
      if (st.best[d] && old && st.best[d] > old) medals.push({ ico: '⚡', title: t('finish.record', { dur: l, w: st.best[d] }), sub: t('finish.recordSub', { delta: st.best[d] - old }) });
    }
    const longest = Math.max(0, ...hist.map((h) => h.dur));
    if (hist.length && r.elapsed > longest + 30) medals.push({ ico: '⏱', title: t('finish.longest'), sub: t('time.minutes', { count: Math.round(r.elapsed / 60) }) });
    const days = new Set([...hist.map((h) => new Date(h.t).toDateString()), new Date().toDateString()]);
    let streak = 0; for (let d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) streak++;
    if (streak >= 2) medals.push({ ico: '🔥', title: t('finish.streak', { n: streak }), sub: t('finish.streakSub') });
    if (!hist.length) medals.push({ ico: '★', title: t('finish.first'), sub: t('finish.firstSub') });
  }
  let chDone = [];
  if (!r.historySaved && r.elapsed >= 60) {
    const entry = { t: Date.now(), dur: Math.round(r.elapsed), km: +(r.distance / 1000).toFixed(2), avgW, kj: Math.round(r.energy), ...rideStats(r.log) };
    const histBefore = [...hist];
    hist.push(entry);
    saveHistory(hist.slice(-200)); r.historySaved = true; persist();
    chDone = challenges.newlyDone(histBefore, hist, challenges.monthKey(), state.ftp);
    challenges.markDone(chDone);
    dataChanged('rides', String(entry.t));
  }
  const week = hist.filter((h) => Date.now() - h.t < 7 * 864e5).length;
  const mins = Math.round(r.elapsed / 60);
  $('finishTitle').textContent = mins >= 60 ? t('finish.titleLong') : mins >= 30 ? t('finish.titleMid') : r.elapsed >= 60 ? t('finish.titleShort') : t('finish.titleTiny');
  $('finishPraise').textContent = r.elapsed >= 60 ? `${t('finish.praise', { mins, kj: Math.round(r.energy) })} ${week > 1 ? t('finish.praiseWeek', { n: week }) : t('finish.praiseStart')}` : '';
  $('finishCompare').textContent = prev && r.elapsed >= 60 && prev.avgW ? (avgW > prev.avgW ? t('finish.compareMore', { delta: avgW - prev.avgW }) : avgW === prev.avgW ? t('finish.compareSame') : '') : '';
  const gl = goalState(hist);
  $('finishNudge').textContent = gl ? (gl.done >= gl.goal ? t('finish.goalDone', { done: gl.done, goal: gl.goal }) : t('finish.goalLeft', { done: gl.done, goal: gl.goal, left: gl.goal - gl.done })) : t('finish.nudge');
  $('stravaMsg').innerHTML = r.stravaUrl
    ? t('strava.alreadyOn', { url: r.stravaUrl })
    : strava.connected ? '' : t('strava.connectHint');
  if (gl && goalBefore && goalBefore.done < gl.goal && gl.done >= gl.goal) medals.unshift({ ico: '🏁', title: t('finish.goalTitle'), sub: t('finish.goalSub', { done: gl.done, goal: gl.goal }) });
  for (const c of chDone) medals.unshift({ ico: '🏅', title: t('challenges.badge', { name: t(`challenges.${c.metric}`, { n: c.metric === 'z2' ? c.target / 60 : c.target }) }), sub: t('challenges.badgeSub') });
  badges($('finishBadges'), medals.slice(0, 4));
  openSheet('finishSheet');
  if (r.elapsed >= 60) track('ride-complete');
  if (r.elapsed >= 60) { party($('finishSheet'), { records: medals.length }); if (medals.length) gameAudio.jingle('win', 0.6); }
  if (strava.connected && strava.cfg.auto && !r.stravaUrl) uploadToStrava();
});
strava.handleRedirect().then((res) => {
  if (res) { stravaMsg(res.message); log(res.message); openSheet('settingsSheet'); }
  renderStrava();
}).catch((err) => { stravaMsg(t('strava.linkError', { error: err.message })); renderStrava(); });
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
    if (++idleSec >= 5 && !activeGame?.active) { $('startStop').click(); autoPaused = true; toast(t('auto.paused')); }
  } else idleSec = 0;
  if (autoPaused && !r.running && moving) { autoPaused = false; $('startStop').click(); toast(t('auto.resumed')); }
  // partenza automatica: sessione nuova e pedali da 3 secondi
  if (!r.running && !autoPaused && r.elapsed === 0 && moving) { if (++moveSec >= 3) { $('startStop').click(); toast(t('auto.started')); } } else moveSec = 0;
  if (r.running) autoPaused = autoPaused && !r.running;
}
$('startStop').addEventListener('click', () => { if (state.ride.running) idleSec = 0; });
$('fullscreen').addEventListener('click', () => {
  closeSheet('settingsSheet');
  if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast(t('settings.fullscreenNA')));
});
if (!document.documentElement.requestFullscreen) $('fullscreen').hidden = true;

$('shareImg').addEventListener('click', async () => {
  const r = state.ride; if (!r.log.length) { toast(t('share.noData')); return; }
  const st = rideStats(r.log); const avgW = r.samples ? Math.round(r.powerSum / r.samples) : 0;
  const mins = Math.round(r.elapsed / 60);
  const stats = [[t('share.avgPower'), avgW, 'W'], [t('home.time'), fmtTime(r.elapsed), ''], [t('share.distance'), fmtDec(r.distance / 1000, 1), 'km'], [t('share.energy'), Math.round(r.energy), 'kJ']];
  if (st.np) stats.push([t('share.normalized'), st.np, 'W']);
  if (st.best[1200]) stats.push([t('share.best20'), st.best[1200], 'W']); else if (st.best[60]) stats.push([t('share.best1'), st.best[60], 'W']);
  const { shareCard } = await import('./sharecard.js');
  const res = await shareCard({
    title: $('finishTitle').textContent || t('share.title', { mins }),
    date: fmtDate(new Date()),
    stats, series: st.series, ftp: state.ftp, route: route?.name || lastRouteName,
  });
  if (res === 'saved') toast(t('share.saved'));
});

// ---------- Zone di frequenza cardiaca (in % del battito massimo) ----------
const HR_ZONES = [[0.6, '#8a8f98'], [0.7, '#4d8dff'], [0.8, '#2fbf71'], [0.9, '#f2c230'], [Infinity, '#ff4d4d']];
function hrMax() { return Number(localStorage.getItem('hrMax')) || Math.max(170, ...history().map((h) => h.maxHr || 0)) || 185; }
function hrZone(hr) { const k = hr / hrMax(); const i = HR_ZONES.findIndex(([m]) => k < m); return { z: i + 1, name: t(`zone.hr.z${i + 1}`), color: HR_ZONES[i][1] }; }
$('hrMax').value = localStorage.getItem('hrMax') || '';
$('hrMax').addEventListener('change', (e) => { const v = Math.round(+e.target.value); if (v >= 120 && v <= 220) localStorage.setItem('hrMax', v); else { localStorage.removeItem('hrMax'); e.target.value = ''; } render(); });

// ---------- Backup: esporta / importa i dati tra dispositivi ----------
const NO_BACKUP = /^(stravaConfig|ride-freedom-session|account:session|sync:.*)$/; // token Strava, uscita in corso, stato dell'account e della sincronizzazione
$('backupOut').addEventListener('click', () => {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!NO_BACKUP.test(k)) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: 'spindro', version: 1, date: new Date().toISOString(), data })], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `spindro-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t('backup.exported'));
});
$('backupIn').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'spindro' && j.app !== 'ride-freedom' || typeof j.data !== 'object') throw new Error(t('backup.notSpindro'));
    // lo storico si unisce (niente doppioni), il resto si sovrascrive
    const mine = history(); const theirs = JSON.parse(j.data.rideHistory || '[]');
    const merged = [...new Map([...mine, ...theirs].map((h) => [h.t, h])).values()].sort((a, b) => a.t - b.t);
    if (!confirm(t('backup.confirm', { count: theirs.length, total: merged.length }))) return;
    for (const [k, v] of Object.entries(j.data)) if (!NO_BACKUP.test(k) && k !== 'rideHistory') localStorage.setItem(k, v);
    saveHistory(merged.slice(-200));
    toast(t('backup.imported')); setTimeout(() => location.reload(), 900);
  } catch (err) { toast(t('backup.failed', { error: err.message })); }
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
  return `<div class="goal"><span class="goal-txt">${t('goal.progress', { done: g.done, goal: g.goal })}${pct >= 100 ? ` · ${t('goal.reached')}` : ''}</span><span class="goal-bar"><i style="width:${pct}%"></i></span></div>`;
}
function renderGoalChips() { const g = Number(localStorage.getItem('weekGoal')) || 0; document.querySelectorAll('#goalChips button').forEach((b) => b.classList.toggle('on', +b.dataset.g === g)); }
document.querySelectorAll('#goalChips button').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('weekGoal', b.dataset.g); renderGoalChips(); renderWelcome(); }));
renderGoalChips();

// ---------- Editor allenamenti ed esportazione ----------
let editor = null;
async function openEditor(w) {
  if (!editor) {
    const { WorkoutEditor } = await import('./editor.js');
    editor = new WorkoutEditor($('editorBody'), {
      ftp: state.ftp,
      onSave: (w) => {
        const list = customWorkouts().filter((x) => x.id !== w.id);
        localStorage.setItem('customWorkouts', JSON.stringify([w, ...list].slice(0, 30))); dataChanged('workouts', w.id);
        closeSheet('editorSheet'); toast(t('editor.saved', { name: w.name }));
        renderWorkoutList(); openSheet('workoutSheet');
      },
    });
  }
  editor.ftp = state.ftp; editor.open(w);
  $('editorTitle').textContent = w?.custom ? t('editor.edit') : t('editor.create');
  closeSheet('workoutSheet'); openSheet('editorSheet');
}
// file da salvare: sul telefono si apre la condivisione (Drive, email, Garmin…), sul PC si scarica
async function offerFile(file, hint) {
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); toast(hint); return; }
  } catch (err) { if (err.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t('workouts.downloaded', { file: file.name, hint }));
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
$('autoShift').addEventListener('change', () => { localStorage.setItem('autoShift', $('autoShift').checked ? '1' : '0'); renderAutoShift(); if ($('autoShift').checked) toast(t('auto.shiftOn')); });
document.querySelectorAll('#cadChips button').forEach((b) => b.addEventListener('click', () => { localStorage.setItem('autoCad', b.dataset.c); renderAutoShift(); }));
renderAutoShift();
$('coachOn').checked = coach.on;
$('coachOn').addEventListener('change', () => { coach.on = $('coachOn').checked; if (coach.on) coach.say(t('coach.hello'), { force: true }); });

$('gameGlow').checked = glowSetting.on;
$('gameGlow').addEventListener('change', () => { glowSetting.on = $('gameGlow').checked; });
// qualità grafica dei giochi 3D (stessa chiave di games/kit/quality.js): auto misura i fps all'avvio
try { $('gameQuality').value = localStorage.getItem('gameQuality') || 'auto'; } catch { /* niente storage */ }
$('gameQuality').addEventListener('change', () => { try { localStorage.setItem('gameQuality', $('gameQuality').value); if ($('gameQuality').value === 'auto') localStorage.removeItem('gameQualityAuto'); } catch { /* niente storage */ } });

// ---------- Navigazione con il Click, tasto indietro e link condivisi ----------
const inGame = () => activeGame?.active && $('gameMenu').hidden && !document.querySelector('.video-pick:not([hidden])');
const clickNav = createClickNav({
  back: () => window.rfBack(),
  isIdle: () => !click.pressed?.size,
  onChange: (on) => document.body.classList.toggle('click-nav', on),
  menuItems: () => {
    const rec = { label: state.ride.running ? t('clickmenu.pause') : t('clickmenu.start'), run: () => $('startStop').click() };
    if (inGame()) {
      return [
        { label: t('clickmenu.resumeGame'), run: () => clickNav.stop() },
        { label: t('clickmenu.exitGame'), run: () => closeGame() },
        { label: gameAudio.muted ? t('clickmenu.audioOn') : t('clickmenu.audioOff'), run: () => $('muteGame').click() },
        rec,
      ];
    }
    return [
      rec,
      ...(state.ride.log.length ? [{ label: t('clickmenu.finish'), run: () => $('finishRide').click() }] : []),
      ...(isNative && !trainer.connected ? [{ label: t('clickmenu.connect'), run: () => $('connectTrainer').click() }] : []),
      { label: t('clickmenu.workouts'), run: () => $('openWorkouts').click() },
      { label: t('clickmenu.games'), run: () => openGame() },
      { label: t('clickmenu.video'), run: () => { openGame(); startGame('video'); } },
      { label: t('clickmenu.history'), run: () => openHistory() },
      { label: t('clickmenu.settings'), run: () => $('openSettings').click() },
      { label: t('clickmenu.explore'), run: () => {} },
      { label: t('clickmenu.close'), run: () => clickNav.stop() },
    ];
  },
});
// da tastiera: M apre il menu Click (comodo anche per provarlo dal PC)
window.addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') clickNav.toggle(); });

// tasto indietro (Android e browser): chiude ciò che è aperto; per uscire va premuto due volte
let backArmed = 0;
window.rfBack = () => {
  if (clickNav.menuOpen()) { clickNav.closeMenu(); return 'ok'; }
  const sheets = [...document.querySelectorAll('.sheet')].filter((x) => !x.hidden);
  if (sheets.length) { closeSheet(sheets[sheets.length - 1].id); return 'ok'; }
  if (!$('debugPanel').hidden) { $('closeDebug').click(); return 'ok'; }
  if (!$('gamePanel').hidden) { closeGame(); return 'ok'; }
  if (clickNav.active) { clickNav.stop(); return 'ok'; }
  if (Date.now() - backArmed < 2500) return state.ride.running ? 'background' : 'exit';
  backArmed = Date.now();
  toast(state.ride.running ? t('back.background') : t('back.exit'));
  return 'ok';
};
if (!isNative) {
  // nel browser il tasto indietro passa dalla cronologia: teniamo un "segnaposto" per intercettarlo
  window.history.pushState({ rf: 1 }, '');
  window.addEventListener('popstate', () => { if (window.rfBack() === 'ok') window.history.pushState({ rf: 1 }, ''); else window.history.back(); });
}

// link condiviso da YouTube (Condividi → Spindro): apre "Pedala su un video" con quel video
window.rfShared = (text) => {
  const m = String(text).match(/https?:\/\/\S+/); const url = m ? m[0] : String(text).trim();
  if (!/youtu\.?be/.test(url)) { toast(t('share.notYoutube')); return; }
  for (const sh of document.querySelectorAll('.sheet')) if (!sh.hidden) closeSheet(sh.id);
  if (activeGame) closeGame();
  openGame(); startGame('video').then(() => games.video?.game.openUrl(url));
  toast(t('share.received'));
};
if (window.rfPendingShare) { window.rfShared(window.rfPendingShare); window.rfPendingShare = null; }

// ---------- Lingua: selettore nelle Impostazioni e aggiornamento al volo ----------
const langSelect = $('langSelect');
for (const [code, name] of Object.entries(LANGS)) langSelect.add(new Option(name, code));
langSelect.value = getLang();
langSelect.addEventListener('change', () => setLang(langSelect.value));
// ciò che il codice scrive da solo (stati, elenchi, pannelli aperti) va rifatto; l'HTML statico lo rifà applyI18n
window.addEventListener('langchange', () => {
  langSelect.value = getLang();
  $('startStop').textContent = state.ride.running ? t('home.pause') : t('home.start');
  if (!trainer.connected) setStatus('trainerStatus', t('home.status.connect'));
  if (click.connected) setStatus('clickStatus', t('sensor.connected', { name: click.label }), true); else if ($('clickStatus').textContent !== '—') setStatus('clickStatus', t('sensor.notConnected'));
  if (!hrm.connected && $('hrStatus').textContent !== '—') setStatus('hrStatus', t('sensor.notConnected'));
  if (!pm.connected) { setStatus('pmStatus', t('status.notConnected')); $('connectPm').textContent = t('pm.connect'); } else $('connectPm').textContent = t('ui.disconnect');
  if (!$('garminOn').checked) setStatus('garminStatus', t('status.off'));
  showVersion(); showMute(); renderStrava(); renderWelcome(); render(); checkGarminConflict();
  $('wkFtp').textContent = state.ftp;
  if (!$('workoutSheet').hidden) { renderWorkoutList(); renderRoutePick(); }
  if (!$('historySheet').hidden) openHistory();
  if (!$('gamePanel').hidden) {
    if (activeGame) { $('gameTitle').textContent = t(GAME_DEFS[activeKind].title); $('gameHelp').textContent = t(GAME_DEFS[activeKind].help); }
    else { $('gameTitle').textContent = t('games.title'); progress.renderMenu($('progressPanel')); }
  }
});

// ---------- Account facoltativo: compare solo se js/config.js ha FIREBASE_CONFIG ----------
initAccount();
