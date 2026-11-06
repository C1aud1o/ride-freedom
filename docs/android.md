# App Android

L'app Android è la stessa webapp impacchettata con [Capacitor](https://capacitorjs.com), più due cose
che il browser non può fare:

1. **Bluetooth nativo**: nella WebView di Android non esiste Web Bluetooth, quindi `js/native.js`
   installa un `navigator.bluetooth` equivalente sopra il plugin `@capacitor-community/bluetooth-le`.
   Rullo, Zwift Click, cardio e misuratore di potenza usano lo stesso codice della webapp.
2. **Ponte verso Garmin** (`android/.../GarminBridgePlugin.java`): il telefono si presenta come
   sensore Bluetooth standard *Cycling Power* (potenza + cadenza + giri ruota) e *Speed & Cadence*.
   Il Garmin (Fenix, Edge, Forerunner…) lo associa come un normale misuratore di potenza e registra
   l'attività, che poi si sincronizza da sola con Garmin Connect.

## Installare
- Dal telefono apri **https://mta-world.com/app/ride-freedom.apk** (oppure la release **app-android**
  del repository su GitHub) e scarica il file.
- Android chiede di consentire l'installazione da quella fonte (browser o file manager): consenti.
- Ogni nuova build si installa sopra la precedente (stessa chiave di firma).

## Usare il ponte verso Garmin
1. Nell'app: Impostazioni → **Garmin** → attiva *Trasmetti potenza, cadenza e velocità al Garmin*.
   Al primo avvio Android chiede il permesso Bluetooth.
2. Sul Garmin: *Sensori e accessori* → *Aggiungi nuovo* → **Potenza** (poi anche
   **Velocità/Cadenza** se vuoi distanza e velocità). Scegli **Ride Freedom**.
3. Avvia sul Garmin un'attività **Bici indoor**. Tieni l'app aperta durante l'allenamento.

Cosa viene trasmesso: i watt mostrati dall'app (rullo o misuratore esterno), la cadenza (reale o
stimata) e la velocità (virtuale in modalità Cambio, altrimenti quella del rullo).

## Watt dal misuratore di potenza
Il Garmin non trasmette watt: li riceve dai sensori. Per usare i watt dei tuoi pedali o della tua
guarnitura (Garmin Rally/Vector, Favero, ecc.) collega il **misuratore di potenza** in
Impostazioni: l'app usa i suoi watt e la sua cadenza al posto del rullo (funziona anche nella
webapp). Il battito arriva dall'orologio con *Trasmetti frequenza cardiaca* → *Collega cardio*.

## Strava nell'app
Nell'app l'indirizzo della pagina è `https://localhost`. Con il ponte Strava aggiungi
`https://localhost` a `ALLOWED_ORIGINS`; in modalità personale l'Authorization Callback Domain
deve essere `localhost`.

## Compilare
```sh
npm ci
npm run build:web && npx cap sync android
cd android && ./gradlew assembleDebug   # serve Android SDK (ANDROID_HOME) e JDK 21
```
Su GitHub lo fa il workflow `.github/workflows/android.yml` a ogni push e pubblica l'APK nella release.

Note: la chiave `android/app/ridefreedom-debug.keystore` serve solo a firmare le installazioni dirette;
per il Play Store servirà una chiave di rilascio privata.
