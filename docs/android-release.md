# Build release Android: chiave, Secret GitHub, Play Store

Il workflow `.github/workflows/android.yml` ha due modalità:

| Secret presenti? | Cosa compila | Dove finisce |
|---|---|---|
| **no** (oggi) | APK **debug** `fossDebug`, firmato con `android/app/ridefreedom-debug.keystore` | release GitHub `app-android` → `spindro.apk` (e sito, via `pages.yml`) |
| **sì** | APK **release** `fossRelease` firmato + AAB **release** `playRelease` firmato | APK → release `app-android` / sito; AAB → solo artifact della run (`spindro-play-aab`), **mai** nella release pubblica |

Senza Secret nel log della run compare un avviso giallo *"APK debug (fallback)"*: nulla si rompe.
Nel riepilogo di ogni run c'è la riga *"firmata release: true/false"*.

## Varianti (product flavors, dimensione `distribution`)

- **`foss`**: niente servizi Google. È l'APK pubblico (GitHub, sito, in futuro F-Droid/IzzyOnDroid).
- **`play`**: è l'AAB per Google Play.

Per ora sono identiche (stesso `applicationId` `com.spindro.app`). Il codice Java può distinguerle con
`BuildConfig.DISTRIBUTION` (`"foss"` o `"play"`). Quando servirà Firebase (account opzionale, sez. 5
di `PIANO-LANCIO.md`) le dipendenze andranno solo nella variante play (`playImplementation ...`),
con `google-services.json` in `android/app/src/play/` e il plugin `google-services` applicato in
modo che la variante foss non lo richieda.

## Versione

- `versionCode` = numero della run di GitHub Actions (`github.run_number`, variabile `VERSION_CODE`):
  cresce sempre, quindi ogni build si installa sopra la precedente e il Play Store la accetta.
- `versionName` = `1.0.<run>` (es. `1.0.57`).
- In locale, senza `VERSION_CODE`, vale 1 / `1.0.1`.

## 1. Generare la chiave di caricamento (una volta sola, sul tuo PC)

Serve un JDK (va bene quello di Android Studio). **Non** farlo dentro la cartella del repository.

```sh
keytool -genkeypair -v \
  -keystore spindro-release.jks \
  -alias spindro \
  -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` chiede una password per il keystore e i dati del certificato (nome, città, paese: bastano
nome e paese). Con i keystore PKCS12 (il formato predefinito) la password della chiave è la stessa del
keystore: usala per entrambi i Secret.

**Conserva `spindro-release.jks` e la password in due posti sicuri** (es. password manager + copia
offline). Non va mai committato: il `.gitignore` ignora `*.jks` e `*.b64`, ma tienilo comunque fuori dal repo.

## 2. Caricare la chiave nei Secret di GitHub

Converti il file in base64 su una sola riga:

```sh
# Linux
base64 -w0 spindro-release.jks > spindro-release.b64
# macOS
base64 -i spindro-release.jks | tr -d '\n' > spindro-release.b64
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("spindro-release.jks")) | Out-File -NoNewline spindro-release.b64
```

Poi su GitHub: **Settings → Secrets and variables → Actions → New repository secret**, e crea:

| Nome | Valore |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | il contenuto di `spindro-release.b64` |
| `ANDROID_KEYSTORE_PASSWORD` | la password del keystore |
| `ANDROID_KEY_ALIAS` | `spindro` (l'alias usato in `keytool`) |
| `ANDROID_KEY_PASSWORD` | la password della chiave (con PKCS12 = quella del keystore) |

Cancella `spindro-release.b64` dopo averlo incollato. Alla prossima run (push o *Run workflow*) il log
dirà *"Chiave di release trovata"*.

Per compilare in locale una release firmata:

```sh
export ANDROID_KEYSTORE_FILE=/percorso/spindro-release.jks
export ANDROID_KEYSTORE_PASSWORD=... ANDROID_KEY_ALIAS=spindro ANDROID_KEY_PASSWORD=...
cd android && ./gradlew assembleFossRelease bundlePlayRelease
```

Senza queste variabili la build release esce **non firmata** (Gradle lo segnala con un avviso).

### Attenzione: cambio di firma dell'APK pubblico

Oggi chi ha installato `spindro.apk` ha un'app firmata con la chiave debug. Il primo APK firmato con
la chiave di release ha una firma diversa: Android **non** lo installa sopra il vecchio. Chi aggiorna
dovrà disinstallare una volta e reinstallare (si perdono i dati locali dell'app). Conviene farlo
subito, finché gli utenti sono pochi, e scriverlo nelle note della release.

## 3. Play App Signing (firma gestita da Google Play)

Con Play App Signing Google conserva la **chiave di firma dell'app** e tu usi la tua chiave solo come
**chiave di caricamento** (upload key). Se perdi la chiave di caricamento, Google può sostituirla; la
chiave di firma non si perde mai.

1. Crea l'account sviluppatore su <https://play.google.com/console> (25 $) e crea l'app
   (nome *Spindro*, app gratuita).
2. Scarica l'AAB: GitHub → **Actions** → run verde → in fondo, artifact **`spindro-play-aab`**
   (è uno zip: dentro c'è `spindro-play.aab`).
3. Play Console → la tua app → **Test → Test chiuso** (obbligatorio per i nuovi account personali:
   12 tester per 14 giorni, vedi sez. 9 del piano) → **Crea nuova release**.
4. Alla prima release la Console propone **"Firma dell'app di Google Play"**: scegli
   **"Usa una chiave generata da Google"** (consigliato) e continua. La chiave con cui è firmato l'AAB
   (`spindro-release.jks`) viene registrata automaticamente come chiave di caricamento.
5. Carica `spindro-play.aab`, scrivi le note di rilascio e invia.
6. In **Configurazione → Integrità dell'app → Firma dell'app** trovi le impronte SHA-1/SHA-256
   delle due chiavi: serviranno più avanti per Firebase (variante play).

Gli AAB successivi vanno firmati sempre con la stessa chiave di caricamento, e con un `versionCode`
più alto (automatico, grazie al numero della run).

Nota: l'APK foss (GitHub/sito) resta firmato con **la tua** chiave, mentre l'app scaricata da Play è
firmata da **Google**: le due installazioni non si aggiornano a vicenda. Chi passa da una all'altra
deve disinstallare prima. È normale per le app distribuite sia fuori sia dentro Play.

## Perché minify/shrink sono spenti

`minifyEnabled` e `shrinkResources` sono `false` nella release. Capacitor carica i plugin (compreso
`@capacitor-community/bluetooth-le`) per riflessione tramite annotazioni, e R8 potrebbe rimuovere o
rinominare classi e metodi chiamati solo dal ponte JavaScript: il Bluetooth smetterebbe di funzionare
senza errori di compilazione, e lo si scoprirebbe solo provando con un rullo vero. Il guadagno sarebbe
piccolo, perché l'app è quasi tutta HTML/JS/asset. Se un giorno si vorrà attivarlo: aggiungere le
regole `-keep` per `com.getcapacitor.**` e per i plugin in `proguard-rules.pro` e provare tutta la
parte BLE su un dispositivo prima di pubblicare.
