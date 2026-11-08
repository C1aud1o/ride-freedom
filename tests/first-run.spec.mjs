// Primo avvio completo, come lo vive un utente nuovo (telefono 390×844, nessun dato salvato):
// apertura → consenso → rullo non trovato (aiuto) → collegare il rullo → prima uscita → fine → condivisione.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FAKE_BLE = fileURLToPath(new URL('./fake-ble.js', import.meta.url));

for (const lang of ['en', 'it']) {
  test(`primo avvio completo (${lang})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, serviceWorkers: 'block', acceptDownloads: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript({ path: FAKE_BLE });
    await page.goto('/index.html'); // nessun localStorage: utente nuovo

    // 1) apertura: benvenuto con tre passi e un solo pulsante grande
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('#welcome li')).toHaveCount(3);
    // senza GoatCounter configurato (repo e build di prova) il consenso non viene chiesto: è coperto da monitoring.spec
    await expect(page.locator('#consentSheet')).toBeHidden();

    // 3) il rullo non si trova: compare l'aiuto con soluzioni concrete e il link "Segnala il tuo rullo"
    await page.evaluate(() => { navigator.bluetooth.__real = navigator.bluetooth.requestDevice; navigator.bluetooth.requestDevice = () => Promise.reject(new DOMException('User cancelled', 'NotFoundError')); });
    await page.click('#welcomeConnect');
    await expect(page.locator('#connectHelp')).toBeVisible();
    await expect(page.locator('#connectHelp li')).toHaveCount(4);
    await expect(page.locator('#connectHelp')).toContainText(/Zwift/);
    await expect(page.locator('#connectHelpReport')).toBeVisible();

    // 4) riprova: ora il rullo risponde, l'aiuto sparisce e il benvenuto lascia il posto ai numeri
    await page.evaluate(() => { navigator.bluetooth.requestDevice = navigator.bluetooth.__real; });
    await page.click('#connectHelpRetry');
    await expect(page.locator('#trainerStatus')).toContainText('FTMS');
    await expect(page.locator('#connectHelp')).toBeHidden();
    await expect(page.locator('#welcome')).toBeHidden();
    await expect(page.locator('#power')).toHaveText('150');

    // 5) prima uscita: l'invito "segnala" non disturba mentre si pedala
    await expect(page.locator('#reportHint')).toBeVisible();
    await page.click('#startStop');
    await expect(page.locator('#reportHint')).toBeHidden();
    await expect(page.locator('#finishRide')).toBeEnabled({ timeout: 8000 });
    await page.waitForTimeout(2500);

    // 6) fine: festa, riepilogo, file e condivisione
    await page.click('#finishRide');
    await expect(page.locator('#finishSheet')).toBeVisible();
    await expect(page.locator('#finishSummary dt')).toHaveCount(4);
    await expect(page.locator('#saveFit')).toBeEnabled();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#shareImg')]);
    expect(dl.suggestedFilename()).toMatch(/\.png$/i);

    expect(errors, 'errori JavaScript non gestiti').toEqual([]);
    await ctx.close();
  });
}
