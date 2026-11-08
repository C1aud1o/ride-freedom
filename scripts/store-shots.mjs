// Cattura le 8 schermate "reali" dell'app per le schede degli store, in 5 lingue.
// Usa il rullo finto di tests/fake-ble.js e dati di esempio in localStorage (nessun dato personale).
//
//   node scripts/store-shots.mjs                 → tutte le lingue
//   node scripts/store-shots.mjs en it           → solo alcune lingue
//   SHOTS=1,4 node scripts/store-shots.mjs en    → solo alcune schermate
//
// Uscita: store/raw/<lingua>/01.png … 08.png (1080×1920: 360×640 a scala 3).
// Cloud: serve PW_CHROMIUM_PATH=/opt/pw-browsers/chromium (default se il file esiste).
// Poi: node scripts/store-frames.mjs per comporre le immagini finali.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const name of ['playwright', '@playwright/test', '/opt/node-tools/node_modules/playwright']) {
    try { return require(name); } catch { /* prova la prossima */ }
  }
  throw new Error('Playwright non trovato: npm install, oppure usa quello preinstallato nel cloud.');
}
const { chromium } = loadPlaywright();

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FAKE_BLE = join(ROOT, 'tests/fake-ble.js');
const OUT = join(ROOT, 'store/raw');
const PORT = Number(process.env.STORE_PORT) || 4180;
const ALL_LANGS = ['en', 'it', 'fr', 'es', 'de'];
const langs = process.argv.slice(2).filter((a) => ALL_LANGS.includes(a));
const LANGS = langs.length ? langs : ALL_LANGS;
const ONLY = process.env.SHOTS ? process.env.SHOTS.split(',').map(Number) : null;
const CHROMIUM = process.env.PW_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// ---------------------------------------------------------------- dati di esempio
// Generatore pseudo-casuale con seme fisso: le immagini escono uguali a ogni esecuzione.
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

// stesse statistiche di js/history.js (rideStats), ricalcolate qui per non importare il codice dell'app
function rideStats(powers, hrs) {
  const best = {};
  for (const d of [5, 60, 300, 1200]) {
    if (powers.length < d) continue;
    let sum = powers.slice(0, d).reduce((a, b) => a + b, 0); let m = sum;
    for (let i = d; i < powers.length; i++) { sum += powers[i] - powers[i - d]; if (sum > m) m = sum; }
    best[d] = Math.round(m / d);
  }
  let np = 0;
  if (powers.length >= 30) {
    let sum = powers.slice(0, 30).reduce((a, b) => a + b, 0); let acc = 0; let n = 0;
    for (let i = 30; i <= powers.length; i++) { acc += (sum / 30) ** 4; n++; if (i < powers.length) sum += powers[i] - powers[i - 30]; }
    np = Math.round((acc / n) ** 0.25);
  }
  const series = [];
  for (let i = 0; i < powers.length; i += 10) { const c = powers.slice(i, i + 10); series.push(Math.round(c.reduce((a, b) => a + b, 0) / c.length)); }
  return { np, maxW: Math.max(...powers), best, maxHr: Math.max(...hrs), avgHr: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length), series: series.slice(0, 720) };
}

// una uscita a 1 Hz: riscaldamento, blocchi a una certa intensità, defaticamento (FTP 220 W)
function makeRide(rand, { mins, blocks, base }) {
  const p = []; const hr = [];
  const total = mins * 60;
  for (let s = 0; s < total; s++) {
    let target = base;
    if (s < 300) target = base * (0.55 + 0.45 * (s / 300));
    else if (s > total - 240) target = base * 0.6;
    else {
      const t = s - 300;
      for (const b of blocks) if (t >= b.at * 60 && t < (b.at + b.len) * 60) target = b.w;
    }
    const w = Math.max(0, Math.round(target + (rand() - 0.5) * 22 + Math.sin(s / 17) * 6));
    p.push(w); hr.push(Math.round(96 + (w / 220) * 62 + (rand() - 0.5) * 4));
  }
  return { p, hr };
}

function buildHistory() {
  const rand = rng(7);
  const day = 864e5; const now = Date.now();
  // [giorni fa, minuti, blocchi di intensità, potenza base]
  const plan = [
    [27, 32, [], 128], [25, 40, [{ at: 6, len: 12, w: 190 }], 135], [22, 45, [], 138],
    [20, 38, [{ at: 5, len: 10, w: 196 }], 140], [18, 50, [], 142], [15, 42, [{ at: 4, len: 8, w: 205 }, { at: 18, len: 8, w: 205 }], 142],
    [13, 36, [], 146], [11, 55, [{ at: 6, len: 14, w: 198 }], 148], [8, 45, [{ at: 5, len: 10, w: 210 }, { at: 20, len: 10, w: 212 }], 150],
    [6, 40, [], 150], [4, 52, [{ at: 6, len: 18, w: 204 }], 152], [2, 38, [{ at: 5, len: 5, w: 232 }], 154],
  ];
  return plan.map(([ago, mins, blocks, base], i) => {
    const { p, hr } = makeRide(rand, { mins, blocks, base });
    const st = rideStats(p, hr);
    const avgW = Math.round(p.reduce((a, b) => a + b, 0) / p.length);
    const km = +(((avgW / 220) ** 0.45) * 31 * (mins / 60) * (0.96 + rand() * 0.08)).toFixed(1);
    const d = new Date(now - ago * day); d.setHours(i % 2 ? 18 : 7, 10 + (i * 7) % 40, 0, 0);
    return { t: d.getTime(), dur: mins * 60, km, avgW, kj: Math.round((avgW * mins * 60) / 1000), ...st };
  });
}

// l'uscita "di oggi" per la scheda di fine uscita: 28 minuti, con record su 1, 5 e 20 minuti
function buildTodayRide() {
  const rand = rng(99);
  const { p, hr } = makeRide(rand, { mins: 28, blocks: [{ at: 4, len: 3, w: 262 }, { at: 12, len: 7, w: 232 }], base: 168 });
  const log = p.map((w, i) => ({ t: Date.now() - (p.length - i) * 1000, power: w, cadence: 80 + Math.round(Math.sin(i / 30) * 7), hr: hr[i], speed: +(7 + (w / 220) * 2.6).toFixed(3), distance: 0 }));
  let dist = 0; log.forEach((x) => { dist += x.speed; x.distance = +dist.toFixed(1); });
  const energy = p.reduce((a, b) => a + b, 0) / 1000;
  return { elapsed: p.length, distance: dist, energy, powerSum: p.reduce((a, b) => a + b, 0), samples: p.length, log, saved: false, stravaUrl: null, historySaved: false };
}

// una sessione in corso (12 minuti) da riprendere con "Avvia": riempie la striscia dei dati nella home
function buildLiveSession() {
  const rand = rng(21);
  const { p, hr } = makeRide(rand, { mins: 12, blocks: [{ at: 4, len: 6, w: 205 }], base: 170 });
  const log = p.slice(0, 754).map((w, i) => ({ t: Date.now() - (754 - i) * 1000, power: w, cadence: 84, hr: hr[i], speed: 8.2, distance: +(i * 8.2).toFixed(1) }));
  const sum = log.reduce((a, b) => a + b.power, 0);
  return { elapsed: 754, distance: 754 * 8.2, energy: sum / 1000, powerSum: sum, samples: log.length, log, saved: false, stravaUrl: null, historySaved: false };
}

const CUSTOM_WORKOUT = {
  id: 'custom-demo', custom: true, tag: '45 min', desc: '', name: '',
  steps: [
    { d: 300, p: 0.5, to: 0.75, label: '' }, { d: 120, p: 0.75, label: '' },
    { d: 480, p: 0.95, label: '' }, { d: 240, p: 0.55, label: '' },
    { d: 480, p: 0.95, label: '' }, { d: 240, p: 0.55, label: '' },
    { d: 480, p: 0.95, label: '' }, { d: 300, p: 0.6, to: 0.4, label: '' },
  ],
};
// nome e descrizione dell'allenamento personalizzato, per lingua (sono dati dell'utente: non passano dalle traduzioni)
const CUSTOM_NAMES = {
  en: ['Tuesday sweet spot', 'Three 8-minute blocks'], it: ['Sweet spot del martedì', 'Tre blocchi da 8 minuti'],
  fr: ['Sweet spot du mardi', 'Trois blocs de 8 minutes'], es: ['Sweet spot del martes', 'Tres bloques de 8 minutos'],
  de: ['Sweetspot am Dienstag', 'Drei Blöcke à 8 Minuten'],
};

// ---------------------------------------------------------------- video finto
// Una strada di montagna disegnata nel canvas e registrata con MediaRecorder: nessun video di terzi.
async function makeFakeVideo(context) {
  const page = await context.newPage();
  await page.goto('about:blank');
  const b64 = await page.evaluate(async () => {
    const W = 640; const H = 360; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const draw = (tm) => {
      const sky = g.createLinearGradient(0, 0, 0, H * 0.55); sky.addColorStop(0, '#2b4c7e'); sky.addColorStop(0.6, '#e8a35f'); sky.addColorStop(1, '#f6d9a0');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff3c2'; g.beginPath(); g.arc(470, 118, 30, 0, 7); g.fill();
      const ridge = (y, amp, col, sp, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 8) g.lineTo(x, y - Math.abs(Math.sin((x + tm * sp + ph) / 70)) * amp - Math.sin((x + ph) / 23) * amp * 0.25); g.lineTo(W, H); g.fill(); };
      ridge(200, 70, '#5b6f8f', 6, 0); ridge(215, 50, '#3f5a56', 14, 90); ridge(230, 34, '#2c4a35', 28, 40);
      g.fillStyle = '#2f5a2b'; g.fillRect(0, 225, W, H);
      g.fillStyle = '#3c3f44'; g.beginPath(); g.moveTo(W / 2 - 18, 225); g.lineTo(W / 2 + 18, 225); g.lineTo(W / 2 + 330, H); g.lineTo(W / 2 - 330, H); g.fill();
      g.fillStyle = '#e8e4d0';
      for (let i = 0; i < 9; i++) { const f = ((i + (tm * 0.012) % 1) / 9) ** 2; const y = 225 + f * (H - 225); const w = 1.5 + f * 9; const h = 3 + f * 26; g.fillRect(W / 2 - w / 2, y, w, h); }
      for (let i = 0; i < 6; i++) { const f = (((i + (tm * 0.012) % 1) / 6)) ** 2.2; const y = 225 + f * (H - 225); const x = W / 2 + (30 + f * 400) * (i % 2 ? 1 : -1); g.fillStyle = '#1d3a1d'; g.beginPath(); g.moveTo(x, y - 20 - f * 120); g.lineTo(x - 8 - f * 40, y); g.lineTo(x + 8 + f * 40, y); g.fill(); }
    };
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1_500_000 });
    const chunks = []; rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start(); const t0 = performance.now();
    await new Promise((res) => { const tick = () => { const tm = performance.now() - t0; draw(tm); if (tm < 3500) requestAnimationFrame(tick); else res(); }; tick(); });
    rec.stop(); await done;
    const buf = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  });
  await page.close();
  const dir = mkdtempSync(join(tmpdir(), 'spindro-video-'));
  const file = join(dir, 'strada.webm');
  writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

// ---------------------------------------------------------------- server e browser
function startServer() {
  const child = spawn(process.execPath, [join(ROOT, 'tests/serve.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((ok, ko) => {
    child.stdout.on('data', (d) => { if (String(d).includes('Server di test')) ok(child); });
    child.on('exit', (c) => ko(new Error(`server uscito con codice ${c}`)));
    setTimeout(() => ko(new Error('server non partito')), 8000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HISTORY = buildHistory();

// storage di partenza: niente consenso da chiedere, niente modalità sviluppatore, dati realistici
function seedScript(lang, extra) {
  const names = CUSTOM_NAMES[lang];
  const custom = { ...CUSTOM_WORKOUT, name: names[0], desc: names[1] };
  return {
    lang, analytics: '0', ftp: '220', mass: '72', hrMax: '188', weekGoal: '150', usePm: '0',
    watchBrand: 'garmin', videoRef: '25', seenTrainers: JSON.stringify(['Smart-T']),
    customWorkouts: JSON.stringify([custom]), rideHistory: JSON.stringify(HISTORY),
    rfProgress: JSON.stringify({ xp: 2300, stats: { kills: 310, rescued: 14, races: 6, podiums: 3, coins: 120, bosses: 2 }, achievements: {}, daily: null }),
    ...extra,
  };
}

async function newPage(context, lang, extra = {}) {
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript((seed) => {
    try {
      if (localStorage.getItem('__shots')) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('__shots', '1');
    } catch { /* storage non disponibile */ }
  }, seedScript(lang, extra));
  await page.addInitScript({ path: FAKE_BLE });
  // il rullo finto si presenta come un modello vero, senza "(finto)" nel nome
  await page.addInitScript(() => {
    const orig = navigator.bluetooth.requestDevice.bind(navigator.bluetooth);
    navigator.bluetooth.requestDevice = async (o) => { const d = await orig(o); if (/finto/.test(d.name)) Object.defineProperty(d, 'name', { value: 'Smart-T' }); return d; };
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => document.getElementById('startStop')?.textContent.trim().length > 0);
  await sleep(500);
  return page;
}

async function connect(page) {
  await page.click('#connectTrainer');
  await page.waitForFunction(() => /FTMS/.test(document.getElementById('trainerStatus').textContent));
  await sleep(300);
}
const setRide = (page, watts, cad, kmh = 30) => page.evaluate(([w, c, s]) => { __fakeBle.state.cadence = c; __fakeBle.state.speed = s; __fakeBle.setPower(w); }, [watts, cad, kmh]);

// ---------------------------------------------------------------- le 8 schermate
const SHOTS = {
  // 1) home collegata, uscita in corso con potenza, cadenza e marcia
  async 1(ctx, lang) {
    const page = await newPage(ctx, lang, { 'ride-freedom-session': JSON.stringify(buildLiveSession()) });
    await connect(page);
    await page.evaluate(() => document.querySelector('[data-preset="grade"][data-v="2"]').click());
    await page.evaluate(() => document.getElementById('startStop').click());
    for (let i = 0; i < 2; i++) { await page.evaluate(() => document.getElementById('up').click()); await sleep(120); }
    await setRide(page, 214, 88, 31.4);
    await sleep(3200); // lascia sparire il messaggio a comparsa
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(400);
    return page;
  },

  // 2) elenco degli allenamenti con i profili
  async 2(ctx, lang) {
    const page = await newPage(ctx, lang);
    await page.evaluate(() => document.getElementById('openWorkouts').click());
    await sleep(900);
    await page.evaluate(() => { const s = document.querySelector('#workoutSheet .sheet-body'); s.scrollTop = document.querySelector('.wk-h3').offsetTop - 12; });
    await sleep(500);
    return page;
  },

  // 3) editor degli allenamenti, con l'allenamento personalizzato aperto
  async 3(ctx, lang) {
    const page = await newPage(ctx, lang);
    await page.evaluate(() => document.getElementById('openWorkouts').click());
    await sleep(400);
    await page.evaluate(() => document.querySelector('[data-edit="custom-demo"]').click());
    await sleep(900);
    await page.evaluate(() => { document.getElementById('workoutSheet').hidden = true; }); // l'elenco resta sotto: via, per non avere due veli
    await sleep(300);
    return page;
  },

  // 4) gioco 3D in azione: Turbo Pedali (tappa in 3D)
  async 4(ctx, lang) {
    const page = await newPage(ctx, lang);
    await connect(page);
    for (let i = 0; i < 9; i++) await page.evaluate(() => document.getElementById('up').click()); // marcia più lunga: in Cambio la velocità in gioco dipende da marcia e cadenza
    await setRide(page, 250, 90, 34);
    await page.evaluate(() => document.getElementById('openGame').click());
    await sleep(500);
    await page.evaluate(() => document.querySelector('.game-card[data-game="racer"]').click());
    await page.waitForFunction(() => window.__game?.state === 'select', null, { timeout: 30000 }); // il circuito 3D si carica
    await page.waitForFunction(() => window.__game.selT > 0.6, null, { timeout: 30000 }); // il gioco ignora il "+" nei primi istanti
    await page.evaluate(() => window.__game.input(+1)); // "+ go!": parte la tappa
    await page.waitForFunction(() => window.__game.state === 'race', null, { timeout: 15000 });
    await setRide(page, 275, 94, 36);
    // in cloud il rendering software è lento e il tempo di gioco scorre piano: si aspetta che la tappa sia ben avviata
    await page.waitForFunction(() => window.__game.raceT > 14 || window.__game.state !== 'race', null, { timeout: 120000 });
    await sleep(500);
    return page;
  },

  // 5) pedalare su un video: qui un video locale disegnato dallo script (non YouTube)
  async 5(ctx, lang, env) {
    const page = await newPage(ctx, lang);
    await connect(page);
    await setRide(page, 190, 84, 28);
    await page.evaluate(() => document.getElementById('openGame').click());
    await sleep(400);
    await page.evaluate(() => document.querySelector('.game-card[data-game="video"]').click());
    await sleep(600);
    await page.setInputFiles('#vrFile', env.video);
    await sleep(3500);
    return page;
  },

  // 6) guida per collegare l'orologio (Impostazioni → il tuo orologio)
  async 6(ctx, lang) {
    const page = await newPage(ctx, lang);
    await page.evaluate(() => document.getElementById('openSettings').click());
    await sleep(700);
    await page.evaluate(() => {
      const g = document.getElementById('watchBrandGuide');
      const sec = g.closest('.group'); const body = document.querySelector('#settingsSheet .sheet-body');
      body.scrollTop = sec.offsetTop - 24;
    });
    await sleep(500);
    return page;
  },

  // 7) scheda di fine uscita con le medaglie
  async 7(ctx, lang) {
    const page = await newPage(ctx, lang, { 'ride-freedom-session': JSON.stringify(buildTodayRide()) });
    await page.evaluate(() => document.getElementById('finishRide').click());
    await sleep(4200);
    return page;
  },

  // 8) storico e record
  async 8(ctx, lang) {
    const page = await newPage(ctx, lang);
    await page.evaluate(() => document.getElementById('openHistory').click());
    await sleep(1200);
    return page;
  },
};

// ---------------------------------------------------------------- esecuzione
const server = await startServer();
const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
let failed = 0;
try {
  const probe = await browser.newContext();
  const env = { video: await makeFakeVideo(probe) };
  await probe.close();
  for (const lang of LANGS) {
    mkdirSync(join(OUT, lang), { recursive: true });
    for (const n of Object.keys(SHOTS).map(Number)) {
      if (ONLY && !ONLY.includes(n)) continue;
      // un contesto nuovo per ogni schermata: storage pulito e nessuno stato rimasto dalla precedente
      const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang, reducedMotion: 'no-preference' });
      try {
        const page = await SHOTS[n](ctx, lang, env);
        const file = join(OUT, lang, `${String(n).padStart(2, '0')}.png`);
        await page.screenshot({ path: file });
        if (page.errors.length) console.warn(`  ! ${lang}/${n}: errori JS: ${page.errors.join(' | ')}`);
        console.log(`ok  ${lang}/${String(n).padStart(2, '0')}.png`);
      } catch (e) { failed++; console.error(`ERR ${lang}/${n}: ${e.message}`); } finally { await ctx.close(); }
    }
  }
} finally { await browser.close(); server.kill(); }
process.exit(failed ? 1 : 0);
