// Calibrazione della cadenza (rulli che non la trasmettono, es. D100) e durezza del cambio virtuale.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

test('calibrazione: con un sensore di cadenza vero il rapporto è cadenza / velocità', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.addInitScript(() => { localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await page.clock.runFor(4000); // il rullo finto: 28 km/h e 80 rpm; le medie si stabilizzano
  await page.click('#openSettings');
  await expect(page.locator('#cadFactorInfo')).toContainText('non calibrato');
  await page.click('#calibrateCad');
  await page.click('.calib-go');
  await page.clock.runFor(23000);
  await expect(page.locator('.calib-msg')).toContainText('2.86');
  expect(await page.evaluate(() => localStorage.getItem('cadFactor'))).toBe('2.86');
  await page.click('.calib-cancel');
  await expect(page.locator('#cadFactorInfo')).toContainText('2.86');
  await page.click('#cadFactorReset');
  await expect(page.locator('#cadFactorInfo')).toContainText('non calibrato');
  expect(errors).toEqual([]);
});

test('durezza del cambio virtuale: si sceglie e resta salvata', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('lang', 'it'); localStorage.setItem('analytics', '0'); });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
  await page.click('#openSettings');
  await expect(page.locator('#gearFeelChips button[data-f="100"]')).toHaveClass(/on/);
  await page.click('#gearFeelChips button[data-f="60"]');
  await expect(page.locator('#gearFeelChips button[data-f="60"]')).toHaveClass(/on/);
  expect(await page.evaluate(() => localStorage.getItem('gearFeel'))).toBe('60');
});
