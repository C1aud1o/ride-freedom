# Informativa sulla privacy di Spindro

*Ultimo aggiornamento: [DATA]*

> **BOZZA da far rivedere** (vedi `docs/legal/README.md`) prima della pubblicazione.

Spindro è un'app gratuita e open source per rulli smart. Funziona nel browser e come app Android.

Questa informativa spiega quali dati tratta Spindro, perché, per quanto tempo e quali diritti hai. Vale per l'app e per il sito di Spindro.

## 1. Chi è il titolare del trattamento

Il titolare del trattamento è una persona fisica residente in Italia:

- **Nome:** [NOME]
- **Indirizzo:** [INDIRIZZO]
- **Email di contatto:** [EMAIL CONTATTO]

Non abbiamo un responsabile della protezione dei dati (DPO): non siamo obbligati a nominarlo.

## 2. In breve

| Situazione | Che cosa succede ai tuoi dati |
|---|---|
| Usi Spindro **senza account** | Restano solo sul tuo dispositivo. Non li riceviamo. |
| Crei un **account** (facoltativo) | Salviamo i dati dell'account e quelli che scegli di sincronizzare, in Europa. |
| Vuoi salvare anche il **battito cardiaco** sul server | Serve un consenso esplicito e separato. Senza consenso il battito resta solo sul dispositivo. |
| Colleghi **Strava** | L'app invia a Strava l'allenamento, tramite un nostro server di passaggio che non lo conserva. |
| Guardi un video **YouTube** | Parte il lettore ufficiale di YouTube. Entra in gioco l'informativa di Google. |
| Errori e statistiche | Errori tecnici senza dati personali. Statistiche d'uso solo se acconsenti. |

Non vendiamo dati. Non facciamo pubblicità. Non facciamo profilazione.

Alcune funzioni (account, sincronizzazione, classifiche, segnalazione errori, statistiche) esistono solo nelle versioni dell'app che le includono. La versione "foss" (senza servizi online di Spindro) non le contiene. Dove una sezione descrive una di queste funzioni, lo dice.

## 3. Uso senza account: i dati restano sul dispositivo

Non serve registrarsi. Senza account, Spindro non ha un suo server dove mandare i tuoi dati.

### 3.1 Che cosa salva l'app sul tuo dispositivo

L'app usa la memoria locale del browser (`localStorage`) o della WebView Android. Ci sono:

- il tuo **peso** e la tua **FTP**, usati per calcolare potenza, resistenza e cambio virtuale;
- la tua **frequenza cardiaca massima**, se la imposti;
- lo **storico delle uscite** (data, durata, chilometri, potenza media, energia, battito medio e massimo, serie dei dati) e l'**uscita in corso**, che si ripristina se ricarichi la pagina;
- gli **allenamenti personalizzati** creati con l'editor;
- i **record** e i **progressi dei giochi** (punteggi migliori, esperienza, traguardi, scelte come eroe e tappa) e i **tempi migliori** sui percorsi;
- le **impostazioni** (musica, voce del coach, cambio automatico, tasti del Click, audio, obiettivo settimanale);
- l'**ultimo link YouTube** usato e la velocità di riferimento del video;
- la **configurazione di Strava**, se la attivi (vedi sezione 6).

Questi dati non vengono inviati a Spindro. Li cancelli quando vuoi: svuota i dati del sito dal browser, oppure *Impostazioni → App → Spindro → Archiviazione → Cancella dati* su Android.

Sul **backup di sistema** di Android: l'app Android permette il backup automatico del sistema. Se hai attivo il backup del telefono, Android può copiare questi dati sul tuo account Google, secondo le tue impostazioni di Android. In quel caso se ne occupa Google, non noi.

### 3.2 Bluetooth e sensori

Spindro si collega via Bluetooth al rullo, alla fascia cardio, al misuratore di potenza e allo Zwift Click. Legge potenza, cadenza, velocità e battito. Questi dati restano nel dispositivo.

La funzione "ponte verso l'orologio" (Android) trasmette per Bluetooth potenza, cadenza e velocità a un orologio vicino che li accetta come sensore. Non passa da internet.

Su Android la posizione non viene mai letta. Su Android 11 e precedenti il sistema chiede il permesso di posizione solo perché serve per cercare dispositivi Bluetooth. Spindro non usa la tua posizione. Nei percorsi virtuali le coordinate vengono dal percorso, non da te.

### 3.3 Diario e file

Il file `.FIT` di un'uscita, il backup dei dati e la scheda da condividere si creano sul tuo dispositivo. Vanno altrove solo se tu li salvi o li condividi (per esempio con Garmin Connect o con un'altra app). Il backup che esporti non contiene i dati di accesso a Strava.

### 3.4 Che cosa carica la pagina da internet

Anche senza account, la pagina web e l'app caricano:

- **I caratteri Barlow da Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`). Google riceve il tuo indirizzo IP e i dati tecnici della richiesta del browser. Vedi l'informativa di Google.
- **Nel browser, il sito stesso**, dal nostro hosting ([HOSTING]), che registra i dati tecnici standard di una richiesta (indirizzo IP, ora, pagina).

## 4. Account facoltativo

*Solo nelle versioni con account.*

L'account è facoltativo e gratuito. Nessuna funzione di base dipende dall'account. Dà comodità: backup e sincronizzazione tra dispositivi, classifiche dei giochi e sfide.

### 4.1 Quali dati

| Dato | A che cosa serve |
|---|---|
| Email, oppure account Google usato per entrare; identificativo utente | Entrare e riconoscerti |
| Nome visualizzato (scegli tu, meglio un soprannome) e, se vuoi, Paese | Mostrarti nelle classifiche |
| Storico delle uscite, record, allenamenti personalizzati, impostazioni | Backup e sincronizzazione |
| Punteggi dei giochi e tempi su percorsi | Classifiche e sfide |
| Medaglie e traguardi delle sfide | Profilo |

Il **battito cardiaco** non è in questo elenco: segue le regole della sezione 5.

Le classifiche sono visibili agli altri utenti. Mostrano il nome visualizzato, il punteggio e, se lo scegli, il Paese. Non mostrano email né altri dati del profilo. Le classifiche usano solo dati registrati da Spindro. Non usiamo mai dati letti da Strava.

Controlliamo che i punteggi siano plausibili. Se un punteggio è sospetto lo togliamo, come spiegano i Termini d'uso.

### 4.2 Base giuridica

La base è l'**esecuzione del servizio** che chiedi creando l'account (art. 6.1.b GDPR). Per i controlli anti-abuso sulle classifiche la base è il nostro **legittimo interesse** a tenere le classifiche corrette (art. 6.1.f).

### 4.3 Dove e per quanto tempo

I dati dell'account sono su **Firebase** (Google), con il database **Firestore in regione UE** (`eur3`). Firebase Authentication, che gestisce l'accesso, non permette di scegliere la regione: Google può trattare i dati di accesso anche fuori dall'UE, con le garanzie previste dal GDPR (clausole contrattuali standard o decisione di adeguatezza).

Conserviamo i dati **finché non cancelli l'account**.

### 4.4 Come cancellare l'account

- **Nell'app:** *Impostazioni → Account → Elimina account*.
- **Via email**, anche senza app: vedi la pagina "Cancellazione account" (`account-deletion`).

Cancellando l'account eliminiamo il profilo, i dati sincronizzati (battito compreso) e i tuoi punteggi nelle classifiche. I dati che hai solo sul dispositivo restano sul dispositivo, finché non li cancelli tu. Copie tecniche residue nei sistemi di Google possono restare per un breve periodo prima della rimozione definitiva.

## 5. Battito cardiaco: dato sulla salute

La frequenza cardiaca è un **dato relativo alla salute** (art. 9 GDPR). Lo trattiamo con regole più severe.

- **Sul dispositivo:** il battito che leggi dalla fascia compare nell'app e si salva nello storico locale. Non lo inviamo a nessuno.
- **Sul nostro server:** lo salviamo **solo se dai un consenso esplicito e separato**, con un'opzione dedicata ("Salva anche il battito nel cloud"). L'opzione è **spenta** all'inizio. Non è collegata all'accettazione dell'account o dei Termini.
- **Senza consenso** sincronizziamo tutto tranne il battito.
- **Base giuridica:** consenso esplicito (art. 9.2.a GDPR).
- **Revoca:** puoi toglierlo quando vuoi dall'opzione. Quando lo revochi cancelliamo il battito già salvato sul server. La revoca non cambia ciò che è avvenuto prima.
- Il battito non entra nelle classifiche.

Il consenso non è un obbligo per usare Spindro.

## 6. Strava

Spindro può caricare le tue uscite su Strava. È una funzione che attivi tu.

**Come funziona**

1. Premi "Connetti con Strava" e fai il login sul sito di Strava. Scegli tu i permessi.
2. L'app riceve da Strava un codice di accesso (token). Lo conserva **solo sul tuo dispositivo**.
3. Quando finisci un'uscita, l'app carica l'attività su Strava. Con l'opzione "Carica in automatico quando termino" l'upload parte quando premi *Termina*. Dopo il collegamento l'opzione è accesa, e puoi spegnerla. Altrimenti usi il pulsante di caricamento manuale.
4. Con "Scollega" l'app cancella i token dal dispositivo e chiede a Strava di revocare l'accesso.

**Che cosa viene inviato a Strava**

Il file `.FIT` dell'uscita (tempo, potenza, cadenza, velocità, distanza e, se avevi la fascia collegata, anche il **battito**), un titolo, una breve descrizione (tempo, potenza media, kJ, km) e un identificativo dell'uscita. Questo invio è una tua scelta: ti rivolgi a Strava e il file arriva a Strava. Il battito segue le regole di Strava, anche se non hai dato il consenso della sezione 5.

**Il nostro server di passaggio**

Per non farti inserire chiavi tecniche, nella modalità pubblica l'app usa un piccolo server su **Cloudflare Workers**. Custodisce la chiave segreta dell'app Strava e inoltra le chiamate a Strava. **Non salva nulla**: non ha un database e non conserva i file né i token. Vede i dati solo mentre passano. Come ogni servizio internet, Cloudflare può registrare dati tecnici di rete (come l'indirizzo IP).

C'è anche una **modalità personale** per chi preferisce creare la propria app su Strava: in quel caso l'app parla direttamente con Strava, senza il nostro server, e le chiavi restano sul tuo dispositivo.

**Dopo l'invio**

Una volta ricevuti, i dati sono trattati da Strava come titolare autonomo, secondo la [sua informativa](https://www.strava.com/legal/privacy). Spindro non legge le tue attività Strava per altri scopi e non le mostra ad altri utenti.

## 7. YouTube

La funzione "Pedala su un video" ti fa guardare un video che scorre alla tua velocità. Può usare il **lettore ufficiale di YouTube**.

- Il lettore e il suo script vengono caricati da `youtube.com` solo quando incolli un link YouTube e premi "Guarda". Non partono prima.
- A quel punto **Google/YouTube** riceve i dati della tua visita (come IP e identificativi) e può usare **cookie** o tecnologie simili, come descrive la [sua informativa](https://policies.google.com/privacy). Noi non li controlliamo.
- Non scarichiamo né modifichiamo i video. Cambiamo la velocità di riproduzione con le funzioni ufficiali del lettore.
- Ci ricordiamo l'ultimo link che hai usato, **solo sul tuo dispositivo**.
- Un video scelto dal tuo dispositivo si guarda in locale e non viene caricato da nessuna parte.

Se non usi questa funzione, YouTube non viene contattato.

## 8. Errori e statistiche

*Solo nelle versioni che le includono.*

### 8.1 Segnalazione degli errori (Sentry)

Quando l'app va in errore, può inviare una segnalazione tecnica a **Sentry**, con server in **UE**. Contiene il tipo di errore, la parte di codice coinvolta e informazioni tecniche generali, come versione dell'app, tipo di browser e sistema.

Configuriamo Sentry in modo che **non raccolga dati personali**: niente email, nome o identificativo dell'account, e **l'indirizzo IP non viene salvato**. Non inviamo il contenuto del tuo storico né il battito.

- **Base giuridica:** legittimo interesse a trovare e correggere errori (art. 6.1.f).
- **Conservazione:** [GIORNI DI CONSERVAZIONE SENTRY] giorni.
- Puoi opporti a questo trattamento scrivendoci (sezione 9).

### 8.2 Statistiche anonime

- **Visite al sito:** contiamo le visite con uno strumento che non usa cookie e non identifica le persone ([GOATCOUNTER O PLAUSIBLE]). Per questo non serve un banner.
- **Uso delle funzioni** (per esempio quali giochi si usano): lo misuriamo con eventi anonimi **solo se acconsenti**. La domanda compare al primo avvio. Puoi rifiutare, e puoi cambiare idea nelle impostazioni. Se rifiuti, non raccogliamo questi eventi.
- **Base giuridica:** consenso (art. 6.1.a).

Non usiamo Google Analytics né Firebase Analytics.

## 9. I tuoi diritti

Puoi chiederci in ogni momento di:

- sapere quali dati abbiamo su di te e riceverne una copia (**accesso**);
- correggere dati sbagliati (**rettifica**);
- cancellare i dati (**cancellazione**);
- limitare il trattamento;
- ricevere i dati in formato leggibile da macchina (**portabilità**);
- **opporti** ai trattamenti basati sul legittimo interesse;
- **revocare** un consenso (non cambia ciò che è avvenuto prima).

Scrivi a [EMAIL CONTATTO]. Rispondiamo entro un mese. Per sicurezza possiamo chiederti di dimostrare che l'account è tuo.

Se pensi che trattiamo i tuoi dati in modo scorretto, puoi fare reclamo al **Garante per la protezione dei dati personali** ([garanteprivacy.it](https://www.garanteprivacy.it)) o all'autorità del tuo Paese.

## 10. Età minima

Per creare un account devi avere **almeno 14 anni**. Se hai meno di 14 anni, puoi usare Spindro senza account (non raccogliamo i tuoi dati). Se scopriamo che un account è di una persona sotto i 14 anni, lo cancelliamo.

## 11. Con chi condividiamo i dati (responsabili del trattamento)

Per fornire il servizio ci appoggiamo a questi fornitori, che trattano i dati per nostro conto:

| Fornitore | Per che cosa | Dati |
|---|---|---|
| **Google** (Firebase: Authentication, Firestore) | Account, sincronizzazione, classifiche | Dati dell'account e sincronizzati; Firestore in UE |
| **Cloudflare, Inc.** | Server di passaggio per Strava (Workers) | Solo di passaggio: token e file dell'uscita, non conservati |
| **Functional Software, Inc.** (Sentry) | Segnalazione degli errori | Dati tecnici, senza dati personali; server UE |
| [HOSTING] | Hosting della pagina web | Dati tecnici di accesso |
| [GOATCOUNTER O PLAUSIBLE] | Visite al sito | Conteggi anonimi, senza cookie |

Con questi fornitori valgono i loro accordi sul trattamento dei dati (DPA). Alcuni sono aziende degli Stati Uniti: i trasferimenti avvengono con le garanzie previste dal GDPR (clausole contrattuali standard o Data Privacy Framework).

Sono invece **titolari autonomi**, e non nostri fornitori, i servizi che scegli di usare: **Strava**, **YouTube/Google** e **Google Fonts**. Si applicano le loro informative.

Non vendiamo né cediamo i tuoi dati ad altri.

## 12. Sicurezza

Usiamo connessioni cifrate (HTTPS). Le regole del database permettono a ogni utente di leggere e scrivere solo i propri dati, fuori dalle classifiche pubbliche. Nessun sistema è sicuro al 100%: se avvenisse una violazione dei dati personali che ti riguarda, ti avvisiamo come richiede la legge.

## 13. Modifiche

Se cambiamo questa informativa, aggiorniamo la data in alto. Per le modifiche importanti ti avvisiamo nell'app o sul sito. Le versioni precedenti sono nella cronologia pubblica del repository del progetto.

## 14. Contatti

[NOME] · [INDIRIZZO] · [EMAIL CONTATTO]
