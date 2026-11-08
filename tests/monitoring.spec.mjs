// D1 (consenso e statistiche anonime) e B4 (Segnala il tuo rullo).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));
const CONFIG = fileURLToPath(new URL('../js/config.js', import.meta.url));

// Per il test, config.js ha un indirizzo GoatCounter; count.js è sostituito da un finto che registra gli eventi.
async function setup(page, { analytics } = {}) {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.gcRequests = [];
  await page.route('**/js/config.js', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `${readFileSync(CONFIG, 'utf8')}\n`.replace("GOATCOUNTER_URL = ''", "GOATCOUNTER_URL = 'https://test.goatcounter.example/count'"),
  }));
  await page.route('https://gc.zgo.at/**', (route) => {
    page.gcRequests.push(route.request().url());
    route.fulfill({ contentType: 'text/javascript', body: 'window.__gcEvents = []; window.goatcounter.count = (e) => window.__gcEvents.push(e.path);' });
  });
  await page.addInitScript((a) => {
    try { localStorage.setItem('lang', 'it'); if (a != null && !localStorage.getItem('analytics')) localStorage.setItem('analytics', a); } catch { /* */ }
  }, analytics ?? null);
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
}

test('primo avvio: la scheda del consenso appare; "No" non carica GoatCounter', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#consentSheet')).toBeVisible();
  await expect(page.locator('#consentSheet')).toContainText('Aiutaci a migliorare Spindro');
  await page.click('#consentNo');
  await expect(page.locator('#consentSheet')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('analytics'))).toBe('0');
  await page.waitForTimeout(500);
  expect(page.gcRequests).toEqual([]);
  expect(await page.locator('script[src*="goatcounter"], script[src*="gc.zgo.at"]').count()).toBe(0);
  // riaprendo l'app la domanda non si ripete e GoatCounter resta spento
  await page.reload();
  await expect(page.locator('#consentSheet')).toBeHidden();
  expect(page.gcRequests).toEqual([]);
  expect(page.errors).toEqual([]);
});

test('"Sì" carica GoatCounter e invia gli eventi anonimi; modificabile nelle Impostazioni', async ({ page }) => {
  await setup(page);
  await page.click('#consentYes');
  await expect.poll(() => page.gcRequests.length).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__gcEvents)).toEqual(expect.arrayContaining(['app-open', 'lang/it']));
  // dalle Impostazioni si può togliere il consenso: l'impostazione è salvata
  await page.click('#openSettings');
  await expect(page.locator('#analyticsOn')).toBeChecked();
  await page.locator('#analyticsOn').evaluate((el) => el.click());
  expect(await page.evaluate(() => localStorage.getItem('analytics'))).toBe('0');
  expect(page.errors).toEqual([]);
});

test('con consenso già dato GoatCounter parte all\'apertura; con rullo collegato invia il protocollo', async ({ page }) => {
  await setup(page, { analytics: '1' });
  await expect(page.locator('#consentSheet')).toBeHidden();
  await expect.poll(() => page.gcRequests.length).toBe(1);
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await expect.poll(() => page.evaluate(() => window.__gcEvents)).toContain('trainer/FTMS');
});

test('"Segnala il tuo rullo": il link contiene template e campi giusti, senza dati personali', async ({ page }) => {
  await setup(page, { analytics: '0' });
  await page.evaluate(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  // prima connessione: compare l'invito
  await expect(page.locator('#reportHint')).toBeVisible();
  await page.click('#reportHintGo');
  await page.click('#openSettings');
  await page.click('#reportTrainer');
  const urls = await page.evaluate(() => window.__opened);
  expect(urls).toHaveLength(2);
  for (const raw of urls) {
    const u = new URL(raw);
    expect(u.origin + u.pathname).toBe('https://github.com/c1aud1o/ride-freedom/issues/new');
    expect(u.searchParams.get('template')).toBe('trainer_compatibility.yml');
    expect(u.searchParams.get('platform')).toBe('Web app (Chrome on desktop)');
    expect(u.searchParams.get('model')).toBeTruthy();
    const d = u.searchParams.get('details');
    expect(d).toContain('BLE name: ');
    expect(d).toContain('BLE services: Fitness Machine (FTMS)');
    expect(d).toContain('Protocol used: FTMS');
    expect(d).toMatch(/ERG \(target power\) available: (yes|no)/);
    expect(d).toMatch(/Gradient \(simulation\) available: (yes|no)/);
    expect(d).toContain('App version: ');
    expect(d).toContain('Platform: Web');
    expect(raw).not.toContain('+');
  }
  // la seconda volta lo stesso rullo non rifà l'invito
  await page.click('.close[data-close="settingsSheet"]');
  await page.click('#connectTrainer'); // scollega
  await page.click('#connectTrainer'); // ricollega
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
  await expect(page.locator('#reportHint')).toBeHidden();
});

test('guide orologi: il selettore mostra i passi di ogni marca, senza dire "verificato"', async ({ page }) => {
  await setup(page, { analytics: '0' });
  await page.click('#openSettings');
  for (const b of ['wahoo', 'coros', 'suunto', 'polar', 'apple']) {
    await page.selectOption('#watchBrand', b);
    await expect(page.locator('#watchBrandGuide li')).toHaveCount(3);
    await expect(page.locator('#watchBrandGuide')).toContainText('Dovrebbe funzionare');
    await expect(page.locator('#watchBrandGuide')).not.toContainText(/verificat/i);
  }
  await page.selectOption('#watchBrand', 'garmin');
  await expect(page.locator('#watchBrandGuide .wg-steps li')).toHaveCount(3);
});
