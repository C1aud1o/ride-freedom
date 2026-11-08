// Foto e misure di Turbo Pedali con il rullo finto (tests/fake-ble.js).
//   node tests/serve.mjs &   (server statico sulla porta 4173)
//   PW_CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/game-shots.mjs [--fps] [--only=390x844]
// Salva in docs/giochi-shots/: racer-<scena>-<larghezza>x<altezza>.png
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const FAKE_BLE = fileURLToPath(new URL('../tests/fake-ble.js', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/giochi-shots/', import.meta.url));
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const sizes = [[390, 844], [1280, 720]].filter(([w, h]) => !only || only === `${w}x${h}`);
const scenes = (args.find((a) => a.startsWith('--scenes='))?.slice(9) || 'start,climb,sprint,podium').split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'],
});

async function openRacer(page, quality = 'high') {
  await page.addInitScript((q) => {
    localStorage.setItem('__seeded', '1'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); localStorage.setItem('mass', '75');
    localStorage.setItem('lang', 'it'); localStorage.setItem('gameQuality', q); localStorage.setItem('racer3dStage', '1');
  }, quality);
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto(`${BASE}/index.html`);
  await page.click('#connectTrainer');
  await page.waitForFunction(() => /FTMS/.test(document.querySelector('#trainerStatus')?.textContent || ''));
  await page.evaluate(() => { window.__fakeBle.setPower(240); });
  await page.click('#openGame');
  await page.click('[data-game=racer]');
  await page.waitForFunction(() => window.__game?.state === 'select', null, { timeout: 60000 });
}

// sposta la gara in un punto: giocatore a s, rivali intorno
async function teleport(page, where) {
  await page.evaluate((where) => {
    const g = window.__game;
    let s = 20;
    if (where === 'climb') { const c = g.climbs; s = c[Math.floor(c.length * 0.45)] - 18; }
    if (where === 'sprint') s = g.length - 120;
    if (where === 'finish') s = g.length - 6;
    g.s = s; g.x = 0; g.lane = 1; g.camInit = false;
    const offs = { start: [3, 5, 7, 9, 11, 13, 15], climb: [-9, 6, 9, 15, 22, 30, -16], sprint: [5.5, 2.5, 9, -9, 13, -14, 18], finish: [-2, -4, 1.5, -8, -11, -16, -25] }[where];
    g.rivals.forEach((r, i) => { r.s = s + offs[i]; r.speed = 9; r.x = [0, -2.4, 2.4, 0, 2.4, -2.4, 0][i]; r.targetX = r.x; });
    g.state = 'race'; g.stateT = 5; g.time.slow = 0; g.raceT = where === 'start' ? 3 : where === 'climb' ? 210 : 395;
    g.standing = g.ranking();
  }, where);
}

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await openRacer(page);
  const shot = async (name) => { await page.screenshot({ path: `${OUT}racer-${name}-${w}x${h}.png` }); console.log(`✓ ${name} ${w}x${h}`); };
  if (scenes.includes('select')) { await page.waitForTimeout(1500); await shot('menu'); }
  // via
  await page.evaluate(() => { window.__game.selT = 1; window.__game.input(1); });
  if (scenes.includes('start')) { await page.waitForTimeout(1200); await shot('partenza'); }
  await page.waitForFunction(() => window.__game.state === 'race', null, { timeout: 15000 });
  if (scenes.includes('climb')) {
    await teleport(page, 'climb'); await page.waitForTimeout(2500); await shot('salita');
  }
  if (scenes.includes('sprint')) {
    await teleport(page, 'sprint'); await page.evaluate(() => { window.__fakeBle.setPower(650); });
    await page.waitForTimeout(2200); await shot('volata');
  }
  if (scenes.includes('podium')) {
    await page.evaluate(() => { window.__fakeBle.setPower(400); });
    await teleport(page, 'finish');
    await page.waitForFunction(() => window.__game.state === 'finishCam', null, { timeout: 15000 });
    await page.waitForTimeout(700); await shot('arrivo');
    await page.waitForFunction(() => window.__game.state === 'results', null, { timeout: 15000 });
    await page.waitForTimeout(2600); await shot('podio');
  }
  if (args.includes('--fps')) {
    // fps in gara con la CPU rallentata 4x (come un Android medio), qualità decisa dall'automatico
    const cdp = await ctx.newCDPSession(page);
    await page.evaluate(() => { window.__game.newRace(); });
    await page.waitForFunction(() => window.__game.state === 'race', null, { timeout: 15000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
    const info = await page.evaluate(() => { const g = window.__game; const r = g.stage.renderer.info.render; return { level: g.quality.level, calls: r.calls, tris: r.triangles }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`fps ${w}x${h} (CPU 4x): ${fps.toFixed(1)} · qualità ${info.level} · draw call ${info.calls} · triangoli ${info.tris}`);
  }
  if (errors.length) console.log('ERRORI:', errors.join('\n'));
  await ctx.close();
}
await browser.close();
