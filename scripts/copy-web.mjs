// Copia i file della webapp in www/ per l'app Android (Capacitor).
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'assets', 'vendor', 'locales']) {
  if (existsSync(p)) cpSync(p, `${out}/${p}`, { recursive: true });
}
// numero di build (su GitHub = numero della compilazione), mostrato nelle impostazioni
const build = process.env.VERSION_CODE || 'sviluppo';
writeFileSync(`${out}/js/build.js`, `export const BUILD = '${build}';\n`);
// nell'app il service worker non serve
console.log('www pronto');
