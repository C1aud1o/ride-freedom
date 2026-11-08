// Misura l'avvio su rete lenta: node scripts/measure-startup.mjs  (server di test su :4173 già attivo, o lo avvia)
// Throttling: 1,6 Mbit/s, 150 ms di latenza (Slow 4G di Lighthouse), CPU 4x più lenta, telefono 390x844.
import { chromium } from 'playwright';
const url = process.env.URL || 'http://127.0.0.1:4173/index.html';
const runs = Number(process.env.RUNS || 3);
const res = [];
for (let i = 0; i < runs; i++) {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // i font esterni non c'entrano con il nostro codice
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0; let reqs = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; reqs++; });
  await page.addInitScript(() => { localStorage.setItem('analytics', '0'); localStorage.setItem('lang', 'en'); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.querySelector('#startStop')?.textContent.trim().length > 0, null, { timeout: 120000 });
  const interactive = Date.now() - t0;
  await page.waitForLoadState('networkidle');
  const fcp = await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null);
  res.push({ interactiveMs: interactive, fcpMs: Math.round(fcp), kb: Math.round(bytes / 1024), reqs });
  await b.close();
}
const med = (k) => res.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(res.length / 2)];
console.log(JSON.stringify({ runs: res, median: { interactiveMs: med('interactiveMs'), fcpMs: med('fcpMs'), kb: med('kb'), reqs: med('reqs') } }, null, 1));
