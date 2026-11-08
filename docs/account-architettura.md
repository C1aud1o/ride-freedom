# Account, sincronizzazione e classifiche: architettura (E2)

*Stato: progetto + regole + test. L'interfaccia (login, profilo, sincronizzazione, classifiche) **non è ancora integrata** nell'app: è il lavoro di E3, E4 ed E5.*

Riferimenti: `docs/PIANO-LANCIO.md` sez. 4, 5, 7 · bozze legali in `docs/legal/` (privacy sez. 4 e 5, cancellazione account) · setup della console in `docs/firebase-setup.md`.

File di questa fase:

| File | Cosa contiene |
|---|---|
| `firebase/firestore.rules` | regole di sicurezza |
| `firebase/firestore.indexes.json` | indici (uno composto per le classifiche per Paese) ed esclusioni |
| `firebase/test/rules.test.js` | 24 test delle regole con l'emulatore |
| `firebase.json`, `.firebaserc` | configurazione del progetto Firebase (id del progetto segnaposto) |
| `functions/` | Cloud Functions in TypeScript (v2, `europe-west1`) |
| `.github/workflows/rules.yml` | CI: test delle regole (con Java) e delle funzioni |

---

## 1. Principi

1. **L'app senza account è completa.** L'account aggiunge backup, sincronizzazione, classifiche e sfide. Nessuna funzione esistente dipende dal login.
2. **I dati locali restano la fonte per l'interfaccia.** `localStorage` continua a essere ciò che l'app legge. Il cloud è una copia sincronizzata. Niente login = niente cambia.
3. **Mai perdere dati.** La sincronizzazione unisce (merge per id), non sostituisce. Una cancellazione arriva da un altro dispositivo solo come "lapide" esplicita (`deleted: true`), mai perché un dato manca.
4. **Offline prima di tutto.** Si pedala anche senza rete. Le scritture vanno in coda e partono quando torna la connessione.
5. **Il battito è un dato sanitario.** Sul server solo con consenso esplicito e separato, verificato dalle regole, cancellato alla revoca.
6. **Le classifiche le scrive solo il server.** Il client non può scrivere né cancellare una riga di classifica.
7. **Costi prevedibili.** Poche letture per apertura, liste a pagine, nessun ascolto in tempo reale.

---

## 2. Quando l'app mostra il login

Il login compare **solo se c'è una configurazione Firebase**. La configurazione esiste solo nella build `play` e nel sito web ufficiale. La build `foss` non contiene né la configurazione né l'SDK di Firebase.

| Build | Configurazione Firebase | SDK Firebase | Login |
|---|---|---|---|
| Web ufficiale (Pages/Hosting) | sì, scritta dal workflow di pubblicazione | sì, in `vendor/firebase/` | sì |
| Android `play` | sì, dal source set `play` | sì, dal source set `play` | sì |
| Android `foss` | no | no | **mai** |
| Fork / sviluppo locale | no (a meno di crearla) | no | no |

**Come si realizza (da implementare in E3):**

- Nel repository c'è `js/firebase-config.js` con `export const FIREBASE_CONFIG = null;`. Questo file va in `www/` per tutti.
- **Web ufficiale:** il workflow di pubblicazione sovrascrive `www/js/firebase-config.js` con la configurazione vera (variabile di repository `FIREBASE_WEB_CONFIG`: sono valori pubblici, non segreti) e copia l'SDK in `www/vendor/firebase/`.
- **Android:** `www/` è unico per i due flavor (lo copia `cap sync` in `app/src/main/assets/public`). Il flavor `play` aggiunge un suo source set `android/app/src/play/assets/public/` con la sua `js/firebase-config.js` e `vendor/firebase/`. Gradle, per gli asset, dà la precedenza al flavor sul `main`: nell'APK `play` vince la configurazione vera, nell'APK `foss` resta `null` e la cartella dell'SDK non esiste.
- **A runtime:** `accountsAvailable = FIREBASE_CONFIG != null`. L'SDK si carica con `import()` dinamico **solo** in quel caso. Senza configurazione l'app non tocca nulla, nemmeno la rete.
- Le parti native (Google Sign-In con Credential Manager e App Check con Play Integrity, vedi sez. 9) stanno in `android/app/src/play/java/…` con dipendenze `playImplementation`, come già previsto dal commento in `android/app/build.gradle`.

---

## 3. Modello dati Firestore

Database `(default)`, edizione Standard, località **`eur3`** (multiregione UE, Belgio + Paesi Bassi). Le funzioni stanno in `europe-west1`, che fa parte di `eur3`.

```
users/{uid}                                   profilo                         proprietario r/w
  ├─ rides/{rideId}                           uscite                          proprietario r/w
  ├─ workouts/{workoutId}                     allenamenti personalizzati      proprietario r/w
  ├─ settings/prefs                           impostazioni (chiavi note)      proprietario r/w
  ├─ settings/games                           record, progressi, fantasmi     proprietario r/w
  ├─ settings/hr                              frequenza massima               proprietario r/w + consenso
  ├─ challenges/{YYYY-MM}                     avanzamento sfide del mese      proprietario r, server w
  ├─ medals/{medalId}                         medaglie                        proprietario r, server w
  └─ server/state, server/runs                stato anti-abuso                proprietario r, server w
boards/{boardId}                              metadati classifica             pubblico r, server w
  └─ periods/{'all' | 'YYYY-Www'}
       └─ entries/{uid}                       una riga per utente             pubblico r (a pagine), server w
challenges/{YYYY-MM}                          definizione sfide del mese      pubblico r, server w
```

Tutti i documenti scritti dal client hanno `updatedAt` = **`serverTimestamp()`**: le regole controllano `updatedAt == request.time`. Serve a due cose: la sincronizzazione incrementale ("dammi solo ciò che è cambiato da…") e niente date inventate.

### 3.1 Profilo · `users/{uid}`

| Campo | Tipo | Note |
|---|---|---|
| `displayName` | string 2–24 | soprannome, visibile in classifica. Lettere (anche accentate), cifre, spazio, `. _ -`; deve iniziare con lettera o cifra |
| `country` | string `^[A-Z]{2}$` o `null` | ISO 3166-1, facoltativo. `null` = non compare nelle classifiche per Paese |
| `locale` | `it`, `en-GB`… o `null` | lingua preferita (per email future) |
| `ageOk` | `true` | dichiarazione "ho almeno 14 anni" (età minima italiana per i servizi online) |
| `consents.terms` | `{v, at}` | versione dei Termini accettata, data |
| `consents.privacy` | `{v, at}` | versione dell'Informativa letta, data |
| `consents.hrCloud` | `{v, at, granted}` | **facoltativo**, consenso separato al battito nel cloud |
| `createdAt`, `updatedAt` | timestamp | `createdAt` non si cambia più |
| `schema` | `1` | versione del modello |

Regole sui consensi: un consenso nuovo o modificato deve avere `at == request.time` (niente retrodatazioni). `v` è la versione del testo, ad esempio la data `2026-11` scritta in cima alla bozza in `docs/legal/`. Quando i Termini cambiano in modo sostanziale, l'app confronta `consents.terms.v` con la versione corrente e chiede di nuovo.

Il profilo **non contiene l'email**: è già in Firebase Auth e così non finisce per errore in nessuna lettura.

### 3.2 Uscite · `users/{uid}/rides/{rideId}`

`rideId = String(t)`, dove `t` è l'inizio dell'uscita in millisecondi. È la stessa chiave che usa già il merge dello storico locale nel ripristino da backup (`js/app.js`, `backupIn`: `Map` per `h.t`). Due dispositivi che iniziano un'uscita nello stesso millisecondo non sono un caso reale.

| Campo | Da `rideHistory` locale | Note / limiti nelle regole |
|---|---|---|
| `t` | `t` | int ms, dal 2010 a domani; deve coincidere con l'id |
| `dur` | `dur` | 60 s – 24 h |
| `km` | `km` | 0–1500, media ≤ 80 km/h |
| `avgW`, `np`, `maxW` | idem | ≤ 1500, 1500, 3000 |
| `kj` | `kj` | ≤ 30 000 |
| `best` | `best` (`{5, 60, 300, 1200}`) | ≤ 3000 / 2500 / 1500 / 1000 W |
| `series` | `series` (array di int, una media ogni 10 s, max 720) | **compressa**: `Uint16` little-endian in base64, max 1920 caratteri (~1,9 KB invece di ~6 KB come array) |
| `seriesV` | — | versione del formato di `series` (1) |
| `src` | — | `app` (registrata ora) o `import` (da backup/vecchio storico): le uscite importate non contano per le sfide |
| `hr` | `avgHr`, `maxHr` | **solo con consenso**: `{avgHr, maxHr, series?, seriesV?}`. Fuori da `hr` il battito è vietato |
| `deleted` | — | lapide, per quando l'app avrà "elimina uscita" |
| `updatedAt` | — | `serverTimestamp()` |

Lo storico locale tiene al massimo 200 uscite (e toglie le serie alle più vecchie se lo spazio finisce). **Il cloud le tiene tutte**: in futuro si potranno caricare a pagine ("mostra uscite più vecchie").

### 3.3 Allenamenti personalizzati · `users/{uid}/workouts/{workoutId}`

L'id è quello locale (`my-…` dall'editor, `zwo-…` dall'import). Campi come in `customWorkouts`: `name` (≤ 80), `tag`, `desc`, `steps` (≤ 400 passi), `blocks` (≤ 200, dall'editor), `custom`, più `deleted` e `updatedAt`. Gli allenamenti predefiniti (`js/workouts.js`) non si salvano.

### 3.4 Impostazioni · `users/{uid}/settings/{prefs|games|hr}`

Tre documenti con la stessa forma `{values: {chiave: valore}, stamps: {chiave: ms}, updatedAt}`. I valori sono le stringhe di `localStorage`, così la conversione è banale (lo stesso approccio del backup su file).

| Documento | Chiavi | Perché separato |
|---|---|---|
| `prefs` | elenco chiuso nelle regole: `ftp`, `mass`, `weekGoal`, `autoShift`, `autoCad`, `routeRealism`, `usePm`, `coachOn`, `musicOn`, `audioMode`, `gameMuted`, `gameGlow`, `clickMap`, `videoRef`, `lang`, `units` | l'elenco chiuso impedisce di infilarci per errore dati sensibili |
| `games` | record dei giochi (`*Best`, `racer3dBest{n}`), `rfProgress`, `racer3dStage`, fantasmi dei percorsi `ghost:*` (max 150 chiavi) | si unisce con regole diverse (il migliore vince, sez. 4) |
| `hr` | solo `hrMax` | la frequenza massima è un dato sul battito: richiede il consenso come `rides.hr` |

**Non si sincronizzano mai:** `stravaConfig` (token Strava), `ride-freedom-session` (uscita in corso), `devMode`, `garminOn` (dipende dal telefono), le chiavi interne della sincronizzazione.

### 3.5 Classifiche · `boards/{boardId}/periods/{periodId}/entries/{uid}`

- `boardId`: chiave del gioco come in `games` di `js/app.js` (`horde`, `shooter`, `gruppetto`, `mattoni`, `planata`); per Turbo Pedali 3D una classifica per tappa: `racer-s0`, `racer-s1`…
- `periodId`: `all` (di sempre) oppure la settimana ISO in UTC, ad esempio `2026-W45`. La settimana cambia il lunedì alle 00:00 UTC (in Italia l'1 o le 2 di notte).
- Una riga per utente e periodo (id = `uid`), con il suo **miglior** risultato.

| Campo | Note |
|---|---|
| `uid` | serve alla cancellazione (query collection group) |
| `name` | copia di `displayName` al momento dell'invio |
| `country` | copia di `country` (o `null`) |
| `score` | punti, oppure tempo in secondi (un decimale) per le gare |
| `sortKey` | `score`, oppure `-tempo` per le gare: così si ordina **sempre** per `sortKey` decrescente e basta un solo indice |
| `stage` | solo gare |
| `at` | momento del record |

Query previste:

| Vista | Query | Indice |
|---|---|---|
| Settimana / sempre | `orderBy('sortKey','desc').limit(50)` | automatico |
| Per Paese | `where('country','==','IT').orderBy('sortKey','desc').limit(50)` | composto `country ↑, sortKey ↓` (in `firestore.indexes.json`) |
| La mia riga | `get(entries/{uid})` | — |
| La mia posizione | `where('sortKey','>', mio).count()` | automatico (aggregazione: 1 lettura ogni 1000 righe contate) |

Non serve un documento per Paese: il filtro sulla stessa collezione basta e tiene i dati in un posto solo. Se il nome cambia, le righe si aggiornano al prossimo invio (vedi dubbi aperti).

`boards/{boardId}` contiene i metadati (titolo, `lowerIsBetter`) e si crea a mano o con uno script amministrativo.

### 3.6 Sfide del mese

- `challenges/{YYYY-MM}`: `{items: [{id: 'km300', metric: 'km', target: 300}, {id: 'rides10', metric: 'rides', target: 10}]}`. Metriche: `km`, `minutes`, `rides`, `kj`. Si scrive da console o script, pubblico in lettura.
- `users/{uid}/challenges/{YYYY-MM}`: `{km, minutes, rides, kj, counted: {rideId: true}}`, calcolato **dal server** (`onRideCreated`) a ogni nuova uscita.
- `users/{uid}/medals/{YYYY-MM}-{id}`: scritta dal server quando un obiettivo viene superato.

Contano solo le uscite del mese corrente, salvate entro 2 giorni dalla fine, non importate (`src != 'import'`). Le medaglie sono personali (nessuna classifica pubblica delle sfide): il premio per barare è zero.

---

## 4. Sincronizzazione con i dati locali

Oggi tutto è in `localStorage` (vedi `js/app.js`: `rideHistory`, `customWorkouts`, impostazioni sparse, `*Best` dei giochi, `rfProgress`, `ghost:*`). La sincronizzazione (E4) aggiunge un modulo `js/sync.js` caricato solo se `accountsAvailable` e l'utente è entrato.

### 4.1 Chiavi locali nuove (non vanno nel backup su file)

| Chiave | Contenuto |
|---|---|
| `sync:uid` | uid dell'account con cui questo dispositivo è sincronizzato |
| `sync:cursor:rides`, `sync:cursor:workouts`, `sync:cursor:settings` | `updatedAt` (ms) dell'ultimo documento ricevuto |
| `sync:queue` | coda delle scritture da inviare: `[{col, id}]` (si rilegge il dato locale al momento dell'invio) |
| `sync:stamps` | `{chiave: ms}` dell'ultima modifica locale di ogni impostazione |
| `sync:tomb:workouts` | id degli allenamenti eliminati, da inviare come lapide |

`NO_BACKUP` in `js/app.js` va esteso con `^sync:`.

### 4.2 Primo accesso su un dispositivo

1. Si scaricano tutte le uscite remote a pagine di 100 (`orderBy('updatedAt').limit(100).startAfter(…)`), poi allenamenti e impostazioni.
2. **Merge per id** con i dati locali (tabella 4.4). Nessun dato locale viene tolto.
3. Ciò che c'è solo in locale va in `sync:queue` e si carica a lotti (le uscite vecchie con `src: 'import'`).
4. Si salvano i cursori e `sync:uid`.

Se `sync:uid` contiene un **altro** account (cambio di account sullo stesso telefono), l'app chiede: "Unire i dati di questo dispositivo all'account X?" Senza risposta positiva non carica nulla.

### 4.3 Uso normale

- **All'apertura** e quando torna la rete: per ogni collezione una query `where('updatedAt','>',cursore).orderBy('updatedAt').limit(100)`. Se non è cambiato nulla costa **1 lettura** per query.
- **A fine uscita**: si salva in locale come oggi, poi si accoda e si invia. Offline la coda resta in `localStorage` e parte al prossimo `online`/apertura.
- **Nessun listener in tempo reale** (`onSnapshot`): letture prevedibili e niente connessioni aperte durante l'allenamento.
- SDK consigliato: `firebase/firestore/lite` (più leggero, niente cache e listener che non ci servono, la coda la gestiamo noi). Se App Check con Lite non funzionasse bene, si passa all'SDK completo con cache in memoria (vedi dubbi).

### 4.4 Regole di merge

| Dato | Regola |
|---|---|
| Uscite | unione per `rideId`. Stesso id: vince la versione **più completa** (con `series` batte senza), a parità la più recente (`updatedAt`). Lapide `deleted: true` → si toglie in locale. In locale restano le 200 più recenti, come oggi |
| Battito di un'uscita | se il consenso c'è, si carica in `hr`; scaricando si rimette in `avgHr`/`maxHr` locali. Senza consenso si carica l'uscita **senza** `hr` e il battito locale non si tocca |
| Allenamenti | per id, vince `updatedAt` più recente. Eliminazione = lapide `deleted: true` (il documento resta, così gli altri dispositivi la ricevono) |
| `settings/prefs`, `settings/hr` | chiave per chiave: vince il timbro (`stamps`) più recente. Serve che l'app registri il timbro quando cambia un'impostazione: un piccolo `setPref(k, v)` al posto dei `localStorage.setItem` sparsi |
| `settings/games` | **vince il migliore**, non l'ultimo: `*Best` il massimo, `racer3dBest{n}` il minimo (è un tempo), `rfProgress` XP massimo + unione di obiettivi, `ghost:*` il fantasma più veloce (traccia più corta) |

---

## 5. Battito cardiaco (art. 9 GDPR)

- Consenso in `users/{uid}.consents.hrCloud = {v, at, granted: true}`, chiesto con un'opzione **spenta di default** e separata dall'accettazione dei Termini ("Salva anche il battito nel cloud").
- Le regole permettono `rides.hr` e `settings/hr` **solo** se il profilo ha `hrCloud.granted == true` (una lettura del profilo in più per quelle scritture). I campi del battito fuori da `hr` (`avgHr`, `maxHr` al primo livello) sono sempre rifiutati, perché l'elenco dei campi ammessi è chiuso.
- **Revoca**: l'utente spegne l'opzione → `granted: false`. La Cloud Function `onProfileUpdated` cancella `hr` da tutte le uscite e il documento `settings/hr`. Anche il client può farlo (le regole permettono di togliere `hr`), ma il server lo garantisce.
- Il battito non entra mai nelle classifiche né nelle sfide.

---

## 6. Cancellazione dell'account

Due strade, stesso risultato (privacy sez. 4.4 e `docs/legal/account-deletion.*`):

| Strada | Come |
|---|---|
| **Nell'app** | *Impostazioni → Account → Elimina account* → nuovo accesso (Google o password) → chiamata alla funzione `deleteAccount` |
| **Via email** | il titolare verifica l'identità e cancella l'utente dalla console Firebase (Authentication). La funzione `onAuthUserDeleted` pulisce i dati |

Cosa cancella `purgeUserData(uid)` (usata da entrambe):

1. `firestore.recursiveDelete(users/{uid})`: profilo, uscite (battito compreso), allenamenti, impostazioni, sfide, medaglie, stato anti-abuso.
2. Tutte le righe di classifica: query collection group `entries where uid == …` (indice dichiarato in `fieldOverrides`), cancellate a lotti.
3. Poi `deleteAccount` cancella l'utente da Firebase Auth.

**Perché lato server e non solo client:** il client non può cancellare le righe di classifica (le regole lo vietano apposta) e una cancellazione a metà, per rete caduta, lascerebbe dati orfani. La funzione è idempotente: si può richiamare.

`deleteAccount` richiede un accesso recente (meno di 10 minuti) e **non** richiede App Check: cancellare il proprio account deve funzionare sempre. Le regole permettono comunque al proprietario di cancellare i propri documenti (utile anche per "togli solo questa uscita").

I dati sul dispositivo non si toccano (lo dice la pagina di cancellazione); l'app, dopo la cancellazione, chiede se svuotare anche quelli locali.

---

## 7. Anti-cheat

| Livello | Cosa fa |
|---|---|
| **App Check** (sez. 9) | `submitScore` accetta solo chiamate dalla nostra app o dal nostro sito |
| **Scrittura solo server** | le regole vietano qualsiasi scrittura del client in `boards/**`, `challenges/**`, `users/*/medals`, `users/*/challenges`, `users/*/server` |
| **Validazione** (`functions/src/validate.ts`) | elenco chiuso dei giochi e dei campi; punteggio nei limiti del gioco; **ritmo** massimo di punti al minuto; tempo di gara non più corto della partita; durata minima/massima |
| **Plausibilità della potenza** | `avgW ≤ curva(durata)` (circa 2000 W per 5 s, 1000 W per 1 min, 500 W per 20 min, 450 W oltre l'ora), `avgW ≤ maxW ≤ 3000`. Le stesse soglie sono nelle regole delle uscite (`best`, `avgW`, km/h) |
| **Limiti di frequenza** | un punteggio ogni 20 s e 100 al giorno per utente (in `users/{uid}/server/state`), in transazione |
| **Doppioni** | `runId` casuale per partita: la stessa chiamata ripetuta dalla rete non conta due volte |
| **Account** | serve email verificata (o Google). `server/state.banned = true` (a mano) esclude dalle classifiche |
| **Tracce** | ogni rifiuto incrementa `server/state.rejected` e finisce nei log: chi ha molti rifiuti si controlla a mano |
| **Cosa si classifica** | punteggi dei giochi e tempi, **mai i watt assoluti** (piano sez. 5). Watt/kg eventualmente solo tra amici |
| **Istanze** | `maxInstances: 5` per funzione: un abuso non fa esplodere la bolletta |

Limite noto: chi modifica l'app (è open source) può inventare punteggi plausibili. App Check rende difficile usare un client modificato contro i nostri server, la plausibilità toglie gli assurdi, il resto si gestisce con le segnalazioni (piano sez. 5).

---

## 8. Costi e limiti

Quota gratuita giornaliera di Firestore: 50 000 letture, 20 000 scritture, 20 000 cancellazioni, 1 GiB di dati. Cloud Functions: 2 milioni di chiamate al mese gratis.

| Azione | Letture | Scritture |
|---|---|---|
| Apertura app (utente con account, nulla di nuovo) | ~4 (profilo, uscite, allenamenti, impostazioni: 1 ciascuna) | 0 |
| Fine uscita | 0 (+1 se c'è il battito: lettura del profilo nelle regole) | 1 + trigger sfide (~3) |
| Classifica (una vista) | 50 righe + 1 la mia riga + 1 posizione (`count()`) | 0 |
| Invio punteggio | ~5 (nella funzione) | 2–4 |
| Primo accesso con 200 uscite | ~200 | ~200 |

Con 1 000 utenti attivi al giorno le aperture costano ~4 000 letture: niente. Se però ognuno guardasse 5 classifiche al giorno senza cache sarebbero ~260 000 letture, oltre la quota gratuita (nell'ordine di qualche euro al mese). La classifica è la voce che pesa, per questo:

- **pagine da 50**, `limit` obbligatorio (le regole rifiutano liste senza limite o oltre 100);
- **cache locale della classifica per 5 minuti** (in `sessionStorage`), "aggiorna" esplicito;
- la posizione con **`count()`**, non scaricando le righe sopra;
- se servirà: un documento riassuntivo "top 50" per classifica, riscritto dal server a ogni record (1 lettura invece di 50). È il passo successivo, non serve al lancio.

Dimensioni: un'uscita con serie è ~2,5 KB. 1 000 utenti × 300 uscite ≈ 750 MB, dentro la quota gratuita di 1 GiB. Le classifiche settimanali vecchie si possono cancellare dopo 12 settimane con una funzione pianificata (da aggiungere quando servirà).

Indici: sono esclusi dall'indicizzazione i campi grandi che non si cercano mai (`series`, `hr`, `best`, `steps`, `blocks`, `values`, `stamps`): meno spazio e scritture più economiche.

Budget: alert a 5 €/mese (il budget avvisa, non blocca). Freni veri: `maxInstances`, limiti di frequenza, App Check.

---

## 9. App Check

| Piattaforma | Provider | Note |
|---|---|---|
| Android `play` | **Play Integrity** | l'app è una WebView Capacitor: il token si ottiene dall'SDK nativo Firebase App Check (codice nel source set `play`) e si passa al JS con un `CustomProvider` |
| Web | **reCAPTCHA Enterprise** | chiave del sito pubblica; gratis fino a 10 000 verifiche al mese |
| Sviluppo | provider di debug | token di debug registrati in console, mai nel codice |

Messa in opera: prima si attiva App Check in modalità **monitoraggio** (metriche senza blocchi), poi si **impone** su Firestore e sulle funzioni. `submitScore` ha già `enforceAppCheck: true`; `deleteAccount` no, apposta.

La build `foss` non ha App Check e non ne ha bisogno: non parla con Firebase.

---

## 10. Login (E3, per riferimento)

- **Google**: sul web `signInWithPopup`. Nell'app Android il popup non funziona (Google blocca gli accessi da WebView): serve il Google Sign-In nativo (Credential Manager) nel source set `play`, che restituisce un ID token; il JS fa `signInWithCredential(GoogleAuthProvider.credential(idToken))`.
- **Email e password**: SDK JS, con email di verifica obbligatoria prima di creare il profilo (lo chiedono le regole).
- Dopo il primo accesso: schermata profilo (soprannome, Paese facoltativo, "ho almeno 14 anni", accetto i Termini, ho letto l'Informativa, e a parte, spenta, "Salva anche il battito nel cloud"). Solo dopo si crea `users/{uid}`.
- Uscire dall'account non cancella i dati locali.

---

## 11. Cloud Functions (`functions/`)

| Funzione | Tipo | Cosa fa |
|---|---|---|
| `submitScore` | callable, App Check obbligatorio | valida, applica i limiti, scrive la riga in `all` e nella settimana ISO se migliora |
| `deleteAccount` | callable | cancella tutti i dati e l'utente Auth |
| `onAuthUserDeleted` | Auth (1ª gen.) | pulizia quando l'utente è cancellato da console |
| `onUserCreate` | Auth (1ª gen.), facoltativa | crea `users/{uid}/server/state` |
| `onProfileUpdated` | Firestore | alla revoca del consenso cancella il battito |
| `onRideCreated` | Firestore | aggiorna le sfide del mese e assegna le medaglie |

Tutte in `europe-west1`, Node 22, 256 MiB, al massimo 5 istanze. Nessun segreto: l'Admin SDK usa l'account di servizio del progetto. I trigger Auth esistono solo nella prima generazione delle funzioni; quelli "bloccanti" di seconda generazione richiederebbero Identity Platform.

Test: `cd functions && npm test` (validazione e settimana ISO, senza emulatore).

---

## 12. Test delle regole

`cd firebase && npm ci && npm test` avvia l'emulatore Firestore (serve **Java 11+**) ed esegue `test/rules.test.js` con `@firebase/rules-unit-testing`. Coprono:

- accesso negato ai dati altrui (profilo, uscite, allenamenti, documenti del server) e a chi non ha fatto l'accesso;
- profilo: campi non validi, email non verificata, consensi retrodatati, `createdAt` immutabile;
- battito: rifiutato senza consenso o con consenso revocato, rifiutato fuori da `hr`, accettato con consenso; `settings/hr` solo con consenso;
- uscite non plausibili (durata, velocità, potenze, futuro, serie troppo lunga, data falsa, id ≠ `t`);
- classifiche: lettura pubblica solo a pagine, **nessuna** scrittura o cancellazione dal client, nemmeno di una riga "valida";
- cancellazione: i propri dati sì, quelli altrui no, i documenti del server no; rimozione del battito dalle proprie uscite.

In CI li esegue `.github/workflows/rules.yml` su Ubuntu con Java 21.

---

## 13. Decisioni prese

1. Classifiche **solo via Cloud Function** (non regole che validano i campi): le regole non sanno fare limiti di frequenza, settimane ISO e "tieni il migliore" in modo affidabile.
2. Una riga per utente e periodo, con `sortKey` sempre decrescente: un solo indice composto (per Paese), niente documenti duplicati per Paese.
3. Battito isolato nel campo `hr` e nel documento `settings/hr`, controllato dalle regole sul consenso; revoca gestita dal server.
4. `rideId = String(t)`: compatibile con lo storico esistente, nessuna migrazione dei dati locali.
5. Serie compresse in base64 (`Uint16`): circa un terzo dello spazio di un array.
6. Impostazioni in tre documenti; elenco chiuso per `prefs`; record dei giochi uniti col criterio "vince il migliore".
7. Sincronizzazione a cursore su `updatedAt` (lettura incrementale), coda locale propria, nessun listener.
8. `deleteAccount` lato server, senza App Check, con accesso recente; pulizia anche quando si cancella da console.
9. Login presente solo se esiste la configurazione: `foss` non contiene né configurazione né SDK (asset del flavor `play`).
10. Test delle regole in un pacchetto separato (`firebase/package.json`): `firebase-tools` pesa e non deve rallentare `npm ci` della webapp e i test Playwright.

## 14. Dubbi aperti

1. **Località dei trigger Firestore con `eur3`.** Le funzioni sono in `europe-west1` (parte di `eur3`). Va confermato al primo deploy che i trigger `onProfileUpdated`/`onRideCreated` vengano accettati in quella regione; altrimenti il CLI indica quella giusta.
2. **Limiti dei punteggi da tarare.** `functions/src/games.ts` ha valori larghi messi a stima. Prima del lancio delle classifiche: raccogliere i punteggi veri (anche dai tester) e stringerli.
3. **WebView Android.** Google Sign-In nativo e App Check con Play Integrity richiedono codice nativo nel flavor `play` (un piccolo plugin Capacitor). È la parte più delicata di E3. Alternativa: plugin già pronti (es. `@capacitor-firebase/*`), ma andrebbero tenuti fuori dalla build `foss`, cosa non banale con `cap sync`.
4. **Firestore Lite + App Check.** Da verificare in E4; se ci sono problemi si usa l'SDK completo.
5. **Nome in classifica non aggiornato** quando l'utente cambia soprannome (si aggiorna al prossimo record). Si può aggiungere una funzione che lo propaghi; per ora non serve.
6. **Peso (`mass`)** è sincronizzato come impostazione normale. Non è un dato sanitario in senso stretto, ma qualcuno potrebbe considerarlo tale: valutare con chi rivede l'informativa se trattarlo come il battito.
7. **Moderazione dei soprannomi**: le regole bloccano caratteri strani e lunghezza, non le parolacce. Serve un elenco di parole vietate in `submitScore` o la possibilità di segnalare.
8. **Web e `authDomain`**: con il sito su un dominio diverso da `*.firebaseapp.com`, il login col popup funziona, il redirect può avere problemi con i browser che isolano i cookie di terze parti. Se il sito passa a Firebase Hosting sullo stesso dominio il problema sparisce.
9. **Classifiche settimanali vecchie**: decidere quante tenerne (proposta 12 settimane) e aggiungere la pulizia pianificata.
10. **Emulatore nell'ambiente di sviluppo cloud**: i test delle regole girano; il caricamento dei trigger Firestore nell'emulatore delle funzioni fallisce solo per il proxy dell'ambiente (chiamate locali instradate fuori). In CI e in locale non succede.
