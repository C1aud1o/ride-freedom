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
  await page.waitForFunction(() => window.__game.state === 'race', null, { timeout: 90000 });
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
    await page.waitForFunction(() => window.__game.state === 'finishCam', null, { timeout: 90000 });
    await page.waitForTimeout(700); await shot('arrivo');
    await page.waitForFunction(() => window.__game.state === 'results', null, { timeout: 90000 });
    await page.waitForTimeout(2600); await shot('podio');
  }
  if (args.includes('--fps')) {
    // misura in gara con la CPU rallentata 4x (come un Android medio):
    // - fps del browser (qui il disegno è software, SwiftShader: non rappresenta la GPU di un telefono);
    // - tempo JS per fotogramma (logica + preparazione del disegno), draw call e triangoli per fotogramma.
    const cdp = await ctx.newCDPSession(page);
    for (const level of ['high', 'medium', 'low']) {
      await page.evaluate((level) => { const g = window.__game; g.quality.auto = false; g.quality.decided = true; g.quality.set(level); g.newRace(); }, level);
      await page.waitForFunction(() => window.__game.state === 'race', null, { timeout: 90000 });
      await page.evaluate(() => { const g = window.__game; g.s = g.climbs[Math.floor(g.climbs.length / 2)] - 20; g.rivals.forEach((r, i) => { r.s = g.s + (i - 3) * 4; }); });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const m = await page.evaluate(() => new Promise((res) => {
        const g = window.__game; const st = g.stage; const r = st.renderer;
        // costo CPU = logica + pose + preparazione del disegno + HUD; il primo render del fotogramma aspetta la GPU
        // emulata, quindi si misura il costo di un secondo render identico subito dopo (GPU libera)
        const T = { cpu: 0, frames: 0, calls: 0, tris: 0 }; const saved = {};
        const wrap = (obj, name, fn) => { saved[name] = obj[name]; const o = obj[name].bind(obj); obj[name] = (...x) => fn(o, ...x); };
        wrap(g, 'update', (o, ...x) => { const t = performance.now(); o(...x); T.cpu += performance.now() - t; });
        wrap(g, 'drawHud', (o, ...x) => { const t = performance.now(); o(...x); T.cpu += performance.now() - t; });
        let inRender = 0;
        wrap(g, 'draw', (o, ...x) => { const t = performance.now(); inRender = 0; o(...x); T.cpu += performance.now() - t - inRender; T.frames++; });
        const sr = st.render.bind(st);
        st.render = () => {
          const a = performance.now(); r.info.autoReset = false; r.info.reset(); sr(); const b = performance.now();
          T.calls += r.info.render.calls; T.tris += r.info.render.triangles; r.info.autoReset = true;
          if (st.composer) st.composer.render(); else r.render(st.scene, st.camera);
          const c = performance.now(); inRender = c - a; T.cpu += c - b;
        };
        const t0 = performance.now();
        setTimeout(() => {
          for (const k of Object.keys(saved)) g[k] = saved[k]; st.render = sr;
          const sec = (performance.now() - t0) / 1000;
          res({ fps: T.frames / sec, js: T.cpu / T.frames, calls: T.calls / T.frames, tris: T.tris / T.frames });
        }, 8000);
      }));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(`${w}x${h} qualità ${level}: fps nel browser di prova (GPU software) ${m.fps.toFixed(1)} · CPU ${m.js.toFixed(1)} ms/fotogramma con CPU 4x (≈ ${Math.min(60, 1000 / m.js).toFixed(0)} fps se la GPU regge) · draw call ${Math.round(m.calls)} · triangoli ${Math.round(m.tris / 1000)}k`);
    }
  }
  if (errors.length) console.log('ERRORI:', errors.join('\n'));
  await ctx.close();
}
await browser.close();
