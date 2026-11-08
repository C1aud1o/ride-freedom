// Carica Playwright: prima dal progetto (@playwright/test, dopo `npm ci`), poi da quello installato globalmente (NODE_PATH, come nel cloud).
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
function load() {
  for (const name of ['@playwright/test', 'playwright']) {
    try { return require(name); } catch { /* prova il prossimo */ }
    for (const dir of (process.env.NODE_PATH || '').split(':').filter(Boolean)) {
      try { return require(require.resolve(name, { paths: [dir] })); } catch { /* prova il prossimo */ }
    }
  }
  throw new Error('Playwright non trovato: esegui `npm ci` nella root del repo.');
}
export const { chromium } = load();
/** Chromium già installato nel cloud o indicato con PW_CHROMIUM_PATH; altrimenti quello di Playwright. */
export const executablePath = [process.env.PW_CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
export const launchOptions = { executablePath, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] };
