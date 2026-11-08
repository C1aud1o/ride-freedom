# Firebase: cosa fare nella console (E1)

Passi per il proprietario del progetto, in ordine. Il perché delle scelte è in `docs/account-architettura.md`.

> Tempo: circa un'ora, più l'attesa della verifica del pagamento. Alcune scelte **non si possono cambiare dopo** (sono segnate con ⚠️).

---

## 1. Crea il progetto

1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto**.
2. Nome: `Spindro`. ⚠️ L'**ID del progetto** (es. `spindro-app`) non si cambia più e compare negli indirizzi: sceglilo con cura.
3. **Google Analytics: disattivato** (piano sez. 6: niente Analytics).
4. Metti l'ID del progetto in `.firebaserc` al posto di `spindro-PROGETTO-DA-CREARE`.

## 2. Piano Blaze e budget a 5 €

Serve per le Cloud Functions. Con pochi utenti il costo previsto è 0 €.

1. Console Firebase → ingranaggio → **Utilizzo e fatturazione** → **Dettagli e impostazioni** → **Modifica piano** → **Blaze**. Collega o crea un account di fatturazione.
2. Google Cloud Console → **Fatturazione** → **Budget e avvisi** → **Crea budget**:
   - ambito: solo il progetto Spindro;
   - importo: **5 €** al mese;
   - soglie: 50%, 90%, 100% (spesa effettiva) e 100% (spesa prevista);
   - email agli amministratori della fatturazione.
3. Il budget **avvisa, non blocca**. I freni veri sono già nel codice: al massimo 5 istanze per funzione, limiti di frequenza, App Check.

## 3. Firestore in `eur3`

1. Console Firebase → **Firestore Database** → **Crea database**.
2. Edizione **Standard**, ID `(default)`.
3. ⚠️ Località: **`eur3 (europe)`** (multiregione UE). Non si cambia più.
4. Modalità **produzione** (tutto chiuso: le regole vere arrivano col deploy del punto 9).

## 4. Authentication: Google ed email

1. **Authentication** → **Inizia** → **Metodo di accesso**:
   - **Google**: attiva. Email di assistenza: quella pubblica del progetto. Nome pubblico: `Spindro`.
   - **Email/password**: attiva. **Non** attivare "link via email (senza password)" per ora.
2. **Impostazioni**:
   - **Protezione dall'enumerazione delle email**: attiva.
   - **Criteri delle password**: minimo 8 caratteri.
   - **Domini autorizzati**: `localhost` (c'è già, serve anche all'app Android), il dominio del sito (`mta-world.com` oggi, quello definitivo appena deciso) ed eventuale dominio Firebase Hosting.
3. **Modelli** (email di verifica e reimpostazione password): lingua italiana, nome mittente `Spindro`. Più avanti si aggiungono le altre lingue.
4. Schermata di consenso OAuth (Google Cloud Console → **API e servizi** → **Schermata consenso OAuth**): nome app, logo, link a Informativa e Termini pubblicati. Senza questi link Google mostra avvisi agli utenti.

## 5. Registra le app

### App web
1. Impostazioni progetto → **Le tue app** → **Web** (`</>`), nome `Spindro web`. **Non** attivare Hosting adesso.
2. Copia l'oggetto `firebaseConfig` (vedi sez. 10).

### App Android
1. **Aggiungi app** → Android, nome pacchetto **`com.spindro.app`** (è l'`applicationId` in `android/app/build.gradle`).
2. Impronte **SHA-1 e SHA-256** di tutte le chiavi che firmano l'app:
   - chiave di **firma dell'app** di Google Play (Play Console → Integrità dell'app → Firma dell'app);
   - chiave di **caricamento** (quella di `docs/android-release.md`);
   - chiave di debug del repository (`android/app/ridefreedom-debug.keystore`), per provare in locale:
     `keytool -list -v -keystore android/app/ridefreedom-debug.keystore -alias ridefreedom -storepass android`
3. Scarica `google-services.json`. Andrà **solo** in `android/app/src/play/` (mai nel flavor `foss`). Non è segreto, ma non serve tenerlo nel repository pubblico: si può generare in CI da una variabile.

## 6. App Check

1. **App Check** → **App**:
   - **Android** → **Play Integrity**: collega il progetto Cloud nella Play Console (Integrità dell'app → API Play Integrity → Collega progetto Cloud), poi registra con l'impronta SHA-256 della chiave di firma di Play.
   - **Web** → **reCAPTCHA Enterprise**: in Google Cloud Console → **reCAPTCHA** crea una chiave di tipo *sito web* con i domini del sito (punteggio, senza casella "Non sono un robot"). Incolla la chiave del sito in App Check. Gratis fino a 10 000 verifiche al mese.
2. **Token di debug**: per provare da PC o emulatore, l'app stampa un token di debug in console; aggiungilo in App Check → App → menu ⋮ → **Gestisci token di debug**. Mai nel codice.
3. Lascia App Check in **monitoraggio** per una o due settimane (pagina **API** → Firestore / Cloud Functions → metriche). Quando le richieste "verificate" sono quasi il 100%, premi **Imponi** per Cloud Firestore. `submitScore` lo impone già da codice.

## 7. Accordi sul trattamento dei dati (DPA) e contatti privacy

1. Console Firebase → Impostazioni progetto → **Privacy** (o **Impostazioni generali** → *Termini sul trattamento dei dati*): leggi e **accetta i Termini per il trattamento e la sicurezza dei dati** (Data Processing and Security Terms).
2. Google Cloud Console → **IAM e amministrazione** → **Impostazioni** / **Privacy e sicurezza**: verifica che il **Cloud Data Processing Addendum** risulti accettato per l'account di fatturazione.
3. Nella stessa pagina inserisci i **contatti privacy**: titolare (tu), email, ed eventualmente il responsabile della protezione dei dati. Sono gli stessi dati di `[EMAIL CONTATTO]` nelle bozze in `docs/legal/`.
4. Annota la data di accettazione: serve per il registro dei trattamenti.

## 8. Rendi più stretto l'accesso con le chiavi API

Le chiavi API di Firebase sono pubbliche per progetto, ma conviene limitarle. Google Cloud Console → **API e servizi** → **Credenziali**:
- chiave **Browser**: restrizione *Referrer HTTP* ai domini del sito (+ `http://localhost:*` per lo sviluppo);
- chiave **Android**: restrizione *App Android* con `com.spindro.app` e le impronte SHA-1 del punto 5;
- per entrambe, restrizione API a: Identity Toolkit, Token Service, Cloud Firestore, Firebase App Check, Firebase Installations, reCAPTCHA Enterprise.

## 9. Primo deploy di regole, indici e funzioni

Dal computer, nella cartella del repository:

```bash
npm i -g firebase-tools        # oppure: npx firebase-tools …
firebase login
firebase use <id-del-progetto>  # o modifica .firebaserc
(cd functions && npm ci)
(cd firebase && npm ci && npm test)   # i test delle regole devono passare (serve Java)
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
firebase functions:artifacts:setpolicy --location europe-west1   # pulisce le vecchie immagini: niente costi di archiviazione
```

Al primo deploy delle funzioni il CLI attiva da solo le API necessarie (Cloud Functions, Cloud Build, Artifact Registry, Eventarc, Cloud Run). Se chiede la località per i trigger Firestore, vedi "dubbi aperti" n. 1 in `docs/account-architettura.md`.

Dati iniziali da creare a mano in Firestore (scrivibili solo da console/server):
- `boards/mattoni` = `{ title: "Mattoni", lowerIsBetter: false }`, e così per `horde`, `shooter`, `gruppetto`, `planata`, `racer-s0`, `racer-s1`… (`lowerIsBetter: true`);
- `challenges/2026-12` = `{ items: [ { id: "km300", metric: "km", target: 300 }, { id: "rides10", metric: "rides", target: 10 } ] }`.

## 10. Valori di configurazione che servono all'app

Sono tutti **pubblici** (finiscono comunque nel codice del sito e dell'APK). La sicurezza la fanno le regole, App Check e le restrizioni delle chiavi.

### 10.1 Cosa scrivere in `js/config.js` (login web, E3/E4)

Il login compare **solo** se `FIREBASE_CONFIG` non è `null`. Con il valore di default (`null`) l'app non mostra nulla e non fa nessuna richiesta verso Firebase/Google: è il comportamento dei fork e della build `foss`.

```js
// js/config.js
export const FIREBASE_CONFIG = {
  apiKey: '…',                       // Impostazioni progetto → Le tue app → Web → firebaseConfig
  authDomain: 'ID-PROGETTO.firebaseapp.com',
  projectId: 'ID-PROGETTO',          // lo stesso di .firebaserc
  appId: '1:…:web:…',
  messagingSenderId: '…',
};
export const FIREBASE_EMULATOR = false;     // true solo nei test con gli emulatori
export const FIREBASE_VERSION = '12.19.0';  // versione ESATTA dell'SDK, caricato da www.gstatic.com/firebasejs/<versione>/
export const FIREBASE_REGION = 'europe-west1';   // regione delle funzioni (già giusta)
export const SITE_URL = 'https://spindro.fit';   // da qui TERMS_URL e PRIVACY_URL (in italiano: /it/terms/ e /it/privacy/)
export const TERMS_VERSION = '2026-11';          // data della bozza in docs/legal/: se cambia, l'app richiede una nuova accettazione
export const PRIVACY_VERSION = '2026-11';
export const HR_CONSENT_VERSION = '2026-11';     // testo del consenso al battito (account.hr.* in locales/)
```

Note:
- `FIREBASE_CONFIG` si compila nella build **ufficiale** (workflow di pubblicazione, variabile `FIREBASE_WEB_CONFIG`) e **non** nella build `foss`. Nel repository resta `null`.
- Il pezzo di `apiKey` non è un segreto; va comunque limitato ai domini del sito (sez. 8).
- **Domini autorizzati** (Authentication → Impostazioni): il dominio del sito e `localhost`; il login con Google usa un popup (`signInWithPopup`) e non funziona dove il browser lo blocca.
- Metodi di accesso usati: **Google** (popup) ed **email e password** con verifica dell'email obbligatoria (le regole la richiedono). Il link via email non è usato.
- Nell'app Android (WebView) il pulsante Google è nascosto finché non c'è il login nativo (compito separato); email e password funzionano.
- Se si cambia la versione dell'SDK, cambiare **solo** `FIREBASE_VERSION` (e rifare `tests/account.spec.mjs`: il test controlla che l'indirizzo contenga la versione).

### 10.2 Altri valori

| Valore | Dove si trova | Dove va |
|---|---|---|
| `firebaseConfig` (sopra) | Impostazioni progetto → Le tue app → Web | `js/config.js` → `FIREBASE_CONFIG` (in CI: variabile di repository `FIREBASE_WEB_CONFIG`, JSON) |
| Chiave del sito reCAPTCHA Enterprise | Google Cloud → reCAPTCHA | variabile `RECAPTCHA_SITE_KEY` (App Check non è ancora nel codice web) |
| Regione delle funzioni | fissa: `europe-west1` | `FIREBASE_REGION` |
| `google-services.json` | Impostazioni progetto → Android | `android/app/src/play/google-services.json` (variabile o file in CI) |
| ID client web OAuth (per il Google Sign-In nativo) | dentro `google-services.json` (`client_type: 3`) o Google Cloud → Credenziali | letto dal codice nativo `play` |

Le variabili vanno in GitHub → Settings → Secrets and variables → Actions → **Variables** (non Secrets: non sono segrete, e come variabili si vedono nei log e si controllano facilmente).

**Mai nel repository né nelle variabili dell'app:** chiavi di account di servizio (`*-adminsdk-*.json`), token di debug di App Check, segreti Strava. Le Cloud Functions non ne hanno bisogno.

### 10.3 Provare in locale con gli emulatori

```bash
cd firebase && npm ci
# in js/config.js (non committare): FIREBASE_CONFIG con projectId 'demo-spindro' e FIREBASE_EMULATOR = true
npx firebase emulators:start --config ../firebase.json --project demo-spindro --only auth,firestore
# oppure tutti i test dell'account in un colpo (serve Java):
npx firebase emulators:exec --config ../firebase.json --project demo-spindro --only auth,firestore \
  "cd .. && SPINDRO_EMULATOR=1 npx playwright test tests/account.spec.mjs --trace off"
```

## 11. Controllo finale

- [ ] Progetto creato, Analytics spento, ID in `.firebaserc`
- [ ] Blaze attivo, budget 5 € con avvisi
- [ ] Firestore `eur3`, modalità produzione
- [ ] Auth: Google + email/password, protezione enumerazione, domini autorizzati, modelli in italiano, schermata OAuth con link legali
- [ ] App web e Android registrate, SHA-1/SHA-256 di firma Play, caricamento e debug
- [ ] App Check: Play Integrity + reCAPTCHA Enterprise, in monitoraggio
- [ ] DPA accettati, contatti privacy inseriti
- [ ] Chiavi API limitate
- [ ] Regole, indici e funzioni pubblicati; test delle regole verdi
- [ ] `boards/*` e la prima sfida del mese creati
- [ ] `FIREBASE_CONFIG` compilato in `js/config.js` della build ufficiale (sez. 10.1), non in quella `foss`
- [ ] Variabili `FIREBASE_WEB_CONFIG` e `RECAPTCHA_SITE_KEY` su GitHub
- [ ] Prova a mano con l'account vero: registrazione, email di verifica, profilo e consensi, uscita sincronizzata, revoca del battito, eliminazione account (vedi la lista in `docs/account-architettura.md` sez. 15)
