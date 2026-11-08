#!/usr/bin/env node
// Cattura gli screenshot dell'app per il sito: home, un gioco, scheda di fine uscita.
// Serve la root del repo con un piccolo server locale e usa il rullo Bluetooth finto dei test (tests/fake-ble.js).
//   node site/shots.mjs            -> site/assets/shots/{home,game,finish}.jpg  (poi: node site/build.mjs)
// Nel cloud usa /opt/pw-browsers/chromium; altrove PW_CHROMIUM_PATH=/percorso/chrome oppure `npm ci`.
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, launchOptions } from './pw.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = join(here, 'assets/shots');
const GAME = process.env.SHOT_GAME || 'racer'; // data-game di index.html: racer, shooter, horde, planata, gruppetto, mattoni, video
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.woff2': 'font/woff2' };

const server = http.createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p += 'index.html';
    const file = join(root, p);
    if (!file.startsWith(root) || file.startsWith(join(root, 'site/dist'))) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('non è un file');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch(launchOptions);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'it-IT', colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.setItem('ftp', '230'); localStorage.setItem('mass', '75'); } catch { /* niente storage */ } });
await page.addInitScript({ path: join(root, 'tests/fake-ble.js') });
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 82 }).then(() => console.log(`salvato site/assets/shots/${name}.jpg`));

await page.goto(`${base}/index.html`);
await page.click('#connectTrainer');
await page.waitForFunction(() => /FTMS/.test(document.querySelector('#trainerStatus')?.textContent || ''));
await page.evaluate(() => window.__fakeBle.setPower(232));
await page.click('#startStop');
await page.waitForTimeout(4000);
await shot('home');

await page.click('#openGame');
await page.click(`.game-card[data-game="${GAME}"]`);
await page.waitForTimeout(3000); // lascia caricare il gioco (WebGL software: lento)
await page.keyboard.press('ArrowUp'); // "+" = via! (dal menu di tappa si parte)
await page.waitForTimeout(9000);
await shot('game');

await page.click('#closeGame'); await page.click('#closeGame');
await page.click('#finishRide');
await page.waitForSelector('#finishSheet:not([hidden])');
await page.waitForTimeout(1500);
await shot('finish');

if (errors.length) console.warn('errori JS nella pagina:', errors);
await browser.close(); server.close();
