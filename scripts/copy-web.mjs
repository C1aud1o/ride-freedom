// Copia i file della webapp in www/ per l'app Android (Capacitor).
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const p of ['index.html', 'manifest.webmanifest', 'css', 'js', 'icons', 'assets', 'vendor']) {
  if (existsSync(p)) cpSync(p, `${out}/${p}`, { recursive: true });
}
// nell'app il service worker non serve
console.log('www pronto');
