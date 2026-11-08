# Show HN: bozza (G3)

> **Solo bozza, nulla è pubblicato.** Regole lette dalla pagina ufficiale (https://news.ycombinator.com/showhn.html, consultata il 2026-11-07).

## Cosa dice la pagina ufficiale (e cosa significa per noi)

| Regola ufficiale | Per Spindro |
|---|---|
| "Show HN is for something you've made that other people can play with." | La web app c'è, ma **serve un rullo Bluetooth per provarla davvero**. Chi non ha un rullo non può "giocarci" → commenti freddi o segnalazione. **Prima dello Show HN conviene aggiungere una modalità demo/simulatore** (nel repo esiste `tests/fake-ble.js`, un finto rullo FTMS usato nei test: è la base naturale). Nel codice di oggi **non ho trovato** una modalità demo **[DA VERIFICARE]**. |
| Fuori tema: blog, newsletter, pagine di iscrizione, landing, raccolte fondi. | Linkare **l'app o il repo**, non il blog né la pagina store. |
| "If your work isn't ready for users to try out, please don't do a Show HN." | Le parti sperimentali (FE-C, Wahoo legacy, Click) vanno dichiarate nel testo. |
| Non banale; non "one-off" generato. Il progetto deve essere qualcosa che hai costruito e di cui puoi parlare. | Descrivere le scelte tecniche vere (vedi `blog-tecnico.en.md`). **Se parti del codice sono scritte con assistenza AI, dillo se ti chiedono**: sii onesto, non lo affermo né lo escludo. |
| Non chiedere ad amici di votare o commentare. | Mai. |
| Nessuna registrazione o email per provare. | ✅ nessun account. |
| Il titolo inizia con "Show HN". Spiega perché l'hai fatto, tono sobrio. | Sotto. |

**Quando:** martedì–giovedì, mattina negli USA (≈ 14:00–16:00 in Italia). Essere online e disponibile nelle 3–4 ore successive. Il post va prima in "shownew" e passa a "show" dopo una piccola soglia di punti.

**Prima di postare, controlla:** README in inglese, `LICENSE` nel repo (oggi manca [DA VERIFICARE]), l'interfaccia è solo in italiano (dichiararlo), un GIF/screenshot nel README, issue aperte per i rulli non funzionanti.

## Titolo (≤ 80 caratteri, prova)

Opzioni (la prima è la consigliata):

```
Show HN: Open-source smart trainer app that runs in the browser (Web Bluetooth)
```
```
Show HN: Free GPL app to control a smart bike trainer over Web Bluetooth/FTMS
```
```
Show HN: Spindro, pedal-powered 3D games and a trainer app, no subscription
```

(Conteggio: 79, 77, 75 caratteri → rientrano. Evitare punti esclamativi e superlativi.)

## URL da inserire nel campo URL

`https://github.com/c1aud1o/ride-freedom` (consigliato: il repo, che è ciò che HN apprezza). In alternativa l'app: `https://mta-world.com/?ref=hn`. Su HN non si possono mettere due URL: l'altro va nel primo commento. Il `?ref=hn` serve solo sul link all'app.

## Testo (primo commento dell'autore, pubblicato subito)

```
Hi HN, I'm the developer. I have a cheap smart trainer (Van Rysel D100) and didn't want a monthly subscription just to ride it, so I started writing my own app. It has grown into something I use every week, and I'd like people with other trainers to try to break it.

What it is: a PWA that talks to the trainer over Web Bluetooth (FTMS), plus an Android build (Capacitor) that is the same JS code. Free, open source (GPL-3.0), no account, no ads.

What's technically interesting, I think:
- FTMS control point: writes are request/response and must be serialized, otherwise trainers silently drop commands.
- A "virtual gear" model: cadence x gear ratio gives a virtual speed, a simple physics model (grade, mass, CdA, Crr) turns that into a watt target, and the trainer is put in ERG mode. Shift gears and the resistance really changes.
- The Android WebView has no Web Bluetooth, so the app injects an object that implements navigator.bluetooth on top of the Capacitor BLE plugin: the trainer code is unchanged between PWA and app.
- A tiny Android Java plugin that makes the phone advertise Cycling Power / CSC services, so a Garmin watch can record the ride as if it were a power meter.
- A hand-written .FIT encoder (the format is public) for the ride file, and workout export to .FIT / .zwo.
- Pedal-powered 3D games (Three.js as ES modules, no bundler): watts and cadence replace the gamepad.

Honest limits:
- Tested mostly on one trainer. Tacx FE-C and old Wahoo support is written, and only tested against a simulated trainer in the repo's tests; I'd love reports from real hardware.
- Zwift Click support is reverse-engineered from open-source projects and experimental.
- The UI is Italian-only for now; translations are in progress.
- You need a BLE trainer (or a Chrome/Edge browser with Bluetooth) to really try it. [DA VERIFICARE: se aggiungi la modalità demo, scrivi qui "there's a demo mode that fakes a trainer"].

Source: https://github.com/c1aud1o/ride-freedom
App (Chrome/Edge, or Android APK from the repo): https://mta-world.com/?ref=hn

I'd really like feedback on the BLE layer and on which trainers don't connect. Thanks for reading!
```

## Risposte pronte alle domande probabili

- *"Why not Zwift / MyWhoosh / Rouvy?"* → "They are great, with worlds and communities. This one is for the evenings when you just want a workout, without a subscription, and with the data on your device."
- *"Does it work on iPhone?"* → "Not in Safari (no Web Bluetooth). Bluefy works; a native iOS build is possible later, with the same code."
- *"Is it vibe-coded / AI?"* → rispondere con sincerità su come è stato scritto il codice [TUO].
- *"FTMS spec / why not ANT+?"* → "ANT+ isn't available in browsers or on most phones; FE-C over BLE is covered for Tacx."
- *"Cheating / leaderboards?"* → "Accounts and leaderboards are planned, not built; watts can be faked, so rankings will use game scores, not absolute watts."
