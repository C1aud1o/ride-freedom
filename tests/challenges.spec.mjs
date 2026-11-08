// E5: sfide del mese (dallo storico locale, anche senza account) e classifiche (solo con gli account disponibili).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import * as ch from '../js/challenges.js';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));
const CONFIG = fileURLToPath(new URL('../js/config.js', import.meta.url));
const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const FIREBASE_HOSTS = /^(?!fonts\.).*(googleapis\.com|gstatic\.com|firebase|google\.com|recaptcha|cloudfunctions\.net)/i;
const TEST_CFG = "{ apiKey: 'fake-key', authDomain: 'demo-spindro.firebaseapp.com', projectId: 'demo-spindro', appId: '1:1:web:1', messagingSenderId: '1' }";

// storico finto: novembre 2026 (ora locale), FTP 200 → zona 2 = 112-150 W
const at = (day, h = 8) => new Date(2026, 10, day, h).getTime();
const z2series = (min) => Array(min * 6).fill(130); // una media ogni 10 s
const HIST = [
  { t: at(2), dur: 3600, km: 30, avgW: 130, kj: 470, series: z2series(60) },                // 60 min in zona 2
  { t: at(4), dur: 3600, km: 25.5, avgW: 160, kj: 580, series: Array(360).fill(180) },      // sopra zona 2
  { t: at(6), dur: 1800, km: 10, avgW: 100, kj: 180, series: Array(180).fill(100) },        // sotto zona 2
  { t: at(8), dur: 2400, km: 20, avgW: 130, kj: 300, series: z2series(40) },                // 40 min in zona 2
  { t: at(9), dur: 3600, km: 999, avgW: 130, kj: 470, src: 'import', series: z2series(60) }, // importata: non conta
  { t: new Date(2026, 9, 31, 22).getTime(), dur: 3600, km: 50, avgW: 130, kj: 470, series: z2series(60) }, // ottobre: non conta
];

test('sfide: avanzamento calcolato da uno storico finto', () => {
  const p = Object.fromEntries(ch.progress(HIST, '2026-11', 200).map((c) => [c.id, c]));
  expect(p.km300.value).toBeCloseTo(85.5, 5);
  expect(p.km300.pct).toBe(28);
  expect(p.km300.done).toBe(false);
  expect(p.rides10.value).toBe(4);
  expect(p.rides10.pct).toBe(40);
  expect(p.z2h2.value).toBeCloseTo(100, 5); // 60 + 40 min
  expect(p.z2h2.pct).toBe(83);
  // altro mese: solo ottobre
  expect(ch.progress(HIST, '2026-10', 200).find((c) => c.id === 'rides10').value).toBe(1);
  // con FTP 300 la zona 2 è 168-225 W: conta solo l'uscita a 180 W
  expect(ch.progress(HIST, '2026-11', 300).find((c) => c.id === 'z2h2').value).toBeCloseTo(60, 5);
});

test('sfide: una sfida si completa una volta sola, dall\'uscita che la porta oltre il traguardo', () => {
  const more = [...HIST, { t: at(10), dur: 1200, km: 20, avgW: 130, kj: 150, series: z2series(20) }]; // z2 → 120 min
  const done = ch.newlyDone(HIST, more, '2026-11', 200);
  expect(done.map((c) => c.id)).toEqual(['z2h2']);
  expect(ch.newlyDone(more, [...more, { t: at(11), dur: 600, km: 5, avgW: 130, kj: 50, series: z2series(10) }], '2026-11', 200)).toEqual([]);
});

test('le sfide del server coincidono con quelle dell\'app e ogni gioco ha i suoi limiti', () => {
  const ts = read('functions/src/challenges.ts');
  for (const c of ch.CHALLENGES.filter((x) => x.metric !== 'z2')) expect(ts).toContain(`{ id: '${c.id}', metric: '${c.metric}', target: ${c.target} }`);
  const app = read('js/app.js');
  const keys = [...app.slice(app.indexOf('\nconst GAME_DEFS = {')).split('\n};')[0].matchAll(/^  (\w+): \{ load:/gm)].map((m) => m[1]).filter((k) => k !== 'video');
  expect(keys.length).toBeGreaterThanOrEqual(6);
  const rules = read('functions/src/games.ts');
  for (const k of keys) expect(rules, `limiti anti-cheat per ${k}`).toMatch(new RegExp(`^  ${k}: \\{`, 'm'));
});

async function open(page, { storage = {}, config = false } = {}) {
  page.errors = []; page.reqs = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => page.reqs.push(r.url()));
  if (config) {
    await page.route('**/js/config.js', (route) => route.fulfill({
      contentType: 'text/javascript',
      body: readFileSync(CONFIG, 'utf8').replace('export const FIREBASE_CONFIG = null', `export const FIREBASE_CONFIG = ${TEST_CFG}`),
    }));
  }
  await page.clock.install({ time: new Date(2026, 10, 12, 18, 0) });
  await page.addInitScript((s) => {
    try { if (!localStorage.getItem('__init')) { localStorage.setItem('__init', '1'); localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } } catch { /* */ }
  }, storage);
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
}

test('card delle sfide nella home, senza account e senza rete verso Google', async ({ page }) => {
  await open(page, { storage: { rideHistory: JSON.stringify(HIST) } });
  const card = page.locator('#challengeCard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('novembre');
  await expect(card.locator('li[data-ch=km300]')).toContainText('300 km');
  await expect(card.locator('li[data-ch=km300] .goal-bar i')).toHaveAttribute('style', /width:\s*28%/);
  await expect(card.locator('li[data-ch=rides10] .goal-bar i')).toHaveAttribute('style', /width:\s*40%/);
  await expect(card.locator('li[data-ch=z2h2]')).toContainText('2 ore in zona 2');
  await expect(card.locator('li[data-ch=z2h2]')).toContainText('100 / 120 min');
  // nessuna classifica, nessun invito, nessuna rete verso Google
  await page.click('#openGame');
  await expect(page.locator('#gameMenu')).toBeVisible();
  await expect(page.locator('#boardPanel')).toBeHidden();
  expect(await page.locator('#boardPanel').innerText()).toBe('');
  expect(page.reqs.filter((u) => FIREBASE_HOSTS.test(new URL(u).hostname))).toEqual([]);
  expect(page.reqs.filter((u) => /\/js\/account\/(ui|sync|boards)\.js/.test(u))).toEqual([]);
  expect(page.errors).toEqual([]);
});

test('senza storico la card non c\'è', async ({ page }) => {
  await open(page);
  await expect(page.locator('#challengeCard')).toBeHidden();
});

test('a fine uscita una sfida completata dà la medaglia', async ({ page }) => {
  // 9 uscite a novembre: la decima (questa, oltre 60 s) completa "10 uscite"
  const hist = Array.from({ length: 9 }, (_, i) => ({ t: at(i + 1), dur: 1800, km: 5, avgW: 120, kj: 200 }));
  await open(page, { storage: { rideHistory: JSON.stringify(hist) } });
  await expect(page.locator('#challengeCard li[data-ch=rides10]')).toContainText('9 / 10');
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await page.click('#startStop');
  await page.clock.runFor(65_000);
  await page.click('#finishRide');
  await expect(page.locator('#finishBadges')).toContainText('Sfida completata');
  await expect(page.locator('#finishBadges')).toContainText('10 uscite');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('challengeDone')))))
    .toEqual(['2026-11:rides10']);
});

test('con gli account disponibili ma senza login: solo un invito discreto, nessun SDK', async ({ page }) => {
  await open(page, { config: true, storage: { rideHistory: JSON.stringify(HIST) } });
  await page.route('https://www.gstatic.com/**', (route) => route.abort());
  await page.click('#openGame');
  await expect(page.locator('#boardPanel')).toContainText('Accedi per entrare in classifica');
  await expect(page.locator('#boardPanel details')).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(page.reqs.filter((u) => FIREBASE_HOSTS.test(new URL(u).hostname))).toEqual([]);
  // l'invito porta alle impostazioni, sulla sezione Account
  await page.click('#boardPanel [data-act=login]');
  await expect(page.locator('#settingsSheet')).toBeVisible();
  await expect(page.locator('#gamePanel')).toBeHidden();
  expect(page.errors).toEqual([]);
});

// ---- SDK Firebase finto: serve al posto di gstatic per provare invio punteggio e classifica senza rete ----
const STUB = {
  'firebase-app.js': 'export const initializeApp = () => ({});',
  'firebase-auth.js': 'export const getAuth = () => ({ currentUser: { uid: "me", emailVerified: true }, authStateReady: async () => {} }); export const onAuthStateChanged = () => {}; export class GoogleAuthProvider {}',
  'firebase-functions.js': 'export const connectFunctionsEmulator = () => {}; export const getFunctions = () => ({}); export const httpsCallable = (_f, name) => async (data) => { (window.__calls ||= []).push({ name, data }); return { data: { ok: true } }; };',
  'firebase-firestore-lite.js': `
    export const getFirestore = () => ({});
    const rows = [{ uid: 'a', name: 'Anna', country: 'IT', score: 9000, sortKey: 9000 }, { uid: 'b', name: '<b>Bruno</b>', country: 'FR', score: 7000, sortKey: 7000 }];
    const log = (window.__reads ||= []);
    export const collection = (_d, path) => ({ path });
    export const doc = (c, id) => ({ path: c.path ? c.path + '/' + id : id });
    export const where = (...a) => ({ w: a }); export const orderBy = (...a) => ({ o: a }); export const limit = (n) => ({ l: n });
    export const query = (c, ...cs) => ({ path: c.path, cs });
    export const getDocs = async (q) => { log.push(['getDocs', q.path, JSON.stringify(q.cs)]); return { docs: rows.map((r) => ({ data: () => r })) }; };
    export const getDoc = async (r) => { log.push(['getDoc', r.path]); return r.path.startsWith('users/') ? { exists: () => true, get: () => 'IT' } : { exists: () => true, get: () => 'IT', data: () => ({ uid: 'me', name: 'Io', country: 'IT', score: 500, sortKey: 500 }) }; };
    export const getCount = async (q) => { log.push(['getCount', q.path]); return { data: () => ({ count: 41 }) }; };`,
};

async function withStub(page) {
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    const f = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ contentType: 'text/javascript', body: STUB[f] ?? 'export {}' });
  });
}

test('con un account: classifica a tab con 20 righe al massimo, la mia posizione e nome sicuro', async ({ page }) => {
  await withStub(page);
  await open(page, { config: true, storage: { 'sync:uid': 'me', 'account:session': '1' } });
  await page.click('#openGame');
  const bd = page.locator('#boardPanel details');
  await expect(bd).toBeVisible();
  await bd.locator('summary').click();
  await expect(page.locator('.bd-list')).not.toContainText('Carico');
  await expect(page.locator('.bd-rows li')).toHaveCount(2);
  await expect(page.locator('.bd-rows li').first()).toContainText('Anna');
  await expect(page.locator('.bd-rows')).toContainText('<b>Bruno</b>'); // testo, non HTML
  await expect(page.locator('.bd-me')).toContainText('42'); // 41 davanti + 1
  const reads = await page.evaluate(() => window.__reads);
  expect(reads.filter((r) => r[0] === 'getDocs')).toHaveLength(1);
  expect(reads[0][2]).toContain('"l":20'); // limit 20
  // tab "Il mio Paese": filtra per Paese
  await page.click('.bd-tabs [data-tab=country]');
  await expect(page.locator('.bd-me')).toBeVisible();
  const r2 = await page.evaluate(() => window.__reads.filter((r) => r[0] === 'getDocs').pop());
  expect(r2[2]).toContain('"w":["country","==","IT"]');
  // la seconda vista della stessa classifica arriva dalla cache: nessuna lettura in più
  const n = await page.evaluate(() => window.__reads.length);
  await page.click('.bd-tabs [data-tab=week]'); await page.click('.bd-tabs [data-tab=week]');
  await expect(page.locator('.bd-rows li')).toHaveCount(2);
  await page.click('.bd-tabs [data-tab=country]');
  await expect(page.locator('.bd-me')).toBeVisible();
  expect((await page.evaluate(() => window.__reads.length)) - n).toBeLessThanOrEqual(3); // solo la settimana, una volta
  expect(page.errors).toEqual([]);
});

test('con un account: a fine partita il punteggio parte con submitScore (solo col rullo collegato)', async ({ page }) => {
  await withStub(page);
  await open(page, { config: true, storage: { 'sync:uid': 'me', 'account:session': '1' } });
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await page.click('#openGame');
  await page.click('[data-game=mattoni]');
  await expect.poll(() => page.evaluate(() => window.__game?.state)).toBe('menu');
  await page.evaluate(() => { const g = window.__game; g.begin(); g.score = 1234; });
  await page.clock.fastForward(25_000);
  await page.evaluate(() => window.__game.end());
  await expect.poll(() => page.evaluate(() => window.__calls?.length || 0)).toBe(1);
  const c = await page.evaluate(() => window.__calls[0]);
  expect(c.name).toBe('submitScore');
  expect(c.data).toMatchObject({ game: 'mattoni', score: 1234 });
  expect(c.data.durationSec).toBeGreaterThanOrEqual(20);
  expect(Object.keys(c.data).sort()).toEqual(['avgW', 'durationSec', 'game', 'maxW', 'runId', 'score']);
  expect(c.data.runId).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
  expect(page.errors).toEqual([]);
});

test('senza login nessun punteggio parte', async ({ page }) => {
  await withStub(page);
  await open(page, { config: true });
  await page.click('#connectTrainer');
  await page.click('#openGame'); await page.click('[data-game=mattoni]');
  await expect.poll(() => page.evaluate(() => window.__game?.state)).toBe('menu');
  await page.evaluate(() => { const g = window.__game; g.begin(); g.score = 500; });
  await page.clock.fastForward(25_000);
  await page.evaluate(() => window.__game.end());
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__calls?.length || 0)).toBe(0);
});
