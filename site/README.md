# Sito vetrina di Spindro

Sito statico (senza framework, senza tracker) generato da `site/build.mjs` con template e JSON di testi. L'app non fa parte di questa cartella: verrà servita sotto `/app/`.

```sh
node site/build.mjs              # scrive site/dist/ (non versionata)
python3 -m http.server 4400 -d site/dist   # anteprima su http://127.0.0.1:4400
node site/shots.mjs              # screenshot dell'app -> site/assets/shots/ (Playwright)
node site/make-og.mjs            # immagine social site/assets/og.png (1200x630)
```

| Cosa | Dove |
|---|---|
| Dominio, link GitHub / APK / Play Store, lingue attive | `config.json` (`siteUrl`, `apk`, `playStore`, `playStoreLive`, `langs`) |
| Testi di ogni lingua (home, compatibilità, footer, SEO) | `i18n/<lingua>.json` |
| Tabella rulli, controller e orologi | `data/compatibility.json` (stati: `verified`, `expected`, `reported`) |
| Layout | `templates/*.html`, `assets/style.css` |
| Pagine legali | generate da `docs/legal/*.md`; se contengono segnaposto `[...]` o la dicitura bozza escono con `noindex` e fuori dalla sitemap |

**Nuova lingua** (FR, ES, DE…): copia `i18n/en.json` in `i18n/fr.json`, traduci, aggiungi `"fr"` a `langs` in `config.json`, rilancia la build. Hreflang, sitemap, selettore lingua e `og:locale` si aggiornano da soli; le pagine legali ripiegano sull'inglese finché non esiste `docs/legal/*.fr.md`.

**Compatibilità**: solo il Van Rysel D100 è `verified`. Un modello passa a `reported` quando ci sono segnalazioni degli utenti, a `verified` solo se provato davvero.

I font Barlow sono serviti dal sito stesso (licenza OFL in `assets/fonts/`): nessuna richiesta a Google Fonts.
