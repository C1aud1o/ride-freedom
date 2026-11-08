// Primo allenamento senza FTP impostata: l'app la chiede (livello × peso, valore proprio o test) invece di usare 200 W.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

test('senza FTP il primo allenamento chiede il livello e usa la stima', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); localStorage.setItem('mass', '70'); });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await page.click('#openWorkouts');
  await page.locator('#workoutList [data-wk]').first().click();
  await expect(page.locator('.calib-box')).toContainText('FTP');
  // "Inizio ora": 1,8 W/kg × 70 kg ≈ 125 W
  await page.locator('.ftp-levels button').first().click();
  await expect(page.locator('#workoutCard')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ftp'))).toBe('125');
  page.once('dialog', (d) => d.accept());
  await page.click('#wkStop');
  expect(errors).toEqual([]);
});
