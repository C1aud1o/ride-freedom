// Giochi 3D con il rullo finto: si caricano, partono e + / − in Turbo Pedali cambiano marcia.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));
test.setTimeout(150_000);

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); localStorage.setItem('gameQuality', 'low'); } localStorage.setItem('lang', 'it'); } catch { /* niente storage */ }
  });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
});

test.afterEach(async ({ page }) => {
  expect(page.errors, 'errori JavaScript non gestiti nella pagina').toEqual([]);
});

test('Turbo Pedali: si carica, parte e + / − cambiano marcia', async ({ page }) => {
  await page.click('#openGame');
  await page.click('[data-game=racer]');
  await expect.poll(() => page.evaluate(() => window.__game?.state), { timeout: 120_000 }).toBe('select');
  await page.evaluate(() => { window.__game.selT = 1; window.__game.input(1); });
  await expect.poll(() => page.evaluate(() => window.__game.state), { timeout: 60_000 }).toMatch(/countdown|race/);
  const gear0 = await page.locator('#gearNum').textContent();
  await page.evaluate(() => window.__game.input(1));
  await expect(page.locator('#gearNum')).not.toHaveText(gear0);
  await expect.poll(() => page.evaluate(() => window.__game.state), { timeout: 60_000 }).toBe('race');
  // la pendenza della tappa arriva al rullo: in salita il gioco imposta un grado positivo
  await page.evaluate(() => { const g = window.__game; g.s = g.climbs[Math.floor(g.climbs.length / 2)]; });
  await expect.poll(() => page.evaluate(() => window.__game.sentGrade), { timeout: 30_000 }).toBeGreaterThan(2);
  // arrivo e podio
  await page.evaluate(() => { const g = window.__game; g.s = g.length - 1; });
  await expect.poll(() => page.evaluate(() => window.__game.state), { timeout: 60_000 }).toBe('finishCam');
  await expect.poll(() => page.evaluate(() => window.__game.state), { timeout: 90_000 }).toBe('results');
});

for (const kind of ['horde', 'shooter']) {
  test(`${kind}: il gioco 3D si carica con la nuova base`, async ({ page }) => {
    await page.click('#openGame');
    await page.evaluate(() => document.body.classList.add('dev'));
    await page.click(`[data-game=${kind}]`);
    await expect.poll(() => page.evaluate(() => window.__game?.state), { timeout: 120_000 }).toMatch(/menu|select|play|intro|hero/);
    await page.waitForTimeout(1500);
  });
}
