# Documenti legali di Spindro (bozze, attività D3)

Questa cartella contiene le **bozze** dei testi legali, ognuno in italiano (`*.it.md`) e in inglese (`*.en.md`).

> Sono bozze scritte con cura, ma **non sono una consulenza legale**. Vanno riviste da un professionista o generate/controllate con un servizio come iubenda prima di essere pubblicate (piano di lancio, sez. 7).

| File | Contenuto | Dove va pubblicato |
|---|---|---|
| `privacy.it.md` / `privacy.en.md` | Informativa sulla privacy | Sito + link nell'app + scheda Play Store |
| `terms.it.md` / `terms.en.md` | Termini d'uso | Sito + link nell'app (alla creazione dell'account) |
| `account-deletion.it.md` / `account-deletion.en.md` | Come cancellare l'account (in app e via email) | **Pagina web pubblica**: l'URL va indicato in Play Console |
| `licenses.it.md` / `licenses.en.md` | Licenze e crediti, verificati sui file del repo | Pagina "Licenze" nell'app e nel sito |
| `trademarks.it.md` / `trademarks.en.md` | Nota sui marchi e regole per usarli | Sito, README, scheda dello store |

## 1. Segnaposto da compilare

Cerca nei file le parentesi quadre `[...]`.

| Segnaposto | Dove | Valore |
|---|---|---|
| `[NOME]` / `[NAME]` | tutti | Nome e cognome del titolare (persona fisica) |
| `[INDIRIZZO]` / `[ADDRESS]` | privacy, termini, cancellazione | Indirizzo del titolare. Se non vuoi pubblicare la residenza valuta un domicilio o una PEC: va chiesto al professionista |
| `[EMAIL CONTATTO]` / `[CONTACT EMAIL]` | tutti | Casella dedicata (es. `privacy@dominio`), controllata davvero: ci sono scadenze di legge |
| `[DATA]` / `[DATE]` | tutti | Data di pubblicazione |
| `[ANNO]` / `[YEAR]` | licenze | Anno del copyright |
| `[HOSTING]` | privacy | Dove sta il sito (oggi GitHub Pages sul dominio `mta-world.com`; poi Firebase Hosting) |
| `[GOATCOUNTER O PLAUSIBLE]` | privacy | Lo strumento scelto per le visite al sito, o togliere la riga se non lo usi |
| `[GIORNI DI CONSERVAZIONE SENTRY]` | privacy | I giorni di conservazione impostati su Sentry |
| `[CITTÀ]` / `[CITY]` | termini, sez. 12 | Foro per i non consumatori (di solito la tua città) |
| `[URL PAGINA CANCELLAZIONE]` / `[ACCOUNT DELETION PAGE URL]` | cancellazione | URL pubblico della pagina |
| `[GPL-3.0]` | termini | Confermare la licenza e aggiungere il file `LICENSE` |
| `[DA VERIFICARE…]` | licenze | Controllo delle licenze AndroidX nell'AAB di release |

## 2. Prima di pubblicare: cosa deve rivedere un professionista (o iubenda)

1. **Ruolo e base giuridica.** Titolare = persona fisica; basi: contratto (account), legittimo interesse (Sentry, anti-abuso), consenso (statistiche), consenso esplicito art. 9 (battito). Controllare che la scelta sia corretta, anche l'uso del legittimo interesse per Sentry.
2. **Formula del consenso per il battito cardiaco** (art. 9.2.a): il testo dell'opzione nell'app deve essere chiaro, separato e spento di default. Valutare se serve una valutazione d'impatto (DPIA) o il **registro dei trattamenti** (art. 30): con dati sulla salute il registro probabilmente serve.
3. **Trasferimenti extra-UE** (Google, Cloudflare, Sentry: aziende USA; Firebase Authentication non ha regione UE): controllare DPA, clausole contrattuali standard e Data Privacy Framework. **Accettare i DPA nelle console** di Firebase e Sentry (E1/D1) e verificare Cloudflare.
4. **Età minima 14 anni** (consenso digitale in Italia) e come verificarla senza raccogliere troppi dati.
5. **Termini d'uso:** clausole di limitazione di responsabilità e foro del consumatore, in base al Codice del consumo e al Codice civile (artt. 1229, 1341). Rivedere il testo sulla sicurezza e sui giochi.
6. **Pubblicazione dell'indirizzo** di una persona fisica (privacy) e uso di un'email dedicata.
7. **Nota marchi** e uso del badge "Compatible with Strava": confrontare con le [linee guida Strava](https://developers.strava.com/guidelines/) e con i Termini API di Strava e di YouTube al momento della pubblicazione.
8. **Licenza GPL-3.0:** avvisi di copyright, DCO, compatibilità con le dipendenze elencate (MIT, CC0, Apache 2.0: compatibili; OFL per i caratteri, che non sono incorporati).
9. **Nome e marchio "Spindro"** (A1): ricerca EUIPO/TMview e Play Store; la sezione "Il nome Spindro" dei marchi dipende dall'esito.

## 3. Le bozze descrivono anche funzioni non ancora nel codice

Ho verificato il comportamento **attuale** dell'app leggendo `js/`, `sw.js`, `index.html`, `server/strava-worker/` e `android/`. Nel codice di oggi **non ci sono** Firebase, account, Sentry, GoatCounter né consenso alle statistiche: la privacy li descrive perché sono previsti dalle attività D1, D2 ed E1–E6, e dice che esistono "solo nelle versioni che li includono".

**Non pubblicare la privacy finché il codice non corrisponde.** Quando le funzioni arrivano, ricontrollare queste promesse:

| Promessa nel testo | Dove verificare |
|---|---|
| Menu *Impostazioni → Account → Elimina account*, che cancella profilo, dati sincronizzati, battito e punteggi in classifica | E3 |
| Opzione "Salva anche il battito nel cloud": spenta di default, separata, la revoca cancella il battito sul server; battito mai in classifica | E4 |
| Firestore in `eur3`; regole che limitano ogni utente ai propri dati; App Check | E1, E2 |
| Sentry: server UE, nessun dato personale, IP non salvato, nessun contenuto dello storico né battito negli eventi | D1 (`sendDefaultPii` spento, pulizia di URL e breadcrumb) |
| Statistiche d'uso solo dopo consenso al primo avvio, modificabile dalle impostazioni; GoatCounter senza cookie | D1, D2 |
| Le classifiche usano solo dati registrati da Spindro, mai dati letti da Strava | E5 |
| Variante `foss`: nessuna di queste funzioni | A4 |

## 4. Differenze tra il codice di oggi e il testo (da decidere)

Cose che ho dovuto scrivere così perché il codice fa così. Se vuoi cambiarle, si cambia il codice, non il testo:

1. **Strava, caricamento automatico.** Dopo il collegamento, "Carica in automatico quando termino" è **acceso di default** (`strava.js`: `auto = true`). L'upload parte quando premi *Termina*, o dal pulsante manuale. Il testo lo dice. Se vuoi "solo su richiesta esplicita", va messo spento di default.
2. **Strava e battito.** Il file `.FIT` caricato **contiene il battito** (`fit.js`), anche senza il consenso separato dell'account. Passa dal ponte Cloudflare in transito. Il testo lo dichiara. Alternativa più prudente: togliere il battito dal FIT inviato a Strava, o chiedere conferma.
3. **Ponte Strava non ancora attivo.** `js/config.js` ha `STRAVA_PROXY = ''`: oggi l'app usa la modalità personale (Client ID e Secret dell'utente, dati diretti a Strava). Il testo descrive entrambe. Il Worker permette le origini `mta-world.com`: va aggiornato col dominio definitivo.
4. **Google Fonts dal server di Google.** `index.html` carica Barlow da `fonts.googleapis.com`: Google riceve l'IP dell'utente a ogni visita. Il testo lo dichiara. **Consiglio:** scaricare i font (licenza OFL) e servirli dal sito, poi togliere la riga dalla privacy e dalla "Sicurezza dei dati".
5. **Backup di Android.** `AndroidManifest.xml` ha `allowBackup="true"`: il sistema può copiare i dati locali (storico, impostazioni, token Strava) nel backup Google dell'utente. Il testo lo dichiara. Se non vuoi, mettere `allowBackup="false"` o escludere i dati con le regole di estrazione.
6. **YouTube.** Il lettore si carica da `youtube.com`, non da `youtube-nocookie.com`: Google può usare cookie. Il testo lo dichiara. Si può passare alla versione "nocookie" per ridurli.
7. **Nome nell'interfaccia.** Il titolo in `index.html` mostra ancora "RideFreedom": coerenza con "Spindro" da rivedere (non toccato, fuori dall'attività D3).
8. **File `LICENSE` assente.** Il testo della licenza GPL non è ancora nel repo (D6).

## 5. Checklist Play Console, "Sicurezza dei dati" (Data safety)

Risposte coerenti con la privacy. Valgono per la **variante `play`** (con account). La variante `foss` non raccoglie nulla: tutto "No".

### 5.1 Domande generali

| Domanda | Risposta |
|---|---|
| L'app raccoglie o condivide i dati degli utenti richiesti? | **Sì** (variante `play` con account) |
| Tutti i dati sono cifrati in transito? | **Sì** (HTTPS) |
| Gli utenti possono chiedere la cancellazione dei dati? | **Sì**: in app (*Impostazioni → Account → Elimina account*) e via web/email |
| URL per la cancellazione dei dati (account) | URL della pagina `account-deletion` |
| URL della privacy policy | URL della pagina `privacy` |
| L'app permette di creare un account? | **Sì**, facoltativo (Firebase Auth: email e Google) |
| Conformità alla policy Famiglie (Families)? | **No**: l'app non è destinata ai minori; per l'account serve un'età di 14 anni |

### 5.2 Tipi di dati

"Raccolti" = inviati fuori dal dispositivo a noi. "Condivisi" = ceduti a terzi per i loro scopi. Il trasferimento ai fornitori che trattano per noi (Google/Firebase, Sentry, Cloudflare) **non** conta come condivisione secondo Google. Il trasferimento a Strava e YouTube, fatto su azione dell'utente, nemmeno.

| Categoria / tipo | Raccolto | Condiviso | Facoltativo | Finalità | Note |
|---|---|---|---|---|---|
| **Informazioni personali → Indirizzo email** | Sì | No | Sì (account facoltativo) | Funzionalità dell'app, gestione dell'account | |
| **Informazioni personali → Nome** (nome visualizzato) | Sì | No | Sì | Funzionalità dell'app (classifiche pubbliche), gestione dell'account | Visibile ad altri utenti nelle classifiche |
| **Informazioni personali → ID utente** | Sì | No | Sì | Funzionalità dell'app, gestione dell'account | |
| **Salute e fitness → Informazioni sulla salute** (battito cardiaco) | Sì, **solo con consenso esplicito separato** | No | **Sì** | Funzionalità dell'app (sincronizzazione) | Spento di default; revocabile |
| **Salute e fitness → Informazioni sul fitness** (uscite, potenza, distanza, FTP) | Sì | No | Sì | Funzionalità dell'app (backup, sincronizzazione) | |
| **Attività nell'app → Interazioni con l'app** (punteggi, giochi usati) | Sì | No | Sì | Funzionalità dell'app (classifiche); Analisi **solo con consenso** | Statistiche anonime solo se acconsenti |
| **Info e prestazioni dell'app → Log di arresto anomalo** | Sì | No | No | Analisi (Sentry) | Senza dati personali |
| **Info e prestazioni dell'app → Diagnostica** | Sì | No | No | Analisi | Dati tecnici dell'errore |
| Posizione (approssimativa e precisa) | **No** | | | | La permission di posizione è solo per il BLE su Android ≤ 11 e non viene usata |
| Dispositivo o altri ID | **No** (da verificare con le SDK Firebase) | | | | Vedi nota sotto |
| Foto, video, audio, file, contatti, calendario, messaggi, finanza, cronologia web | **No** | | | | |

Nota: per le tabelle ufficiali delle SDK Firebase Auth/Firestore e Sentry, usare la pagina "Data disclosure" di ogni SDK nella documentazione di Google e Sentry. **Ricontrollare** al momento dell'integrazione se compaiono altri identificativi (per esempio ID di installazione).

### 5.3 Altre dichiarazioni

- **Permessi** (`AndroidManifest.xml`): `INTERNET`, `BLUETOOTH*` (scan, connect, advertise), `ACCESS_*_LOCATION` solo fino ad Android 11 (`maxSdkVersion=30`) per il BLE, `VIBRATE`. `BLUETOOTH_SCAN` è dichiarato con `neverForLocation`. Nessun permesso di posizione su Android 12+.
- **Categoria dell'app:** Salute e fitness. Compilare la **dichiarazione "App per la salute"** se richiesta (l'app non usa Health Connect).
- **Valutazione dei contenuti:** nessuna violenza realistica; i giochi hanno scene con zombie e armi in stile cartone: compilare il questionario con onestà.
- **Pubblico di destinazione:** adolescenti/adulti, non bambini.
- **Pubblicità:** nessuna. **Acquisti in-app:** nessuno.
- **Link a servizi di terzi** nella scheda: usare la frase della nota marchi.
- **Pagina "cancellazione account"** raggiungibile senza accedere all'app.

### 5.4 Per la variante senza account / test chiuso attuale

Se il test chiuso parte con l'app di oggi (senza Firebase né Sentry), l'app **non raccoglie dati** sul server: nella Sicurezza dei dati si può rispondere "No, l'app non raccoglie né condivide dati" **solo se** nel frattempo non è stato aggiunto nulla, e tenendo conto di:

- Google Fonts, che contatta Google al caricamento (vedi punto 4 della sez. 4: meglio incorporare i font prima);
- il lettore YouTube, quando l'utente lo usa;
- il caricamento su Strava, su azione dell'utente.

Aggiorna la scheda **prima** di pubblicare una versione che aggiunge account o Sentry: Google confronta la dichiarazione con ciò che l'app fa.

## 6. Quando aggiornare i documenti

A ogni nuova dipendenza, nuovo servizio esterno, nuovo dato salvato (in `localStorage`, nel database o inviato in rete), nuova lingua dell'app: aggiornare privacy, licenze e questa checklist **nello stesso commit**.
