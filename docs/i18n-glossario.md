# Glossario e note per i traduttori

Le traduzioni stanno in `locales/<lingua>.json` (chiavi raggruppate per area: `settings.*`, `finish.*`, `games.horde.*`…).
Il codice sorgente è la fonte delle chiavi; `node tests/i18n-check.mjs` segnala chiavi mancanti, inutilizzate e segnaposto diversi.

## Come aggiungere una lingua
1. Copia `locales/en.json` in `locales/<codice>.json` e traduci i valori (mai le chiavi).
2. Aggiungi la lingua alla costante `LANGS` in `js/i18n.js` (compare da sola nel selettore delle Impostazioni).
3. Aggiungi la lingua alla mappa di `speechLang()` in `js/i18n.js` (etichetta BCP-47 della voce del coach, es. `fr: 'fr-FR'`).
4. Aggiungi `locales/<codice>.json` a `ASSETS` in `sw.js` e incrementa `CACHE`.
5. `npm run test:i18n`.

## Regole tecniche
- `{nome}` è un segnaposto: va lasciato identico.
- Plurali: `chiave.one` / `chiave.other` (e, se la lingua li richiede, `few`, `many`, `two`, `zero`): si sceglie con `Intl.PluralRules`. Il parametro è `{count}`.
- Ordinali (`ordinal.one|two|few|other`): `{n}°` in italiano, `{n}st/nd/rd/th` in inglese.
- Chiavi `*.html` o usate con `data-i18n-html` contengono markup (`<b>`, `<a>`, `<code id=…>`): non togliere i tag né gli `id`.
- Le frasi del coach vocale (`coach.*`) si ascoltano: scrivile per la voce, senza simboli.
- Restano **fissi in inglese**, non vanno tradotti: la modalità sviluppatore (classe `dev-only`, pannello debug, registro), il titolo e il testo delle segnalazioni GitHub, i nomi di prodotto (Strava, Garmin Connect, Zwift Click, FTMS, ERG…).
- "Compatible with Strava" è il testo richiesto dalle linee guida di Strava: tradurre solo se Strava lo prevede.
- Unità metriche (km, km/h, kJ, W, rpm, bpm, m). TODO: preferenza miglia.
- Tono: amichevole, frasi brevi, niente gergo tecnico nelle schermate normali.

## Termini fissi

| Italiano | English | Note |
|---|---|---|
| FTP | FTP | sempre in maiuscolo |
| ERG | ERG | modalità a potenza fissa |
| cadenza | cadence | rpm |
| marcia | gear | cambio virtuale (Cog) |
| rapporto | ratio | rapporto della marcia |
| cambio | gears / shifting | "Cambio automatico" = auto-shift |
| rullo | trainer (smart trainer) | mai "roller" |
| uscita | ride | una sessione registrata |
| allenamento | workout | |
| ripetute | intervals | "Ripetuta 2/5" = Interval 2/5 |
| recupero | recovery | tra le ripetute |
| riscaldamento | warm-up | |
| defaticamento | cool-down | |
| fondo | endurance | |
| soglia | threshold | |
| sweet spot | sweet spot | invariato |
| rampa | ramp | |
| pendenza | grade | % di salita |
| percorso | route | file GPX |
| potenza / watt | power / watts | |
| potenza normalizzata | normalized power (NP) | |
| battito | heart rate | "Cardio" = Heart rate |
| misuratore di potenza | power meter | |
| tratto | step | un passo dell'allenamento |
| carico | load | stima TSS |
| storico | history | |
| obiettivo settimanale | weekly goal | |
| scia | draft / slipstream | |
| traguardo volante | intermediate sprint | |
| GPM (gran premio della montagna) | KOM (king of the mountain) | |
| maglia verde / a pois | green / polka-dot jersey | |
| sprint | sprint | |
| coach vocale | voice coach | |
| orologio | watch | Garmin |
| Planata, Gruppetto, Mattoni, L'Orda | Glide, Gruppetto, Bricks, The Horde | gli id (`planata`, `gruppetto`, `mattoni`, `horde`, `racer`, `shooter`, `video`) non cambiano |
