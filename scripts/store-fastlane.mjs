// Genera fastlane/metadata/android/<locale>/ (formato letto da F-Droid, IzzyOnDroid e `fastlane supply`)
// a partire da docs/launch/play-store.md e dalle immagini di store/. Verifica i limiti di lunghezza.
//
//   node scripts/store-fastlane.mjs
//
// Le immagini (screenshot, immagine in evidenza, icona) sono collegamenti simbolici relativi verso store/:
// così non si duplicano ~35 MB di PNG nella storia di git. Su Windows usare `git config core.symlinks true`.
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DOC = readFileSync(join(ROOT, 'docs/launch/play-store.md'), 'utf8');
const OUT = join(ROOT, 'fastlane/metadata/android');
const LOCALES = { en: 'en-US', it: 'it-IT', fr: 'fr-FR', es: 'es-ES', de: 'de-DE' };
const LIMITS = { title: 30, short: 80, full: 4000, changelog: 500 };

const sections = {};
for (const m of DOC.matchAll(/^## [^\n]*\((EN|IT|FR|ES|DE)\)\n(.*?)(?=\n---|\n## |(?![\s\S]))/gms)) sections[m[1].toLowerCase()] = m[2];
const block = (body, label) => (body.match(new RegExp(`#### ${label}[^\\n]*\\n\`\`\`\\n(.*?)\\n\`\`\``, 's')) || [])[1];

// La bozza è stata scritta quando l'app era solo in italiano. Ora l'app e il coach vocale parlano le 5 lingue (locales/*.json),
// quindi l'avviso "interfaccia solo in italiano" sarebbe falso e viene tolto; la riga sul coach in italiano diventa neutra.
function modernize(lang, text) {
  const paras = text.split('\n\n').filter((p) => !/^(NOTE|NOTA|HINWEIS)\s?:/.test(p.trim()));
  let out = paras.join('\n\n');
  if (lang === 'it') out = out.replace('Coach vocale in italiano: annuncia', "Coach vocale nella lingua dell'app: annuncia");
  return out;
}

let bad = 0;
for (const [lang, loc] of Object.entries(LOCALES)) {
  const body = sections[lang];
  if (!body) { console.error(`manca la sezione ${lang} in play-store.md`); bad++; continue; }
  const files = {
    'title.txt': block(body, 'Titolo'),
    'short_description.txt': block(body, 'Breve'),
    'full_description.txt': modernize(lang, block(body, 'Lunga') || ''),
    'changelogs/1.txt': block(body, 'Novità'),
  };
  const limit = { 'title.txt': LIMITS.title, 'short_description.txt': LIMITS.short, 'full_description.txt': LIMITS.full, 'changelogs/1.txt': LIMITS.changelog };
  const dir = join(OUT, loc);
  for (const [name, text] of Object.entries(files)) {
    if (!text) { console.error(`${loc}/${name}: testo mancante`); bad++; continue; }
    const n = [...text].length;
    if (n > limit[name]) { console.error(`${loc}/${name}: ${n} caratteri, limite ${limit[name]}`); bad++; }
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), `${text}\n`);
  }
  // immagini: collegamenti relativi verso store/
  const link = (target, linkPath) => {
    if (!existsSync(target)) { console.warn(`  immagine mancante: ${relative(ROOT, target)}`); return; }
    mkdirSync(dirname(linkPath), { recursive: true });
    try { lstatSync(linkPath); rmSync(linkPath); } catch { /* non esiste */ }
    symlinkSync(relative(dirname(linkPath), target), linkPath);
  };
  for (let n = 1; n <= 8; n++) link(join(ROOT, 'store/screenshots', lang, `${String(n).padStart(2, '0')}.png`), join(dir, 'images/phoneScreenshots', `${n}.png`));
  link(join(ROOT, 'store/feature-graphics', `${lang}.png`), join(dir, 'images/featureGraphic.png'));
  link(join(ROOT, 'store/icon-512.png'), join(dir, 'images/icon.png'));
  console.log(`ok  ${loc}  titolo ${[...files['title.txt']].length}/30  breve ${[...files['short_description.txt']].length}/80  lunga ${[...files['full_description.txt']].length}/4000  novità ${[...files['changelogs/1.txt']].length}/500`);
}
process.exit(bad ? 1 : 0);
