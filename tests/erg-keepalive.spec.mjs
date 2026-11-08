// ERG: il comando "potenza richiesta" (FTMS 0x05) viene ripetuto ogni ~2 s anche se il valore non cambia,
// perché alcuni rulli (es. D100) non ricalcolano la resistenza finché non ricevono un nuovo comando.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

test('in ERG la potenza richiesta viene rinviata periodicamente', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => { localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await page.locator('label:has(input[name=mode][value=erg])').click();
  await page.clock.runFor(2000);
  const before = await page.evaluate(() => window.__fakeBle.state.controlLog.filter((b) => b[0] === 0x05).length);
  await page.clock.runFor(10000); // 10 s con la stessa potenza
  const sent = await page.evaluate(() => window.__fakeBle.state.controlLog.filter((b) => b[0] === 0x05));
  expect(sent.length - before).toBeGreaterThanOrEqual(4);
  const w = sent[sent.length - 1][1] | (sent[sent.length - 1][2] << 8);
  expect(w).toBe(150); // valore invariato: è lo stesso comando ripetuto
  expect(errors).toEqual([]);
});
