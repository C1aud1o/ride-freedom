// Controlla le traduzioni: node tests/i18n-check.mjs [--strict]
//  - chiavi presenti in una lingua e mancanti nell'altra (it ↔ en);
//  - segnaposto {nome} diversi tra le lingue;
//  - chiavi usate nel codice (t('…'), data-i18n…) ma assenti dai file;
//  - chiavi nei file mai usate nel codice.
// Esce con errore se manca qualcosa; le chiavi inutilizzate sono un avviso (errore con --strict).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = readdirSync(join(root, 'locales')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const dict = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(join(root, 'locales', `${l}.json`), 'utf8'))]));
const strict = process.argv.includes('--strict');

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const jsFiles = walk(join(root, 'js')).filter((f) => f.endsWith('.js'));
// i18n.js ha esempi di chiavi nei commenti: non conta per le chiavi usate, ma sì per i prefissi dinamici (ordinal.*)
const src = [join(root, 'index.html'), ...jsFiles.filter((f) => !f.endsWith('i18n.js'))].map((f) => readFileSync(f, 'utf8')).join('\n');
const srcAll = [src, readFileSync(join(root, 'js/i18n.js'), 'utf8')].join('\n');

let errors = 0; let warnings = 0;
const say = (kind, msg) => { console.log(`${kind === 'ERR' ? '✗' : '!'} ${msg}`); if (kind === 'ERR') errors++; else warnings++; };

// 1. chiavi diverse tra le lingue
const all = new Set(LANGS.flatMap((l) => Object.keys(dict[l])));
for (const k of [...all].sort()) {
  const missing = LANGS.filter((l) => !(k in dict[l]));
  if (missing.length) say('ERR', `chiave "${k}" manca in: ${missing.join(', ')}`);
}
// 2. segnaposto coerenti
const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const k of [...all].sort()) {
  const sets = LANGS.filter((l) => k in dict[l]).map((l) => [l, ph(dict[l][k])]);
  if (new Set(sets.map(([, p]) => p)).size > 1) say('ERR', `segnaposto diversi per "${k}": ${sets.map(([l, p]) => `${l}={${p}}`).join(' ')}`);
}

// 3. chiavi usate: letterali, dinamiche (prefisso) e HTML
const used = new Set(); const prefixes = new Set();
for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
for (const m of src.matchAll(/\bt\(\s*`([^`$]*)\$\{/g)) prefixes.add(m[1]);
for (const m of srcAll.matchAll(/['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\.)\$\{/g)) prefixes.add(m[1]);
for (const m of src.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
for (const m of src.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) used.add(pair.split(':')[1]?.trim());
// chiavi scritte come stringa (tabelle di dati: titoli, regole, nomi di armi…)
const quoted = new Set([...src.matchAll(/['"`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)['"`]/g)].map((m) => m[1]));
const base = (k) => k.replace(/\.(zero|one|two|few|many|other)$/, '');
const exists = (k) => LANGS.every((l) => k in dict[l] || `${k}.other` in dict[l]);
for (const k of [...used].filter(Boolean).sort()) if (!exists(k)) say('ERR', `chiave usata nel codice ma non definita: "${k}"`);

// 4. chiavi mai usate
for (const k of Object.keys(dict[LANGS[0]]).sort()) {
  const b = base(k);
  if (used.has(b) || used.has(k) || quoted.has(b) || quoted.has(k)) continue;
  if ([...prefixes].some((p) => k.startsWith(p) || b.startsWith(p))) continue;
  say('WARN', `chiave mai usata: "${k}"`);
}

console.log(`\n${LANGS.join(' + ')}: ${Object.keys(dict[LANGS[0]]).length} chiavi, ${errors} errori, ${warnings} avvisi`);
process.exit(errors || (strict && warnings) ? 1 : 0);
