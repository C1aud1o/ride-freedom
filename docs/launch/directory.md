# Elenchi gratuiti e permanenti (G2): AlternativeTo, F-Droid / IzzyOnDroid, GitHub topics

> **Solo bozze: nessun inserimento fatto.** L'invio è a cura del proprietario (account personali). Stato del codice al 2026-11-07.

## 0. Cose che bloccano o indeboliscono gli inserimenti (da sistemare prima)

| Cosa | Stato oggi | Perché conta |
|---|---|---|
| File `LICENSE` (GPL-3.0) nel repo | **Manca** (`ls LICENSE*` vuoto; `package.json` senza `license`) | F-Droid e IzzyOnDroid richiedono una licenza FOSS riconoscibile; AlternativeTo chiede il campo licenza. [DA VERIFICARE] che D6 la aggiunga. |
| README in inglese | Oggi in italiano | Tutti e tre gli elenchi sono internazionali. |
| Metadati Fastlane (`fastlane/metadata/android/<lingua>/`: titolo, descrizioni, icona, screenshot) | **Mancano** | Richiesti da IzzyOnDroid ("Fastlane metadata in the repo"); F-Droid li legge volentieri. |
| APK firmato in release, senza `debuggable` | `android.yml` e `build.gradle` hanno una `signingConfig`; il comando `npm run android:apk` produce `assembleFossDebug` | IzzyOnDroid: "Signed with a release key, without android:debuggable". Pubblicare su GitHub Releases un APK **release** `foss` **[DA VERIFICARE]** che il workflow lo faccia. |
| Nessun tracker/SDK proprietario nella variante `foss` | `build.gradle`: flavor `foss` "niente servizi Google"; Firebase previsto solo in `play` | È proprio ciò che F-Droid/Izzy chiedono. **Sentry** (D1) nella variante `foss`: non metterlo, per F-Droid conta come tracker; sull'APK Izzy "trackers such as ads and analytics are never accepted". |
| `applicationId` | `com.spindro.app` | Univoco; F-Droid preferisce un ID basato su un dominio che possiedi: il dominio definitivo è ancora da decidere (A1). Cambiare l'ID dopo è doloroso: deciderlo **prima**. |
| Dominio/URL | `https://mta-world.com` | Se cambia il dominio, aggiornare tutti i testi qui sotto. |

---

## 1. AlternativeTo (alternativeto.net)

**Come si invia (da fonti di terze parti, il sito risponde 403 ai miei strumenti: [DA VERIFICARE] il percorso):** account → icona utente in alto a destra → *Suggest new application* → modulo con piattaforme, licenza, descrizione, tag, URL ufficiali (sito, store, social) → revisione prima della pubblicazione. Poi, nella pagina di **ogni** app concorrente: *Contribute to this page → Suggest alternatives* e proponi Spindro come alternativa. Probabile regola: una sola voce per app (non due voci "free" e "pro").

### Scheda dell'applicazione

| Campo | Testo |
|---|---|
| Nome | **Spindro** |
| Tagline (breve) | Free, open-source smart trainer app with virtual gears, ERG workouts and pedal-powered games |
| Licenza | Open source — GPL-3.0 [DA VERIFICARE `LICENSE`] |
| Prezzo | Free |
| Piattaforme | Android · Web (Chrome / Edge; Windows, macOS, Linux, ChromeOS) · PWA. **Non iOS** (iPhone solo via browser Bluefy) |
| Sito | https://mta-world.com [DA VERIFICARE dominio definitivo] |
| Codice | https://github.com/c1aud1o/ride-freedom |
| Tag | indoor cycling, smart trainer, ERG, FTMS, workouts, open source, cycling games, FIT, GPX, Garmin, Strava |

**Descrizione lunga (EN):**
```
Spindro is a free, open-source (GPL-3.0) app for controlling a Bluetooth smart bike trainer, from an Android phone or from Chrome/Edge on a computer. There is no subscription and no account: your data stays on your device.

It connects to FTMS trainers (tested mostly on the Van Rysel D100); Tacx FE-C over Bluetooth and old-firmware Wahoo are implemented but so far only tested with a simulated trainer. It offers four riding modes (24 virtual gears driven by a physics model, fixed-power ERG, simulated slope, and resistance level), structured ERG workouts based on your FTP with a ramp FTP test and a workout editor, GPX routes where the grade follows the track, riding along a YouTube video, a history with power records, and .FIT recording that you can import into Garmin Connect and Strava.

For fun, it includes pedal-powered 3D games where your watts and cadence are the controller. On Android, the phone can also broadcast power, cadence and speed as a Bluetooth sensor so a Garmin watch records the ride. Zwift Click support as a shifter is experimental.

Limits: the interface is currently Italian only; no virtual worlds or online racing; accounts and leaderboards are planned (optional). Not affiliated with any of the brands mentioned.
```

**Descrizione breve per le liste "alternative" (≤ ~300 car.):**
```
Free, open-source smart trainer app: 24 virtual gears, ERG workouts, GPX routes, FIT export, pedal-powered 3D games. No account or subscription. Android and web (Chrome/Edge). UI currently Italian only.
```

### Alternativa a… (testo da incollare come motivo/commento quando si propone l'alternativa)

Regola: sii preciso, non dire che sostituisce tutto. Il confronto serve a chi cerca "alternativa gratuita".

| Pagina concorrente | Testo ("why it's an alternative") |
|---|---|
| **Zwift** | `Free and open source, no subscription: virtual gears, ERG workouts, GPX routes and pedal-powered games on a smart trainer. No virtual worlds or online racing, and it works with a Zwift Click as a shifter (experimental).` |
| **MyWhoosh** | `A lighter alternative for people who want a workout rather than a virtual world: open source, no account, runs in Chrome/Edge or on Android. No 3D worlds or online events; it has its own pedal-powered 3D games.` |
| **Rouvy** | `Similar idea of riding a route with your trainer: GPX routes with grade simulation and riding along a video (YouTube or your own file), but free, open source and without accounts. No video-synced real-world library.` |
| **TrainerRoad** | `Free structured workouts on your FTP (sweet spot, threshold, VO2max…), a ramp FTP test and a block editor, no subscription. It has no adaptive training plans or coaching; workouts can be exported as .FIT/.zwo.` |

(Tutte verificabili nel codice/README: workout strutturati, test FTP, editor, GPX, video, esportazione .FIT/.zwo. Niente affermazioni su "piani adattivi", "mondi" o "gare online" perché non ci sono.)

---

## 2. F-Droid

Fonte: https://f-droid.org/docs/Inclusion_Policy (letta il 2026-11-07).

### Checklist dei requisiti ufficiali, confrontata con il progetto

| Requisito (policy ufficiale) | Stato Spindro | Esito |
|---|---|---|
| Software libero (FLOSS), licenza riconosciuta | GPL-3.0 dichiarata nei piani; **`LICENSE` assente nel repo** | ❌ da fare |
| Nessun SDK proprietario di tracciamento/pubblicità (Play Services, Firebase, Crashlytics…) | Variante `foss` senza Firebase; Firebase solo in `play` | ✅ (da mantenere così) |
| Compilare da sorgenti con toolchain 100% libera; niente binari precompilati se non da fonti ammesse (Debian, Maven Central, Google Maven…) | Dipendenze Capacitor 7.6.10 + `@capacitor-community/bluetooth-le` 7.3.2 da npm/Maven; **il pacchetto `vendor/three` e `vendor/capacitor` sono file minimizzati committati** | ⚠️ [DA VERIFICARE]: F-Droid vuole poter ricostruire da sorgente; i file in `vendor/` sono binari/minificati e potrebbero richiedere di essere ottenuti da npm in fase di build |
| Asset e font con licenza valida o pubblico dominio | Kenney CC0, Barlow OFL, Three.js MIT; crediti nel README e in `docs/legal/licenses.*.md` | ✅ |
| Attivamente mantenuta, utile, non un semplice rebrand | Sì | ✅ |
| Non "demo" o wrapper web senza funzioni native | Ha plugin Java nativo (ponte Garmin) e BLE nativo | ✅ |
| Sviluppata attivamente da almeno 3 mesi (o utenti comprovati) | Storia git recente [DA VERIFICARE la data del primo commit] | ⚠️ |
| ID applicazione univoco | `com.spindro.app` | ✅ (verificare conflitti) |
| Anti-Features dichiarate se serve (es. `NonFreeNet` per servizi non liberi) | Strava (opzionale, via Cloudflare Worker) e YouTube (player ufficiale) sono servizi di rete di terzi | ⚠️ probabile Anti-Feature `NonFreeNet`; [DA VERIFICARE] con i revisori |
| Nessuna violazione di marchi/copyright | Solo testi "compatibile con"; nota nessuna affiliazione | ✅ |
| Scarica eseguibili solo con consenso esplicito | Non lo fa | ✅ |

**Procedura:** richiesta di inclusione nel repository GitLab di F-Droid (`fdroiddata`, un merge request con il file `metadata/com.spindro.app.yml`), oppure issue "Request For Packaging" **[DA VERIFICARE la procedura corrente sul sito F-Droid]**. Serve una release **con tag Git** e Fastlane/metadati nel repo. F-Droid **ricompila e firma con la propria chiave** (a differenza di Play), quindi gli utenti non possono aggiornare tra APK GitHub e F-Droid senza reinstallare: dirlo nel README.

**Testo per i metadati (EN, Fastlane `full_description.txt`/`short_description.txt`):**
```
short_description.txt (≤80):
Free, open-source app for smart bike trainers: virtual gears, ERG, workouts.
```
```
full_description.txt:
Spindro connects over Bluetooth to a smart bike trainer and lets you ride with 24 virtual gears, fixed-power ERG workouts, simulated slope and resistance. It includes structured workouts based on your FTP, a ramp FTP test, a workout editor, GPX routes, riding along a video, a history with power records, and .FIT recording for Garmin Connect and Strava.

Also: pedal-powered 3D games, and a bridge that makes the phone broadcast power, cadence and speed as a Bluetooth sensor so a Garmin watch can record the ride.

No account, no ads, no tracking: your data stays on your device.

Notes: tested mostly with a Van Rysel D100. Tacx FE-C and old Wahoo support is only tested with a simulated trainer. Zwift Click support is experimental. The interface is currently Italian only.
```
(Se la variante `foss` contiene il collegamento opzionale con Strava e YouTube, dichiararlo nella descrizione.)

---

## 3. IzzyOnDroid

Fonte: https://izzyondroid.org/docs/general/AppInclusionPolicy/ (letta il 2026-11-07). Richieste: sul tracker di IzzyOnDroid su Codeberg (le fonti dicono che la richiesta di inclusione va fatta lì; la pagina "New app inclusions" non l'ho potuta aprire **[DA VERIFICARE]**).

### Checklist dei requisiti ufficiali

| Requisito (policy ufficiale) | Stato Spindro | Esito |
|---|---|---|
| Licenza FOSS approvata OSI/FSF, sorgenti accessibili (GitHub ok) | GPL-3.0 prevista; `LICENSE` assente | ❌ da fare |
| Nessun componente proprietario non essenziale; **mai** pubblicità né analytics | Variante `foss` ok; niente Sentry in `foss` | ✅ se mantenuto |
| Niente `usesCleartextTraffic` | `capacitor.config.json`: `allowMixedContent: false`; nessun `usesCleartextTraffic` trovato nel manifest | ✅ |
| Per app rivolte agli utenti finali, non librerie/demo | Sì | ✅ |
| Nessun download di eseguibili senza consenso | Non lo fa | ✅ |
| `packageName` univoco | `com.spindro.app` | ✅ |
| Metadati **Fastlane** nel repo: descrizioni breve e lunga, icona, screenshot | **Mancano** | ❌ da fare |
| APK **firmato con chiave release**, senza `debuggable`/`testOnly` | Da verificare che la release `foss` pubblicata su GitHub lo sia | ⚠️ |
| Origine preferita: allegato a una **release GitHub taggata** | Il workflow carica APK su GitHub (verificare tag/release) | ⚠️ |
| Dimensione ≈ ≤ 30 MB per APK | Da misurare (3D asset Kenney in `assets/3d`) **[DA VERIFICARE]** | ⚠️ |
| Permessi pericolosi spiegabili | BLE, posizione solo ≤ Android 11, ADVERTISE per il ponte; tutti motivati | ✅ (spiegarli nella richiesta) |
| **Categorie escluse: giochi** (salvo eccezioni) | L'app è un'app di allenamento che include giochi: rischio che un revisore la veda come "gioco" | ⚠️ spiegare che i giochi sono una funzione secondaria dell'allenamento |
| **Politica sull'IA**: app "vibe-coded" rifiutate; l'LLM è ok per testi della documentazione, ma non nel codice; "la mancanza di trasparenza può portare al rifiuto" | **Non so come è stato scritto il codice di questo repo; se parte è generata da un LLM, la politica potrebbe escluderla** | ⚠️ **da valutare con onestà prima di fare richiesta** |
| Wrapper WebView senza valore aggiunto sono esclusi ("meglio una PWA") | Ha BLE nativo e plugin Java del ponte Garmin | ✅ |

**Testo della richiesta (EN, per l'issue su Codeberg):**
```
Title: Request inclusion: Spindro (com.spindro.app)

Source: https://github.com/c1aud1o/ride-freedom
License: GPL-3.0
Release: https://github.com/c1aud1o/ride-freedom/releases (signed release APK, `foss` flavour; no Google services)

Spindro is a free app for smart bike trainers (indoor cycling): it connects over Bluetooth, supports virtual gears, ERG workouts, GPX routes and .FIT recording, and can make the phone broadcast power/cadence/speed so a watch records the ride. It includes optional pedal-powered 3D games as a secondary feature.

No ads, no analytics, no accounts. Permissions: Bluetooth (scan/connect/advertise; location only up to Android 11, as required by the platform), internet (optional YouTube video and Strava upload), vibrate.
Fastlane metadata is in the repo. It is not a WebView wrapper: it uses a native BLE plugin and a custom Java plugin for the Bluetooth peripheral role.
[Aggiungi qui, onestamente, la nota sull'uso di assistenza AI nel codice, se applicabile.]
```

---

## 4. GitHub topics

Regole ufficiali (docs.github.com): massimo **20** topic, ciascuno di soli **minuscole, numeri e trattini**, **≤ 50 caratteri**; i topic sono pubblici.

Dal piano (sez. 10): `zwift-alternative`, `smart-trainer`, `ftms`, `web-bluetooth`. Elenco consigliato (17):

```
smart-trainer
indoor-cycling
zwift-alternative
ftms
web-bluetooth
bluetooth-low-energy
pwa
capacitor
android
threejs
fit-file
gpx
erg-mode
cycling
open-source
fitness
garmin
```

Aggiungere in `Settings → About → Topics` (o `gh repo edit --add-topic …`). Impostare anche **Description** (≤ 350 caratteri) e **Website**:

```
Description: Free, open-source smart-trainer app: virtual gears, ERG, workouts, GPX, FIT export and pedal-powered 3D games. Web Bluetooth (FTMS) + Android (Capacitor). 
Website: https://mta-world.com/?ref=github
```

"Social preview" (immagine 1280×640): usare la grafica F4. Aggiungere almeno 3 issue con l'etichetta `good first issue` (traduzioni, test su un rullo, documentazione): oggi **non esistono template né etichette** (`.github/` ha solo `workflows`) **[DA VERIFICARE D6]**.
