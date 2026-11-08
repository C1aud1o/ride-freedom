# Spindro: obiettivo, strategia, regole

Le sottosessioni leggono questo file prima di lavorare. Il piano dettagliato è in `docs/PIANO-LANCIO.md`.

## Missione
Chiunque abbia un rullo smart deve potersi allenare bene, divertirsi e avere i dati sul proprio orologio **senza pagare un abbonamento**.

## Obiettivo (90 giorni dal lancio pubblico)
| Indicatore | Obiettivo | Perché questo |
|---|---|---|
| Persone che fanno almeno 1 uscita a settimana | **500** | Misura il valore vero, non i download |
| Installazioni dal Play Store | 2.000 | Misura la portata |
| Stelle su GitHub | 150 | Misurano la fiducia e attirano chi contribuisce |
| Rulli diversi segnalati "funziona" | 25 | Misurano la compatibilità reale |
| Uscite finite senza errori (Sentry) | ≥ 98% | Misurano la qualità |

**Nord:** uscite completate a settimana. Ogni lavoro deve aiutare più persone a **collegare il rullo al primo tentativo** oppure a **tornare la settimana dopo**. Se un lavoro non fa né l'una né l'altra cosa, aspetta.

## Strategia, in ordine
1. **Collega al primo colpo.** Compatibilità ampia e "Segnala il tuo rullo". Il primo minuto decide tutto.
2. **Parla la sua lingua.** EN, poi IT, FR, ES, DE.
3. **Fiducia.** Open source GPL-3.0, nessun abbonamento, nessun tracciamento, privacy chiara.
4. **Motivi per tornare.** Allenamenti, giochi, record, poi classifiche e sfide con account facoltativo.
5. **Distribuzione mirata.** Comunità dei rulli economici, Garmin e Zwift Click. Gli annunci si pagano solo su ricerche precise, con 100 € in tutto.

## Calendario
- **Settimana 1–2:** prodotto pronto (lingue, monitoraggio, compatibilità, sito, build firmata). Test chiuso Play avviato.
- **Settimana 3–4:** account e classifiche nella versione Play. Repo pubblico. Sito online su spindro.fit.
- **Settimana 4–5:** fine dei 14 giorni di test chiuso → produzione Play. Lancio: elenchi, Reddit, Show HN.
- **Settimana 6–10:** creator e blog, sfide del mese, 100 € di annunci solo su ciò che converte.

## Regole di lavoro (valgono per tutte le sottosessioni)
- Un compito = un branch `spindro/<id>`. Nessuna PR, nessun push su altri branch. Il merge lo fa la sessione di direzione.
- Test verdi prima del push: `npm test`, `node tests/trainers/run.mjs`, `node tests/controllers/zwift-controllers.test.cjs`. Nel cloud serve `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- Non dichiarare mai compatibile o verificato ciò che non è stato provato.
- Nessun segreto nel codice. Nessun dato personale nei log o nei report.
- Nessun asset senza licenza chiara (CC0/MIT/OFL). Nessuna copia di giochi, loghi o stile di marchi esistenti.
- Testi per l'utente: frasi brevi, niente gergo, in tutte le lingue presenti.
- Commit in italiano, finché il repo non sarà pubblico; da allora in inglese.

- **Budget di utilizzo**: il piano ha un limite ogni 5 ore e lo condividono tutte le sottosessioni. Quindi: **al massimo 3 sottosessioni insieme**, Haiku per testi e traduzioni, Sonnet per il codice normale, Opus solo per Bluetooth, sicurezza e architettura. Commit e push frequenti, così un'interruzione non fa perdere lavoro.

## Stato (2026-11-08)
**Sviluppo per il test chiuso: completo.** Il prodotto ha:
- rulli FTMS, Tacx FE-C e Wahoo legacy; Zwift Click, Play e Ride;
- 5 lingue;
- modalità sviluppatore e "Segnala il tuo rullo";
- monitoraggio con consenso;
- account facoltativo con sincronizzazione, classifiche e sfide del mese;
- build firmata e flavor foss/play;
- documenti legali in bozza, sito vetrina, immagini e testi per gli store, contenuti di lancio;
- prima esperienza rifinita (avvio 9,1 s → 3,4 s su 4G lento, accessibilità 100).

Test: 49 sull'app, 47 sui rulli, controller e traduzioni: tutti verdi.
**Bloccato da:** azioni del proprietario 3, 4 e 5 (account Play, tester, chiave). Finché l'account Play non c'è, solo piccole correzioni, per risparmiare il limite settimanale.

## Decisioni prese
| Data | Decisione | Motivo |
|---|---|---|
| 2026-11-07 | Nome **Spindro: Smart Trainer Cycling**, dominio spindro.fit | Libero nel settore. Il proprietario lo ha scelto. |
| 2026-11-07 | Licenza **GPL-3.0**, contributi con DCO | Impedisce di chiudere il codice, adatta a F-Droid, nessun CLA |
| 2026-11-07 | Pubblicazione in un **repo nuovo `spindro` con storia pulita** | La storia attuale contiene la vecchia chiave di firma. Ripartire costa meno che riscriverla, e col nuovo nome gli utenti reinstallano comunque. |
| 2026-11-07 | **Nuova chiave di firma**, conservata solo nei Secret di GitHub | La chiave vecchia è da considerare pubblica |
| 2026-11-07 | Account facoltativo, tutto gratis; login solo nella variante Play e sul web ufficiale | Fiducia della community, nessuna parte chiusa |
| 2026-11-07 | Hosting: GitHub Pages fino all'arrivo degli account, poi Firebase Hosting; APK su GitHub Releases | Costo zero, banda illimitata per gli APK |
| 2026-11-08 | App Android: accesso solo con email al lancio; login Google nativo dopo | Google blocca il suo login nelle WebView; il login nativo è lavoro delicato e non serve per il lancio |
| 2026-11-08 | Il consenso alle statistiche si chiede solo quando le statistiche sono configurate | Non chiedere un consenso inutile |
| 2026-11-07 | Niente Google Analytics. Monitoraggio con Sentry (UE) e GoatCounter | Privacy, nessun banner cookie |

## Cose che solo il proprietario può fare
Lista unica e sempre aggiornata. La sessione di direzione la tiene allineata.
| # | Cosa | Serve per | Urgenza |
|---|---|---|---|
| 1 | Comprare il dominio **spindro.fit** | Sito, email, privacy | Alta: prima che lo prenda qualcun altro |
| 2 | Cercare "Spindro" su **TMview** (tmdn.org/tmview) nelle classi 9, 28 e 41 | Sicurezza del nome | Alta |
| 3 | Creare l'**account sviluppatore Google Play** (25 $) | Store | Alta: i 14 giorni di test partono da lì |
| 4 | Trovare **12 tester** (account Google) per il test chiuso | Store | Alta |
| 5 | Generare la **nuova chiave di firma** e caricare i 4 Secret su GitHub (`docs/android-release.md`) | Build ufficiale | Alta |
| 6 | Creare il **repo pubblico vuoto** `spindro` su GitHub e dare accesso alla sessione | Open source | Media |
| 7 | Creare il **progetto Firebase** (`docs/firebase-setup.md`, quando sarà pronto) | Account | Media |
| 8 | Pubblicare il **Worker Strava** (`docs/strava.md`) | Strava per tutti | Media |
| 9 | Compilare i segnaposto legali (nome, email di contatto, eventuale indirizzo) | Privacy/termini | Media |
| 10 | Creare un'**email di progetto** (es. hello@spindro.fit) | Contatti, store, legale | Media, dopo il dominio |
| 11 | Provare su rullo e telefono veri le cose segnate "da verificare" | Qualità | Continua |
