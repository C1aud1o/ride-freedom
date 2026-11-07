# Reddit: 8 bozze di post (G3)

> **Solo bozze, nulla è pubblicato.** Un post diverso per comunità, nessun copia-incolla. Voce: lo sviluppatore che ha costruito la cosa per sé, onesto sui limiti, che chiede feedback. Le parti tra `[TUO: …]` vanno riempite con la tua storia vera: non ho inventato aneddoti personali né numeri.

## Come sono scritti (valido per tutti)

- **Dichiarare subito** "sono lo sviluppatore", "gratis, open source (GPL-3.0), nessun account". Mai nascondere l'autopromozione.
- **Nessun link nel corpo del post**, tutti nel **primo commento** (molti sub filtrano i link nei post; vedi anche la regola dei 9:1 sotto). Dove un sub vieta i link nei commenti, usare il solo link al repo.
- **Link con `?ref=`** per misurare, es. `https://mta-world.com/?ref=reddit-indoorcycling`. Il conteggio per `ref` funziona solo quando GoatCounter sarà nel sito (fase D1, oggi nel codice non c'è: `grep -ri goatcounter index.html js` non trova nulla) **[DA VERIFICARE]**.
- **Cosa è vero oggi, da non gonfiare** (README + codice del 2026-11-07):
  - Collaudato soprattutto su **Van Rysel D100** (FTMS). **Tacx FE-C e Wahoo legacy** sono scritti e provati solo con un **rullo simulato** (`node tests/trainers/run.mjs`), non su rulli veri.
  - **Zwift Click/Play/Ride**: supporto sperimentale, ricostruito da progetti open source; verificato su un Click v2 del D100 Zwift Ready (commento in `js/click.js`); lo scambio di chiavi cifrato che alcuni firmware richiedono **non è implementato**.
  - **Ponte verso l'orologio** (il telefono trasmette potenza/cadenza/velocità come sensore BLE): solo **app Android**.
  - **iPhone**: Safari non ha Web Bluetooth → serve Bluefy; non esiste ancora un'app iOS.
  - **Interfaccia e coach vocale solo in italiano** oggi (nessun `locales/`). Nei post in inglese va detto chiaramente.
  - **Account e classifiche: "in arrivo"**, non esistono.
  - Il file `LICENSE` GPL-3.0 **non è ancora nel repo** **[DA VERIFICARE]** prima di scrivere "GPL-3.0" in un post.
- Rispondere ai commenti nelle prime 2–3 ore. Chi risponde "il mio rullo non va" va trattato come il bene più prezioso: chiede il modello, apre una issue con "Segnala un problema".
- Mai chiedere upvote, mai farli chiedere ad amici (regola sociale ovunque su Reddit).

## Regole di Reddit in generale

- La linea guida storica di Reddit è il rapporto **9:1** (per ogni contenuto promozionale, nove non promozionali) e le regole di ogni sub sono più severe di quelle del sito: [guida redship sulle regole di autopromozione](https://redship.io/blog/reddit-self-promotion-rules).
- **Account e storico:** prima del lancio commentare in modo utile nei sub per qualche settimana. Un account nuovo che posta solo un link è il caso classico di rimozione.

## ⚠️ Limite della mia verifica (leggere)

Dalla sandbox in cui ho lavorato **reddit.com non è raggiungibile** (WebFetch lo rifiuta, `curl` a `old.reddit.com/…/about/rules.json` non restituisce nulla, i mirror redlib rispondono 404). Quindi **non ho potuto leggere le regole ufficiali** di nessuno degli otto sub. Sotto riporto per ciascuno: (a) ciò che ho trovato tramite ricerca web, con fonte (spesso un mirror, quindi di seconda mano), (b) cosa **NON** ho trovato e va controllato a mano nella barra laterale (`/r/<sub>/about/rules`) prima di pubblicare. Ogni riga marcata [DA VERIFICARE] è un controllo da fare, non un'informazione.

Ordine di pubblicazione e date: vedi `calendario.md`.

---

## 1. r/indoorcycling

**Angolo:** "Ho un rullo economico e non volevo un abbonamento: ho fatto un'app gratis". Il pubblico più importante (piano, sez. 10): chi ha già un rullo da 200–400 € e cerca alternative.

**Regole da controllare**
- Trovato: nessuna regola pubblicata che ho potuto leggere (la ricerca web non ha restituito la barra laterale; un'istantanea di terze parti descrive solo il tema del sub) **[DA VERIFICARE]**.
- Da controllare a mano: regola su autopromozione/app proprie · se serve un flair (cercare "Self-promotion"/"Software"/"Discussion") · se i link nel corpo sono ammessi · se esiste un thread settimanale per progetti/domande · giorno migliore (di solito martedì–giovedì, la sera europea).
- Se il sub vieta le app proprie: scrivere ai moderatori (modmail) con una riga: "Ho fatto un'app gratuita open source per rulli; posso condividerla? Se preferite un thread dedicato, dove?"

**Titolo (≤ 300 car.)**
```
I got tired of paying for a trainer app, so I wrote a free open-source one (Web Bluetooth + Android). Looking for feedback from people with cheap smart trainers
```

**Testo**
```
Disclosure first: I'm the developer, and it's free, no account, no ads, open source.

I have a budget smart trainer [TUO: modello, es. "Van Rysel D100"] and I didn't want a monthly subscription just to ride it, so I started building my own app. It has grown into something I use every week, and I'd like people with other trainers to break it.

What it actually does today:
- 24 virtual gears: a small physics model (cadence, gear, grade, weight) sets the ERG target, so shifting changes the resistance
- also ERG, slope and plain resistance modes
- structured ERG workouts based on your FTP, a ramp test, a workout editor, GPX routes where the grade follows the track
- records a .FIT file you can import into Garmin Connect/Strava
- pedal-powered 3D games, if you're bored of intervals
- Zwift Click (experimental) works as a shifter

Honest limits:
- most tested with a Van Rysel D100. Tacx FE-C and old-firmware Wahoo support is written but only tested against a simulated trainer, so I really don't know how it behaves on real Tacx/Wahoo hardware
- the Click support is reverse-engineered from open-source projects and may not work on every firmware
- Android app or Chrome/Edge on a computer. iPhone only through the Bluefy browser
- the interface is in Italian only right now; translations are in progress

What I'd love to know: which trainer do you have, and does it connect? There's a "report a problem" button that tells me which Bluetooth services your trainer exposes. And what's the one feature you miss from the paid apps that would actually matter?
```

**Primo commento (link)**
```
Links, since you'll ask:
- Web app (Chrome/Edge, no install): https://mta-world.com/?ref=reddit-indoorcycling
- Android APK + source code (open source): https://github.com/c1aud1o/ride-freedom
If your trainer doesn't connect, the "Report a problem" button opens a prefilled GitHub issue, no personal data collected. Thanks!
```

---

## 2. r/Garmin

**Angolo:** il telefono come "sensore" per l'orologio: chi usa il rullo con l'orologio Garmin e vuole che l'attività finisca su Connect. Focus tecnico e pratico, non "alternativa a Zwift". Solo Android.

**Regole da controllare**
- Trovato: nessuna regola di r/Garmin leggibile. (Le regole del forum sviluppatori Garmin, `forums.garmin.com/developer/connect-iq/w/wiki/2/forum-rules`, vietano la promozione commerciale e permettono link allo store solo per app Connect IQ: **non** sono le regole del sub e non valgono qui, ma mostrano la cautela dell'ecosistema.) **[DA VERIFICARE]**
- Da controllare: autopromozione e app di terzi (spesso ammesse solo con flair o in thread dedicati) · se servono domande tecniche invece di annunci · se "Android only" basta come contesto.
- Consiglio: formulare il post come **domanda/how-to** ("how I get my Garmin to record trainer rides from a phone"), non come lancio. Citare solo funzioni vere: il telefono trasmette potenza/cadenza/velocità come sensore BLE (`GarminBridgePlugin.java`, servizi 0x1818 e 0x1816).
- **Non promettere** che funzioni su ogni modello: **[DA VERIFICARE]** su quali orologi/ciclocomputer è stato provato. Nel codice c'è una guida per scollegare il telefono dall'orologio (`js/watchguide.js`, "Telefono → disattivato").

**Titolo**
```
Using the phone as the "trainer sensor" for a Garmin watch (power/cadence/speed over BLE): I built a free open-source app for it, looking for testers
```

**Testo**
```
Developer here (free, open source, no account). Context: I ride a smart trainer indoors and I wanted the ride to be recorded by my Garmin, not just by the phone.

The Android app talks to the trainer over Bluetooth and then re-broadcasts power, cadence and speed as standard BLE services (Cycling Power + Speed & Cadence), so the watch sees it like a normal power meter/speed sensor and records an indoor ride with those sensors. The ride then ends up in Garmin Connect the usual way. It also writes its own .FIT file as a backup you can import by hand.

The part that actually tripped me up, in case it saves someone time: the watch has to forget the phone first, otherwise it keeps trying to use the phone as its sensor hub. I added a little illustrated guide in the app (hold the light button → Controls → Phone off).

What I don't know: which Garmin models behave well with this. [TUO: modello che hai provato]. I'd really like reports from other watches/Edge units, including the ones that don't work.

Limits: Android only (iPhone can't act as a BLE sensor from a web app), and the UI is Italian only for now.
```

**Primo commento (link)**
```
Source + APK: https://github.com/c1aud1o/ride-freedom
Web version (no bridge, Chrome/Edge): https://mta-world.com/?ref=reddit-garmin
Happy to share the BLE details if anyone wants to compare notes.
```

---

## 3. r/Zwift

**Angolo:** "Il Click funziona anche fuori da Zwift". Tono rispettoso: non attaccare Zwift, non dire "meglio di". Per chi ha già Zwift Click/Play (spesso inclusi nel Van Rysel D100/D500 "Zwift Ready") e vuole usarli altrove.

**Regole da controllare**
- Trovato: nessuna regola di r/Zwift leggibile. Le regole dei **forum** Zwift vietano l'autopromozione (ufficiale: [forums.zwift.com/t/community-guidelines](https://forums.zwift.com/t/community-guidelines/4057)), ma sono un'altra comunità **[DA VERIFICARE]**.
- Da controllare: divieto di app/servizi concorrenti o di prodotti propri · se occorre il flair "Discussion"/"Hardware" · thread settimanale per progetti. **Prima** di postare: una modmail breve ("posso condividere un'app gratuita open source che usa lo Zwift Click fuori da Zwift?").
- Accorgimenti: non usare loghi, scrivere "not affiliated"; non confrontare prezzi; non toccare questioni di contratto/ToS Zwift. Nota tecnica onesta: il protocollo Click è **ricostruito da progetti open source** (`js/click.js` cita ajchellew/zwiftplay, SwiftControl, qdomyos-zwift) e i dispositivi con cifratura potrebbero non funzionare.

**Titolo**
```
For those with a Zwift Click: I made a free open-source app where it works as a virtual shifter outside Zwift (experimental, looking for testers)
```

**Testo**
```
Not affiliated with Zwift: I'm the developer of a small free open-source trainer app, and I thought other Click owners might find this interesting.

Zwift Click (and Play/Ride, partly) are just BLE devices, and a few open-source projects documented how they talk. I used that to add support for them as shifters in my app: + and − change a virtual gear (24 gears, a physics model turns cadence × gear × grade into the ERG target), so on a trainer that is not locked to Zwift you still get the "I shift, resistance changes" feel.

Please read this as experimental:
- verified on one Click v2 that came with a Van Rysel D100 "Zwift Ready"
- Play/Ride are recognised, but the encrypted handshake some firmwares need is not implemented, so those may not connect
- the app is free, GPL, no account. Interface is Italian only right now (translations coming)
- it also does ERG workouts, GPX routes, FIT recording and some silly pedal-powered 3D games

I'm not trying to replace what Zwift does (the worlds, the community, the racing). This is for the evenings when you want a simple workout and no subscription. If you try it: which Click/Play/Ride firmware do you have, and did the buttons work?
```

**Primo commento (link)**
```
Web app (Chrome/Edge or Android): https://mta-world.com/?ref=reddit-zwift
Source / issues: https://github.com/c1aud1o/ride-freedom
There's a Debug page that shows which button sends which signal; if your Click doesn't respond, a screenshot of that page is the most useful thing you can send me.
```

---

## 4. r/cycling

**Angolo:** inverno = rullo per tutti, anche per chi non ha mai usato un'app. Racconto semplice: "se hai un rullo smart e non vuoi un altro abbonamento". Meno tecnico.

**Regole da controllare**
- Trovato: nessuna regola di r/cycling leggibile. Come termine di paragone, sub di ciclismo vicini vietano la promozione commerciale (es. r/gravelcycling: [nuove regole](https://lr.eu.psf.lt/r/gravelcycling/comments/1j1cbsw/new_rules_for_rgravelcycling); r/pelotoncycle: [regole](https://axebps-redlib.hf.space/r/pelotoncycle/wiki/index/rules)), ma **non sono le regole di r/cycling** **[DA VERIFICARE]**.
- Da controllare: se le app proprie sono vietate del tutto (molto probabile in un sub così grande); se esiste un thread settimanale (es. "weekly question/discussion") dove inserire il link; flair richiesto.
- **Strategia consigliata:** non postare la "app" ma una **domanda genuina** sul rullo (es. "what do you do on the trainer to stay motivated through winter?") e citare l'app solo se qualcuno la chiede o in un thread permesso. Se i mod dicono no: non insistere.

**Titolo (versione domanda, da usare solo se le regole lo consentono)**
```
Winter trainer riders: what do you actually do to not hate the trainer by January? (I built a free app with pedal-powered games, curious what works for you)
```

**Testo**
```
I ride the trainer from November to March and the thing that kills me isn't the effort, it's boredom. I've tried videos, structured workouts, podcasts, races.

I ended up writing my own free app (open source, no subscription, no account; I'm the developer, so take my enthusiasm with salt), and part of it is silly 3D games where your cadence and watts are the controls: a road stage, a side-scrolling shooter, a plane that flies on power. Honestly, they make a 45-minute endurance ride go quicker than any video I've watched.

What works for you? And if you're curious about the app, I'll drop the link in a comment: smart trainer and Android or a computer with Chrome/Edge needed; interface is Italian only for now.
```

**Primo commento (link, solo se ammesso)**
```
https://mta-world.com/?ref=reddit-cycling · source: https://github.com/c1aud1o/ride-freedom
```

---

## 5. r/opensource

**Angolo:** il progetto open source, non il prodotto. Cosa c'è di interessante per chi legge codice: Web Bluetooth + FTMS in vanilla JS, shim di `navigator.bluetooth` su Capacitor, scrittura di file FIT da zero, test con rullo simulato. Cercare contributori e revisori.

**Regole da controllare**
- Trovato: regola di barra laterale n. 2 "No Spam or Excessive Self-Promotion" (citata da [saascity.io](https://saascity.io/where-to-promote-open-source-projects), seconda mano). Due articoli recenti riferiscono che i moderatori **stringono le regole sui progetti promossi** (esclusi quelli sviluppati con LLM, o da un solo sviluppatore) – [runtimewire](https://runtimewire.com/article/r-opensource-bars-ai-projects-and-requires-a-year-of-maintenance-for-promotion) e [promptzone](https://www.promptzone.com/hyun_rao/ropensource-bans-solo-and-llm-projects-what-builders-need-to-know-1ji2) – ma sono resoconti non ufficiali e discordanti: **[DA VERIFICARE]** il testo vero della regola.
- **Importante per te:** se la regola esclude progetti scritti con assistenza di LLM, **dichiarare onestamente** come è stato sviluppato il progetto (non so come sia stato scritto il repo; non lo affermo). Non pubblicare se la regola lo vieta. Idem sulla maturità del progetto ("1 anno di manutenzione" nei resoconti).
- Controllare: flair "Promotional"/"Project"? · un solo post ogni N giorni · licenza OSI approvata nel repo (oggi manca `LICENSE`, **va aggiunto prima**).

**Titolo**
```
Open-source smart-trainer app (GPL-3.0): Web Bluetooth, FTMS, a Capacitor Android wrapper, no accounts, no ads. Looking for contributors and trainer testers
```

**Testo**
```
I'm the sole developer. The project is a free, GPL-3.0 web/Android app for controlling smart bike trainers over Bluetooth Low Energy (ERG, gradient simulation, virtual gears), recording .FIT files, and running pedal-powered 3D games.

Why I think it's a reasonable fit for this sub:
- no accounts, no tracking SDKs, data stays on the device. Accounts/leaderboards are planned later as an optional hosted service, the client stays fully open
- plain ES modules, no framework; Three.js (MIT) for the games; Kenney CC0 assets
- the same code runs as a PWA (Web Bluetooth) and as an Android app (Capacitor + a BLE plugin, with a shim exposing navigator.bluetooth so the app code is unchanged)
- an Android Java plugin that makes the phone advertise standard BLE Cycling Power / CSC services so a watch can record the ride
- tests run against a fake BLE trainer (Playwright), including simulated Tacx FE-C and legacy Wahoo trainers

Help wanted: (1) people with trainers other than the Van Rysel D100: Tacx FE-C and Wahoo legacy paths have never touched real hardware; (2) translations (the UI is Italian-only today); (3) code review of the BLE layer. Honest status: it's one person's project, rough in places.
```

**Primo commento (link)**
```
Repo (issues welcome): https://github.com/c1aud1o/ride-freedom
Try it: https://mta-world.com/?ref=reddit-opensource
```

---

## 6. r/androidapps

**Angolo:** app Android per rulli, gratis, senza account, FOSS. **Attenzione: regola molto severa, vedi sotto.**

**Regole da controllare**
- Trovato: un post dei moderatori (copia su mirror redlib datata 27 maggio 2026, quindi **di seconda mano**) dice che **tutta l'autopromozione** (inclusi richieste di tester, idee di app, feedback sulle app) deve andare nel sub gemello **r/droidappshowcase**, con "tolleranza zero" in r/androidapps, e che r/androidapps è per utenti finali, non per sviluppatori: fonte [rl.klein.ruhr/r/AndroidApps](https://rl.klein.ruhr/r/AndroidApps). **[DA VERIFICARE]** sul sito ufficiale.
- **Quindi:** pubblicare in **r/droidappshowcase**, non in r/androidapps; leggere prima le sue regole (formato del titolo, flair, link al Play Store obbligatorio?). Probabile che serva l'app già su Play Store → rimandare dopo l'uscita dal test chiuso (piano, sez. 9). Se non è su Play: l'APK da GitHub potrebbe non essere ammesso **[DA VERIFICARE]**.
- Non commentare in r/androidapps con link alla tua app.

**Titolo**
```
[App] Spindro: free, open-source smart-trainer app (Bluetooth, no account, no ads) for indoor cycling: feedback welcome
```

**Testo**
```
Hi, I'm the developer. Spindro is a free, open-source Android app (GPL-3.0) that connects over Bluetooth to a smart bike trainer and lets you ride with virtual gears, ERG workouts, GPX routes, and pedal-powered 3D games. It records .FIT files for Garmin Connect/Strava, and can broadcast power/cadence/speed so a Garmin watch records the ride.

No account, no ads, no subscription. Permissions: Bluetooth (and location only on Android 11 and older, which still ties Bluetooth scanning to it), internet for the optional video and Strava features.

Limits you should know about: the interface is Italian only for now; the Tacx/old Wahoo protocols are only tested with a simulated trainer; Zwift Click support is experimental.

Looking for feedback on the trainer connection flow (it's the first thing that usually breaks) and for people with trainers other than the Van Rysel D100.
```

**Primo commento (link)**
```
Play Store: [DA VERIFICARE: link, solo dopo la pubblicazione] · Source and APK: https://github.com/c1aud1o/ride-freedom · Web version: https://mta-world.com/?ref=reddit-androidapps
```

---

## 7. r/webdev

**Angolo:** tecnico: "Web Bluetooth parla davvero con un rullo: cosa ho imparato (FTMS, serializzare le scritture GATT, polyfill su Capacitor)". Collegare all'articolo dev.to (vedi `blog-tecnico.en.md`).

**Regole da controllare**
- Trovato (mirror di terze parti, non ufficiale): il sub riporta "no excessive self-promotion" con rimando al 9:1, e limita **la condivisione di progetti e richieste di feedback al "Showoff Saturday"**: fuori dal sabato il post viene rimosso. Un utente racconta una rimozione anche per un sito gratuito perché il post "sembrava una pubblicità": [r-weld mirror](https://r-weld.vercel.app/r/webdev), [yomotherboard](https://yomotherboard.com/question/why-was-my-free-front-end-website-removed-from-showoff-saturday/). **[DA VERIFICARE]**
- **Quindi:** pubblicare **solo di sabato nel thread/flair "Showoff Saturday"**, in forma di condivisione tecnica, non di annuncio. Controllare nelle regole: formato richiesto del titolo, se il thread è un post fisso dell'AutoModerator o se si crea un post con flair.
- Nessuna regola su AI trovata per r/webdev (ho trovato solo regole di altri sub).

**Titolo (Showoff Saturday)**
```
Showoff Saturday: controlling a smart bike trainer from the browser with Web Bluetooth (FTMS), and what broke
```

**Testo**
```
I built a PWA that talks to a smart trainer over Web Bluetooth (FTMS), and I'd love feedback on the architecture.

Things that were fun/painful:
- FTMS's control point is request/response; writes must be serialized and each op awaited, or trainers silently ignore commands
- Cycling Power gives cadence from crank revolutions + a wrapping 16-bit event time, so you have to handle rollovers
- a Chrome/Edge-only API means a fallback story: the Android wrapper (Capacitor) installs an object that implements navigator.bluetooth on top of a native BLE plugin, so the app code is the same in both places
- writing .FIT files in plain JS (CRC, definition/data messages) is less scary than it sounds
- testing against a fake BLE trainer in Playwright

It's free and open source, no framework (ES modules + Three.js for some 3D games). Honest caveat: only one person's testing on real hardware so far. I wrote a longer technical post on dev.to; link in the comment. What would you do differently on the BLE layer?
```

**Primo commento (link)**
```
Write-up: [DA VERIFICARE: URL dev.to dopo la pubblicazione] · Repo: https://github.com/c1aud1o/ride-freedom · Try it (Chrome/Edge; it needs a BLE trainer, I haven't found a demo mode in the code [DA VERIFICARE]): https://mta-world.com/?ref=reddit-webdev
```

---

## 8. r/threejs

**Angolo:** i giochi 3D: Three.js in ES module senza bundler (importmap), modelli Kenney CC0, input = watt e cadenza, prestazioni su telefono. Qui si trovano chi guarda il codice dei giochi (`js/games/`, ~5000 righe).

**Regole da controllare**
- Trovato: nessuna regola leggibile di r/threejs; la scheda di un aggregatore indica solo che i post di tipo "Projects"/"Portfolio" sono comuni **[DA VERIFICARE]**.
- Da controllare: flair obbligatorio (di solito "Showcase"/"Question"/"Resource") · richiesta di includere il sorgente o un link live · divieto di post che sono solo un link.
- Appropriato: poche GIF/video del gioco (da F3 del piano: registrazione vera del gioco con il rullo) e discussione tecnica. **Non pubblicare senza GIF**: in questo sub vive di immagini.

**Titolo**
```
A cycling game engine where your pedalling is the controller: Three.js ES modules (no bundler), Kenney CC0 assets, running on phones. Feedback on performance welcome
```

**Testo**
```
I'm the dev (free + open source). I made some 3D games for smart trainers where watts and cadence replace the gamepad: a road-race stage with 8 AI riders and drafting, a side-scrolling shooter, a horde shooter, a plane that flies on power.

Tech, in case anyone wants to compare notes:
- Three.js (MIT) as ES modules via an import map: no bundler, no build step
- glTF models from Kenney (CC0), loaded with GLTFLoader; a small shared Base3D class gives each game the loop, menu, HUD text, and sensor input
- the HUD is drawn on a 2D canvas over the WebGL canvas
- same code runs in Chrome and inside an Android WebView

[TUO: GIF/video del gioco, con il rullo vero]

Questions I'd love opinions on: how do you profile frame time on mid-range Android WebViews? Any tricks for instancing lots of low-poly props (trees, riders) without hurting draw calls?
```

**Primo commento (link)**
```
Play it (needs a smart trainer; no demo mode found in the code [DA VERIFICARE]): https://mta-world.com/?ref=reddit-threejs · Code for the games: https://github.com/c1aud1o/ride-freedom/tree/main/js/games
```

---

## Checklist finale prima di ogni post

- [ ] Letta la barra laterale del sub **oggi** (le mie note sono di seconda mano).
- [ ] Flair scelto / thread corretto / giorno giusto.
- [ ] Riempiti i `[TUO: …]`; tolte le frasi che non sono vere per te.
- [ ] `LICENSE` GPL-3.0 nel repo e `README` in inglese (se citati).
- [ ] Il link `?ref=` apre una pagina che si capisce senza leggere italiano? (oggi l'app è in italiano: valutare una pagina d'ingresso in inglese, fase D4).
- [ ] Tempo libero per rispondere nelle 3 ore dopo la pubblicazione.
