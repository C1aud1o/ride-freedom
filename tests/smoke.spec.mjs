// Test di fumo di Spindro: veloci, con un rullo FTMS e uno Zwift Click finti (tests/fake-ble.js).
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // l'app non ha un vero onboarding; si parte da dati puliti con valori noti. I selettori sul testo usano l'italiano: lang=it salvo diversa scelta del test
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('__seeded')) { localStorage.setItem('__seeded', '1'); localStorage.setItem('analytics', '0'); localStorage.setItem('ftp', '200'); localStorage.setItem('mass', '80'); } if (!localStorage.getItem('lang')) localStorage.setItem('lang', 'it'); } catch { /* niente storage */ }
  });
  await page.addInitScript({ path: FAKE_BLE });
  await page.goto('/index.html');
});

test.afterEach(async ({ page }) => {
  expect(page.errors, 'errori JavaScript non gestiti nella pagina').toEqual([]);
});

async function connectTrainer(page) {
  await page.click('#connectTrainer');
  await expect(page.locator('#trainerStatus')).toContainText('FTMS');
}

test('la home si carica senza errori', async ({ page }) => {
  await expect(page.locator('#power')).toBeVisible();
  await expect(page.locator('#connectTrainer')).toBeEnabled();
  await expect(page.locator('#unsupported')).toBeHidden();
  await expect(page.locator('#startStop')).toHaveText('Avvia');
});

test('collegando il rullo finto la potenza mostrata cambia', async ({ page }) => {
  await connectTrainer(page);
  await expect(page.locator('#power')).toHaveText('150');
  await page.evaluate(() => window.__fakeBle.setPower(250));
  await expect(page.locator('#power')).toHaveText('250');
  await expect(page.locator('#cadence')).toHaveText('80');
  await page.evaluate(() => window.__fakeBle.setPower(180));
  await expect(page.locator('#power')).toHaveText('180');
});

test('il Zwift Click finto cambia marcia', async ({ page }) => {
  await connectTrainer(page);
  await page.click('#connectClick');
  await expect(page.locator('#clickStatus')).toContainText('Zwift');
  await expect(page.locator('#gearNum')).toHaveText('12');
  await page.evaluate(() => window.__fakeBle.press(+1));
  await expect(page.locator('#gearNum')).toHaveText('13');
  await page.evaluate(() => window.__fakeBle.press(-1));
  await page.evaluate(() => window.__fakeBle.press(-1));
  await expect(page.locator('#gearNum')).toHaveText('11');
});

test('i pulsanti + e − dell\'app cambiano marcia e comandano il rullo', async ({ page }) => {
  await connectTrainer(page);
  await expect(page.locator('#gearNum')).toHaveText('12');
  await page.click('#up');
  await expect(page.locator('#gearNum')).toHaveText('13');
  await page.click('#down');
  await page.click('#down');
  await expect(page.locator('#gearNum')).toHaveText('11');
  // il Control Point finto ha ricevuto almeno richiesta di controllo e un comando di simulazione/potenza
  const ops = await page.evaluate(() => window.__fakeBle.state.controlLog.map((c) => c[0]));
  expect(ops).toContain(0x00);
  expect(ops.some((o) => o === 0x11 || o === 0x05)).toBe(true);
});

test('avvia, termina e salva un file .FIT valido', async ({ page }) => {
  await connectTrainer(page);
  await page.click('#startStop');
  await expect(page.locator('#startStop')).toHaveText('Pausa');
  await expect(page.locator('#time')).not.toHaveText('0:00');
  await expect(page.locator('#finishRide')).toBeEnabled();
  await page.click('#finishRide');
  await expect(page.locator('#finishSheet')).toBeVisible();
  await expect(page.locator('#finishSummary')).toContainText('W medi');
  await expect(page.locator('#saveFit')).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#saveFit')]);
  expect(download.suggestedFilename()).toMatch(/\.fit$/i);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(14);
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('.FIT');
});

test('il menu Allenamenti si apre e un allenamento parte', async ({ page }) => {
  await page.click('#openWorkouts');
  await expect(page.locator('#workoutSheet')).toBeVisible();
  const items = page.locator('#workoutList [data-wk]');
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThan(1);
  await items.first().click();
  await expect(page.locator('#workoutSheet')).toBeHidden();
  await expect(page.locator('#workoutCard')).toBeVisible();
  await expect(page.locator('#wkName')).not.toBeEmpty();
  page.once('dialog', (d) => d.accept()); // "Terminare l'allenamento?"
  await page.click('#wkStop');
  await expect(page.locator('#workoutCard')).toBeHidden();
});

test.describe('giochi', () => {
  const GAMES = ['video', 'horde', 'planata', 'gruppetto', 'mattoni', 'racer', 'shooter'];
  for (const id of GAMES) {
    test(`si apre e si chiude: ${id}`, async ({ page }) => {
      await page.click('#openGame');
      await expect(page.locator('#gameMenu')).toBeVisible();
      await page.click(`.game-card[data-game="${id}"]`);
      await expect(page.locator('#gameMenu')).toBeHidden();
      await expect(page.locator('#gameTitle')).not.toHaveText('Giochi');
      await page.waitForTimeout(1200); // lascia girare qualche frame
      await page.click('#closeGame'); // dal gioco al menu
      await expect(page.locator('#gameMenu')).toBeVisible();
      await page.click('#closeGame'); // dal menu alla home
      await expect(page.locator('#gamePanel')).toBeHidden();
    });
  }

  test('la lista dei giochi nella pagina coincide con quella testata', async ({ page }) => {
    await page.click('#openGame');
    const ids = await page.$$eval('.game-card', (els) => els.map((e) => e.dataset.game));
    expect(ids.sort()).toEqual([...GAMES].sort());
  });
});

test('il tasto indietro del browser chiude il pannello aperto', async ({ page }) => {
  await page.click('#openSettings');
  await expect(page.locator('#settingsSheet')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#settingsSheet')).toBeHidden();

  await page.click('#openGame');
  await expect(page.locator('#gamePanel')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#gamePanel')).toBeHidden();
  // l'app è ancora sulla stessa pagina (il segnaposto nella cronologia è stato rimesso)
  await expect(page).toHaveURL(/index\.html$/);
});
