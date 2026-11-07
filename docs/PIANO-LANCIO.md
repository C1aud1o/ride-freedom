# Spindro (ex Ride Freedom): piano per il lancio al grande pubblico

> Documento di lavoro. Ogni attività in fondo (sezione 11) è scritta per essere passata così com'è a una sottosessione (Opus, Sonnet 5.5 o Haiku 5.5) o fatta sul PC con Antigravity. Le sezioni 1–10 spiegano il perché.

---

## 0. La strategia in una frase

**"L'alternativa gratuita e open source a Zwift per chi ha un rullo economico, con l'orologio come computer da bici."**

Il pubblico più facile da raggiungere non è "chi va in bici", ma chi ha **già un rullo smart da 200–400 €** (Decathlon D100/D500, Elite, Wahoo Kickr Core, Tacx, Zwift Hub, Magene, Thinkrider…) e non vuole pagare 15–20 €/mese di abbonamento. Questo pubblico:
- cerca attivamente su Google "app gratis rullo", "alternativa a Zwift", "D100 app";
- frequenta pochi posti molto concentrati (r/indoorcycling, r/Zwift, gruppi Facebook dei rulli Decathlon, forum TrainerRoad e DC Rainmaker);
- ha un problema concreto che risolviamo meglio degli altri: **l'attività finisce sull'orologio Garmin** e **il Click di Zwift funziona anche fuori da Zwift**.

Tutte le scelte qui sotto discendono da questo: prima la **compatibilità** (se il rullo non si collega l'utente se ne va in 30 secondi), poi l'**inglese**, poi la **fiducia** (open source, privacy, nessun abbonamento), infine la **diffusione** mirata, non quella generica.

---

## 1. Compatibilità: più rulli, più orologi

### Situazione attuale
| Protocollo | Stato | Copre |
|---|---|---|
| FTMS (0x1826) con controllo ERG/pendenza | ✅ | Quasi tutti i rulli dal 2020: Van Rysel D100/D500, Wahoo Kickr (firmware recente), Elite (Suito, Direto, Justo), Zwift Hub, JetBlack, Magene, Thinkrider, Saris H3/H4… |
| Tacx FE-C over BLE (`6e40fec1-…`) con ERG/pendenza/resistenza | 🧪 scritto e provato con rullo simulato, da provare su un Tacx vero | Tacx Flux, Vortex, Bushido, Genius, Neo, Flow smart (anche senza FTMS) |
| Wahoo legacy (`a026e005` in Cycling Power) con ERG/pendenza/resistenza | 🧪 scritto e provato con rullo simulato, da provare su un Wahoo vero | Kickr / Snap / Core con firmware pre-FTMS |
| Cycling Power (0x1818) / CSC (0x1816) | ✅ solo lettura | Rulli "dumb" con sensore, misuratori di potenza |
| Heart Rate (0x180d) | ✅ | Fasce cardio, orologi in modalità "trasmetti battito" |
| Zwift Click | ✅ | |
| Ponte verso l'orologio (l'app trasmette come sensore di potenza/cadenza/velocità) | ✅ Android | Garmin, e in teoria Wahoo Elemnt, Coros, Suunto, Polar, Apple Watch (watchOS 10+ accetta sensori di potenza BLE) |

### Cosa manca, in ordine di utenti guadagnati per ora di lavoro
1. **Tacx FE-C over BLE** (servizio `6e40fec1-b5a3-f393-e0a9-e50e24dcca9e`): i Tacx (Flux, Vortex, Neo, Flow smart) sono tra i rulli più venduti in Europa e molti modelli più vecchi **non hanno FTMS** o lo hanno solo con firmware nuovi. Il protocollo è documentato pubblicamente da Garmin ("Tacx Trainer Communication"). **Priorità massima.**
2. **Wahoo legacy** (caratteristica di controllo `a026e005` dentro Cycling Power): Kickr/Snap/Core con firmware precedenti al 2020. Priorità media.
3. **Zwift Ride / Zwift Play** (stesso protocollo del Click, più tasti): si aggiunge con poco, e porta gli utenti Zwift Hub.
4. **Cadenza da sensore separato** (CSC) quando il rullo non la dà: già quasi pronto.
5. **ANT+**: no. Nel browser non esiste, su Android pochi telefoni hanno la radio ANT. Non vale il costo.
6. **iPhone**: Safari non ha Web Bluetooth. La via è un'app iOS con Capacitor (lo stesso codice + il plugin BLE già usato su Android). **Rimandata a dopo il lancio Android**: serve un Mac/servizio di build e l'account Apple (99 $/anno). Nel frattempo su iPhone si può suggerire il browser "Bluefy" che supporta Web Bluetooth.

### La mossa più importante: la lista di compatibilità fatta dagli utenti
Non possiamo comprare 30 rulli per provarli. Invece:
- il pannello di debug attuale diventa **"Segnala il tuo rullo"**: un pulsante raccoglie in modo anonimo nome del modello, servizi BLE visti, protocollo usato, se ERG/pendenza funzionano;
- la segnalazione apre una **issue GitHub precompilata** (zero server, zero dati personali) oppure, per chi ha l'account, viene salvata nel database;
- dalle segnalazioni nasce la pagina pubblica **"Rulli e orologi compatibili"**, che è anche ottima per Google (chi cerca "Magene T300 app gratis" trova noi).

---

## 2. Lingue

**Ordine consigliato:** inglese (obbligatorio, sarà la lingua base del codice) → italiano (già c'è) → francese, spagnolo, tedesco (i Paesi dove Decathlon vende di più i rulli Van Rysel e dove il ciclismo indoor è forte) → olandese, portoghese, polacco (dopo, se arrivano utenti).

**Come:**
- un modulo `js/i18n.js` minuscolo, senza librerie: file `locales/en.json`, `it.json`… con chiavi tipo `settings.title`; la lingua si sceglie da sola dal telefono e si cambia nelle impostazioni;
- **estrazione delle stringhe** (centinaia, in `index.html`, `app.js`, giochi, coach vocale): lavoro meccanico ma delicato → Sonnet;
- **traduzione dei JSON**: Haiku, a blocchi, con un glossario fisso (FTP, ERG, cadenza, marcia…) per non avere tre traduzioni diverse dello stesso termine;
- **coach vocale**: la voce di sistema segue la lingua scelta (oggi è fissa in italiano);
- **revisione**: per FR/ES/DE si chiede a 1–2 utenti madrelingua nella community (fa anche coinvolgimento). Crowdin/Weblate gratuiti per progetti open source se i traduttori volontari aumentano.

---

## 3. Pronta per la produzione

### Debug: nascondere, non buttare
Il debug ci serve per supportare rulli nuovi. Quindi:
- pannello debug, log, prove audio A/B, diagnostica Garmin → **"Modalità sviluppatore"**, che si attiva toccando 7 volte il numero di versione (come in Android);
- per l'utente normale resta solo **"Segnala un problema / il tuo rullo"** (vedi sez. 1);
- via i `console.log` rumorosi, via i testi tecnici dalle schermate normali, via le funzioni sperimentali non finite.

### App Android
- oggi pubblichiamo un **APK debug**: per il Play Store servono un **AAB firmato in release** (chiave di firma conservata nei Secret di GitHub, mai nel repo) e la **firma dell'app gestita da Google Play**;
- `versionCode` automatico dal numero della build;
- due varianti dallo stesso codice:
  - **`foss`**: senza Firebase né servizi Google → APK su GitHub e su **F-Droid / IzzyOnDroid** (pubblico open source molto fedele);
  - **`play`**: con account opzionale (sez. 5).
- permessi ridotti al minimo e spiegati (Bluetooth, posizione solo dove Android la impone per il BLE vecchio).

### Web app
- build con file minimizzati e con il numero di versione nei nomi, così la cache non serve file vecchi; oggi il service worker fa già da cache offline;
- Lighthouse ≥ 90 su prestazioni e accessibilità; giochi 3D caricati solo quando servono;
- pagina iniziale "vetrina" (sito) separata dall'app vera (`/app`), così chi arriva da Google capisce cos'è prima di vedere schermate tecniche.

### Qualità
- test automatici Playwright (ne abbiamo già molti nello scratchpad: vanno messi nel repo) eseguiti da GitHub Actions a ogni push;
- un "rullo finto" nei test, che risponde come un FTMS, per non rompere il collegamento quando si cambia codice.

---

## 4. Infrastruttura: GitHub Pages o Firebase?

**Consiglio: ibrido.**
| Pezzo | Dove | Perché |
|---|---|---|
| Web app e sito | **Firebase Hosting** (o restare su GitHub Pages) | Firebase ha CDN, anteprime per ogni modifica, e sta insieme ad account e database. GitHub Pages va benissimo e costa 0: si sposta solo quando servono gli account. |
| APK da scaricare | **GitHub Releases** | Banda gratuita e illimitata. Firebase Hosting gratuito ha un limite di circa 360 MB/giorno, cioè poche decine di download di APK. |
| Account | **Firebase Authentication** (Google, email, Apple più avanti) | Lo conosci già, gratuito fino a 50.000 utenti attivi al mese. |
| Dati utenti, classifiche | **Firestore, regione europea** (`eur3`) | GDPR: i dati restano in UE. |
| Upload su Strava | Cloudflare Worker già scritto, oppure una Cloud Function | Il Worker è gratuito e già pronto: va solo pubblicato. |
| Protezione abusi | **Firebase App Check** + regole Firestore severe | Impedisce di scrivere in classifica senza la nostra app. |

Piano Firebase: **Blaze (a consumo) con budget alert a 5 €/mese**. Con poche migliaia di utenti il costo previsto è circa 0 €. Lo Spark gratuito blocca le Cloud Functions.

---

## 5. Utenti registrati: cosa offrire (tutto gratis)

Principio: **senza account l'app è completa**. L'account dà comodità e un po' di gioco sociale, mai funzioni bloccate. È anche quello che la community open source accetta senza polemiche.

Con l'account, in ordine di valore percepito:
1. **Backup e sincronizzazione**: storico, record, allenamenti creati con l'editor, impostazioni, tra telefono e PC. È la cosa che la gente chiede davvero, perché oggi cambiando telefono perdi tutto.
2. **Classifiche dei giochi**: settimanali e di sempre, per gioco e per Paese. Sono il motore della ricorrenza ("torno a battere il record").
3. **Sfide del mese**: "300 km a novembre", "10 ripetute", con medaglie nel profilo.
4. **Gruppi / amici**: classifica tra amici o del proprio club. Viene dopo, se le classifiche funzionano.
5. **Strava automatico**: ogni uscita caricata da sola, senza dover configurare Client ID e Secret (lo fa il nostro server).

**Attenzione alle classifiche:** i watt si possono falsificare. Per questo:
- classifiche sui **punteggi dei giochi** e su **km/tempo**, non sui watt assoluti;
- watt/kg solo "tra amici";
- controlli di plausibilità lato server (es. niente 1500 W per 20 minuti);
- App Check;
- segnalazione dei punteggi sospetti.

**Strava:** dal novembre 2024 le regole API di Strava vietano di mostrare i dati di un utente ad altri. Quindi **le classifiche usano solo dati registrati dalla nostra app**, mai dati letti da Strava. Noi su Strava scriviamo soltanto, e questo è permesso.

---

## 6. Monitoraggio

| Cosa | Strumento | Costo | Note privacy |
|---|---|---|---|
| Errori JavaScript e crash | **Sentry** (server in UE) | Gratis fino a 5.000 errori/mese | Senza dati personali, IP non salvato. Legittimo interesse, da dichiarare nella privacy. |
| Visite al sito e installazioni web | **GoatCounter** o Plausible, senza cookie | GoatCounter gratis | Nessun banner cookie necessario (linee guida Garante 2021 per statistiche anonime). |
| Uso delle funzioni (quali giochi, quali rulli) | Eventi anonimi minimi, solo **con consenso** | 0 | Domanda chiara al primo avvio, rifiutabile. |
| App Android | Play Console "Android vitals" | 0 | Già incluso. |
| Costi Firebase | Budget alert | 0 | |

**Niente Google Analytics/Firebase Analytics per ora**: richiede banner di consenso, pesa, e per un progetto open source è una macchia ("ti tracciano").

---

## 7. Parte legale

**Nota:** questa è un'analisi per decidere, non una consulenza legale. Per i testi finali di privacy e termini conviene una revisione di un professionista o di un servizio come iubenda (~30 €/anno).

### Copyright e marchi
| Tema | Rischio | Cosa fare |
|---|---|---|
| **Colori simili a Nike (giallo "volt" su nero)** | **Molto basso.** Un colore da solo non è protetto dal diritto d'autore. Lo sarebbe solo come marchio registrato e solo se crea confusione con prodotti simili. Il giallo fluo su nero è usatissimo nello sport (Garmin, Wahoo, Strava usano palette vicine). | Va bene così. Basta non usare loghi o "swoosh", nomi Nike, il font Futura Condensed tipico delle loro campagne. Noi usiamo Barlow, licenza libera OFL. |
| **Nomi di terzi** (Zwift Click, Garmin, Van Rysel, Strava, Tacx, Wahoo) | Basso se usati per dire "compatibile con" | Solo testo, mai i loro loghi (tranne il badge ufficiale "Compatible with Strava", obbligatorio secondo le loro linee guida), frase "marchi dei rispettivi proprietari, nessuna affiliazione". |
| **Nome "Ride Freedom"** | Da verificare | Ricerca su EUIPO/TMview e sul Play Store prima di stampare grafiche. Se c'è un conflitto si cambia **prima** del lancio, non dopo. Serve anche un dominio dedicato (es. `ridefreedom.app`), perché `mta-world.com` non c'entra col nome. |
| **Asset grafici** | Basso | Kenney CC0: OK, crediti già presenti. Three.js MIT, Barlow OFL, plugin Capacitor MIT: vanno elencati in una pagina "Licenze" nell'app. |
| **Giochi** | Basso | Sono originali; nessun nome o personaggio copiato da giochi esistenti. Da mantenere così. |
| **Video YouTube** | Basso | Usiamo il player ufficiale (consentito dai Termini API di YouTube). Non scarichiamo e non modifichiamo i video. La velocità di riproduzione si cambia con l'API ufficiale. |
| **FIT SDK Garmin** | Basso | Il nostro codice scrive il formato FIT da zero (la specifica è pubblica e gratuita). L'SDK l'abbiamo usato solo nei test. |

### GDPR e privacy
- **Senza account**: tutto resta sul dispositivo → obblighi minimi (informativa semplice).
- **Con account**: noi siamo **titolari del trattamento**. Servono:
  - **informativa privacy** (IT + EN);
  - **termini d'uso**;
  - accettazione del DPA di Firebase e Sentry nelle loro console;
  - dati in UE.
- **Il battito cardiaco è un dato sanitario** (art. 9 GDPR): per salvarlo sul server serve un **consenso esplicito e separato** ("salva anche il battito nel cloud"). Senza consenso si sincronizza tutto tranne il battito. È la scelta più sicura e costa poco.
- **Cancellazione account**: richiesta da GDPR **e da Google Play**. Pulsante nell'app + pagina web per chiederla anche senza app.
- **Età minima**: 14 anni in Italia per il consenso ai servizi online.
- **Play Store**: modulo "Sicurezza dei dati" compilato in modo coerente con l'informativa.
- **Cookie**: con le scelte della sez. 6 non serve un banner. Serve solo la domanda di consenso alle statistiche d'uso.

---

## 8. Open source + versione Play: si può? Sì, ed è la scelta giusta

**Modello consigliato: tutto il codice dell'app è open source, anche la parte login.** La "versione Play" non ha codice segreto: ha in più **il servizio** (il nostro progetto Firebase), che non si può copiare.
- Chi scarica dal repo o da F-Droid ha la variante `foss`: tutto tranne account e classifiche.
- Chi installa dal Play Store ha anche account e classifiche gratuiti.
- Un fork può attivare gli account solo creando il **proprio** Firebase: va benissimo.

Così evitiamo i due problemi classici:
- niente "open core" con parti chiuse, che scontenta i contributori;
- niente CLA da far firmare, perché non dobbiamo rilicenziare nulla.

**Licenza: GPL-3.0.** Chiunque può usarla, modificarla e redistribuirla, ma chi la ridistribuisce modificata deve restare open source. Nessun concorrente può prenderla, chiuderla e venderla. È compatibile con F-Droid. In alternativa la MIT, più permissiva, permetterebbe a chiunque di chiuderla: per un'app consumer la GPL protegge meglio il lavoro. I contributi si accettano con **DCO** (la riga "Signed-off-by" nel commit), senza burocrazia.

**Prima di rendere pubblico il repo** (attività dedicata in sez. 11):
- controllare tutta la storia git per segreti (chiavi, token, Client Secret Strava) con `gitleaks`. Se se ne trovano: si revocano, e si parte con una storia git pulita;
- passare codice, commenti, README, documentazione in **inglese**;
- aggiungere `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, template per issue ("il mio rullo non funziona", "bug", "idea"), etichette "good first issue";
- README con GIF, link alla web app, all'APK, a F-Droid, e la tabella dei rulli compatibili;
- dominio e nome definitivi già decisi.

---

## 9. Play Store: il collo di bottiglia è il calendario

Un **account sviluppatore personale nuovo** (25 $ una tantum) deve fare un **test chiuso con almeno 12 tester per 14 giorni di fila** prima di poter pubblicare. Un account **organizzazione** (serve una partita IVA e un numero D-U-N-S) ne è esente, ma per un progetto personale non vale la pena.

**Conseguenza pratica: il test chiuso va avviato SUBITO**, con l'app attuale ripulita, mentre il resto (lingue, account) si sviluppa in parallelo. Gli aggiornamenti successivi non richiedono un nuovo test. I 12 tester vanno trovati tra amici, compagni di uscite e gruppi di ciclismo: sono anche i primi a dare feedback. Bisogna chiedere loro di aprire l'app qualche volta nei 14 giorni, perché sembra che Google controlli anche l'uso.

Scheda dello store:
- titolo con parole chiave ("Ride Freedom: Smart Trainer & Zwift Click");
- 8 screenshot con didascalie;
- immagine in evidenza 1024×500;
- video di 30 s;
- descrizione in IT/EN/FR/ES/DE;
- categoria Salute e fitness.

---

## 10. Diffusione con 100 € di budget

### Principio
Con 100 € la pubblicità generica non sposta nulla: un'installazione da Google Ads per app fitness costa 1–3 €, quindi 30–100 utenti, molti dei quali senza rullo. **Il budget vero è il tempo**: contenuti mirati dove il nostro pubblico è già riunito. Gli annunci a pagamento si usano solo alla fine, solo su ricerche a **intenzione altissima** e solo dopo aver visto cosa converte gratis.

### Ordine di lancio (dopo che sono pronti inglese, sito e Play Store)
1. **Prima di tutto, gli elenchi gratuiti e permanenti**, che portano utenti per anni:
   - **AlternativeTo** (come alternativa a Zwift, MyWhoosh, Rouvy, TrainerRoad): molto letto da chi cerca app gratuite;
   - F-Droid / IzzyOnDroid;
   - GitHub topics (`zwift-alternative`, `smart-trainer`, `ftms`, `web-bluetooth`);
   - la pagina "Rulli compatibili" del sito.
2. **Reddit**: è il canale con il miglior rapporto risultato/sforzo per noi. Un post diverso per ogni comunità, ognuno con l'angolo giusto, distanziati di qualche giorno:
   - **r/indoorcycling** (il più importante): "Ho fatto un'app gratis e open source per rulli economici";
   - **r/Garmin**: "Usa il tuo Garmin come computer per il rullo, l'attività finisce su Connect";
   - **r/Zwift**: "Il Click funziona anche fuori da Zwift", con tono rispettoso. Leggere prima le regole: alcuni sub vietano l'autopromozione;
   - **r/cycling**, **r/bikecommuting** (inverno = rullo);
   - **r/opensource**, **r/androidapps**, **r/webdev** e **r/threejs** (per i giochi 3D: lì si trovano i contributori);
   - in Italia **r/Italia** no, meglio i gruppi di ciclismo.
3. **Show HN su Hacker News**: "Web Bluetooth + Three.js: un'alternativa open source a Zwift che gira nel browser". Pubblico tecnico, porta stelle su GitHub e contributori.
4. **Comunità ciclistiche**:
   - gruppi Facebook dei possessori di D100/D500 e dei rulli economici, in Italia e in Francia;
   - forum TrainerRoad;
   - bdc-forum.it;
   - commenti utili (non spam) sotto le recensioni YouTube del D100.
5. **Creator**: una mail breve e personale con APK, link e GIF a chi recensisce rulli (GPLama, Shane Miller, DC Rainmaker, canali italiani di bici). Basta che uno ne parli per valere più di tutto il budget.
6. **Blog**:
   - un articolo tecnico su dev.to/Medium ("Come ho fatto parlare il browser con un rullo FTMS");
   - un articolo per ciclisti ("Allenarsi sul rullo senza abbonamento").

   Li si linka nei post Reddit e restano su Google.
7. **Product Hunt**: un giorno di lancio. Utile per il badge e i backlink, ma il pubblico non è ciclistico: va in fondo.

### I 100 € (solo dopo 2–4 settimane di lancio organico)
- **~60 € Google Ads sulla Ricerca, non App Campaign**: parole chiave lunghe e precise come "app gratis rullo d100", "alternativa zwift gratis", "free zwift alternative", "zwift click without zwift", in IT/EN/FR. Poche ricerche, ma chi cerca questo è esattamente il nostro utente e il costo per click è basso. Annuncio verso la pagina del sito nella sua lingua.
- **~40 € Reddit Ads**, mirati alle comunità r/indoorcycling, r/Zwift, r/Garmin. Si promuove il post organico che è andato meglio, non un annuncio nuovo.
- **Regola di stop**: se dopo 20 € un canale non porta installazioni a meno di 1 € l'una, si sposta tutto sull'altro.
- Misura: link con `?ref=` diversi per canale e conteggio con GoatCounter, così sappiamo cosa ha funzionato senza tracciare le persone.

### Cosa fa crescere davvero dopo il lancio
- la **scheda condivisibile** di fine uscita (già fatta): ogni condivisione su Instagram/Strava è pubblicità gratuita, va aggiunto il link all'app nell'immagine;
- le **sfide del mese** con classifica: danno un motivo per tornare e invitare amici;
- rispondere a ogni issue "il mio rullo non va" entro pochi giorni: chi si sente ascoltato ne parla.

---

## 11. Attività

Legenda modelli:
- **Opus**: architettura, Bluetooth, sicurezza, decisioni delicate;
- **Sonnet 5.5**: implementazione standard, refactoring, documenti;
- **Haiku 5.5**: traduzioni, testi, controlli meccanici;
- **PC/Antigravity**: grafica. Con il piano Pro, usare Carbon solo per le immagini finali, non per tentativi.

**Tu** = cose che può fare solo il proprietario (account, pagamenti, firme).

Regola per ogni sottosessione: lavorare su un **branch proprio**, leggere prima questo file, aprire una PR, non toccare cose fuori dal compito, test Playwright verdi prima della PR.

### Fase A: Fondamenta (settimana 1) · si parte subito
| ID | Attività | Chi | Dipende da |
|---|---|---|---|
| A1 | Decidere nome definitivo + verificare marchio (EUIPO/TMview, Play Store) + comprare dominio | **Tu** (Haiku può preparare la ricerca) | — |
| A2 | Creare account Google Play sviluppatore (personale) | **Tu** | — |
| A3 | **Modalità sviluppatore**: spostare debug, log, test audio, diagnostica dietro "7 tocchi sulla versione"; togliere testi tecnici dalle schermate normali; eliminare `console.log` superflui | Sonnet | — |
| A4 | **Build release Android**: chiave di firma nei Secret GitHub, AAB + APK firmati, `versionCode` automatico, varianti `foss`/`play` (per ora identiche) | Opus | — |
| A5 | Portare i test Playwright nel repo (`tests/`), con server locale e "rullo FTMS finto"; workflow CI su ogni push | Sonnet | — |
| A6 | Caricare l'AAB nel **test chiuso** e invitare 12 tester. **Avvia il conto dei 14 giorni** | **Tu** + A4 | A2, A4 |
| A7 | Scansione segreti su tutta la storia git (`gitleaks`), elenco e piano di pulizia | Sonnet | — |

### Fase B: Compatibilità (settimane 1–3)
| ID | Attività | Chi | Dipende da |
|---|---|---|---|
| B1 | **Tacx FE-C over BLE**: lettura dati + controllo ERG/pendenza (pagine ANT FE-C 0x10, 0x19, 0x30, 0x31, 0x33 nel tunnel BLE), stessa interfaccia di `ftms.js`; test col rullo finto | Opus | A5 |
| B2 | **Wahoo legacy** (controllo via caratteristica `a026e005` in Cycling Power) | Opus | B1 |
| B3 | **Zwift Ride/Play**: tasti aggiuntivi oltre al Click | Sonnet | — |
| B4 | **"Segnala il tuo rullo"**: raccolta anonima (modello, servizi, protocollo, ERG ok?) → issue GitHub precompilata; template issue "compatibilità" | Sonnet | A3 |
| B5 | Pagina **"Rulli e orologi compatibili"** (tabella generata da un file JSON nel repo) | Haiku | B4 |
| B6 | Verificare e documentare il ponte verso orologi non Garmin (Wahoo Elemnt, Coros, Suunto, Polar, Apple Watch): guida per ognuno in `watchguide.js` | Sonnet | — |

### Fase C: Lingue e inglese (settimane 2–3)
| ID | Attività | Chi | Dipende da |
|---|---|---|---|
| C1 | Modulo `js/i18n.js` + estrazione di tutte le stringhe (HTML, JS, giochi, coach) in `locales/it.json`; scelta automatica della lingua + selettore | Sonnet | A3 |
| C2 | `locales/en.json` + glossario fisso dei termini | Sonnet | C1 |
| C3 | `fr.json`, `es.json`, `de.json` dal glossario (una sottosessione per lingua, in parallelo) | Haiku ×3 | C2 |
| C4 | Coach vocale e voce di sistema nella lingua scelta; formati numeri e date per lingua | Sonnet | C1 |
| C5 | **Repo in inglese**: commenti nel codice, README, docs, messaggi di commit futuri | Sonnet (codice), Haiku (docs) | C1 |

### Fase D: Produzione e legale (settimane 3–4)
| ID | Attività | Chi | Dipende da |
|---|---|---|---|
| D1 | Sentry (UE) su web e app, senza dati personali; GoatCounter sul sito | Sonnet | A3 |
| D2 | Consenso al primo avvio (statistiche anonime sì/no) | Sonnet | D1 |
| D3 | Bozze: **Privacy policy**, **Termini**, pagina **Licenze e crediti**, nota marchi ("nessuna affiliazione") in IT/EN | Sonnet (bozza) → **Tu** (revisione o iubenda) | — |
| D4 | Pagine web: sito vetrina multilingua (home, compatibilità, privacy, cancellazione account, download) separato da `/app` | Sonnet | C2, D3 |
| D5 | Lighthouse ≥ 90, caricamento pigro dei giochi, minimizzazione file | Sonnet | — |
| D6 | Repo pubblico: `LICENSE` (GPL-3.0), `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, template issue/PR, DCO, etichette | Haiku | A7, C5 |

### Fase E: Account e classifiche (settimane 4–6, solo variante `play` e web)
| ID | Attività | Chi | Dipende da |
|---|---|---|---|
| E1 | Progetto Firebase (regione `eur3`), piano Blaze con budget alert 5 €, App Check, DPA accettati | **Tu** + Opus (istruzioni) | — |
| E2 | Architettura e **regole di sicurezza Firestore** (dati per utente, classifiche, limiti, controlli di plausibilità) | Opus | E1 |
| E3 | Login facoltativo (Google + email), profilo, **cancellazione account** in-app e via web | Sonnet | E2 |
| E4 | Sincronizzazione storico/allenamenti/impostazioni; battito solo con consenso separato | Sonnet | E3 |
| E5 | Classifiche dei giochi (settimana/sempre/Paese) + sfide del mese | Sonnet | E2 |
| E6 | Strava automatico tramite il nostro server (Worker o Cloud Function) | Opus | E3 |

### Fase F: Asset grafici (in parallelo da settimana 2) · PC con Antigravity
| ID | Attività | Chi |
|---|---|---|
| F1 | Icona definitiva + immagine in evidenza Play 1024×500 | PC/Antigravity (Carbon solo per la versione finale) |
| F2 | 8 screenshot Play con didascalie, per lingua: generati da Playwright con dati finti (Sonnet), cornici e testi aggiunti su PC | Sonnet + PC |
| F3 | GIF/video 30 s per README, Reddit, Play (registrazione schermo vera del gioco + rullo) | **Tu** (girato) + PC (montaggio) |
| F4 | Immagine social 1200×630 per i link condivisi | PC/Antigravity |

### Fase G: Lancio (dopo i 14 giorni di test chiuso + C + D)
| ID | Attività | Chi |
|---|---|---|
| G1 | Testi della scheda Play Store in 5 lingue (titolo, breve, lunga, novità) | Haiku |
| G2 | Inserimenti: AlternativeTo, F-Droid/IzzyOnDroid, GitHub topics | Haiku (testi) + **Tu** (invio) |
| G3 | Bozze dei post Reddit (uno per comunità, angolo diverso, rispettando le regole del sub), Show HN, Product Hunt | Sonnet |
| G4 | Articolo tecnico (dev.to) + articolo per ciclisti (IT/EN) | Sonnet |
| G5 | Mail ai creator (breve, personale, con GIF e link) | Haiku (bozze) + **Tu** (invio) |
| G6 | Calendario di uscita dei post (1–2 a settimana) e link `?ref=` per canale | Haiku |
| G7 | Dopo 2–4 settimane: 60 € Google Ads Ricerca + 40 € Reddit Ads con regola di stop | **Tu** (Sonnet prepara parole chiave e annunci) |

---

## 12. Decisioni da prendere

Ognuna con la mia raccomandazione:
1. **Nome e dominio**: tenere "Ride Freedom" se libero → comprare `ridefreedom.app` o simile.
2. **Licenza**: GPL-3.0.
3. **Account Play**: personale, con i 12 tester.
4. **Hosting**: restare su GitHub Pages fino alla fase E, poi Firebase Hosting; APK sempre su GitHub Releases.
5. **iPhone**: dopo il lancio Android, se i numeri lo giustificano.
6. **Primo obiettivo misurabile**: 500 utenti attivi al mese e 100 stelle su GitHub entro 3 mesi dal lancio.
