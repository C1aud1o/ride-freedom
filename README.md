# Ride Freedom

Webapp (PWA) per controllare dal telefono il rullo **Van Rysel D100** via Bluetooth,
leggere i dati e cambiare l'intensità con un **cambio virtuale a 24 marce** in stile Zwift Cog.

## Funzioni

- Connessione al rullo via **Bluetooth FTMS** (fallback su Cycling Power / Speed & Cadence).
- Lettura in tempo reale: potenza, cadenza, velocità, frequenza cardiaca (se trasmessa).
- Quattro modalità:
  - **Cambio** – cambio virtuale a 24 rapporti: la potenza richiesta al rullo (ERG) viene calcolata
    con un modello fisico da cadenza, marcia, pendenza e peso. Come con lo Zwift Cog, cambi rapporto
    e senti la resistenza cambiare.
  - **ERG** – potenza fissa (0–600 W, il massimo del D100).
  - **Pendenza** – simulazione pendenza FTMS (il D100 arriva a circa il 6%).
  - **Resistenza** – livello di resistenza in %.
- Cambiate con i pulsanti a schermo, con la tastiera / telecomandi Bluetooth che inviano frecce o
  pagina su/giù, oppure con lo **Zwift Click** (supporto sperimentale).
- Contatore sessione (tempo, distanza, W medi, kJ), schermo sempre acceso durante l'allenamento,
  installabile come app sulla home.
- **Registrazione in file .FIT** (formato Garmin), da importare in Garmin Connect
  (connect.garmin.com → Importa dati) e, a cascata, Strava. La sessione resta salvata nel telefono
  anche se ricarichi la pagina.
- **Giochi** (pulsante *🎮 Gioca*), grafica pixel-art, musica chiptune che segue la tua cadenza,
  le salite arrivano sul rullo come pendenza reale. Vedi [docs/giochi.md](docs/giochi.md).
  - **Turbo Pedali 3D**: tappa in linea in 3D (Three.js + modelli Kenney CC0) con 8 corridori con
    nome e carattere, 3 tappe (mare, montagna, colline), scia, monete, oggetti attivati con uno sprint
    vero, traguardo volante e GPM con maglie, profilo altimetrico, podio e record.
  - **Pedal Strike 3D**: sparatutto a scorrimento laterale in 3D con 3 eroi, 3 missioni (campagna,
    deserto, cimitero del Barone), 5 armi, prigionieri da liberare, 3 boss; i watt decidono la cadenza
    di tiro e lo sprint scatena l'OVERDRIVE.
  - **L'Orda**: sparatutto "a orde" in 3D. Si parte con una pistola contro pochi zombi, le ondate
    crescono senza fine (scheletri, fantasmi, vampiri, il Custode gigante), l'arma evolve in 10 passi
    fino al laser e i portali danno alleati che sparano con te. Più watt = più colpi.
- **Altri giochi 3D**: **Planata** (aereo a pedali, i watt sono la quota: un allenamento a intervalli
    travestito), **Gruppetto** (raccogli i ciclisti che si accodano alla tua scia; la pendenza sale con il
    gruppo), **Mattoni** (rimbalzi: la cadenza è la velocità della palla). Nei giochi si sterza tenendo
    premuto + / −.
- **Pedala su un video**: un video YouTube o un file tuo che scorre alla tua velocità.
- **Allenamenti strutturati** in ERG (sblocco, fondo, sweet spot, soglia, VO2max, piramide, 30/30)
  calcolati sulla FTP, con + / − che regolano l'intensità, e **test FTP a rampa**.
- **Percorsi GPX**: la pendenza segue il tracciato (realismo 50/75/100%), profilo e mini mappa,
  sfida al tuo record sullo stesso percorso; il .FIT contiene la traccia GPS (mappa su Strava).
- **Storico**: minuti settimanali, record 5 s / 1 / 5 / 20 min, FTP stimata, grafico di ogni uscita.
- **Cambio automatico** (solo qui): con il cambio virtuale scegli la cadenza (80–95 rpm) e l'app cambia
  marcia da sola per tenerla, come una bici con il cambio automatico; + / − restano attivi.
- **Coach vocale in italiano**: annuncia tratti e watt degli allenamenti, gli ultimi 10 secondi,
  le salite in arrivo sui percorsi, i traguardi e l'arrivo.
- **Editor di allenamenti** a blocchi ed **esportazione** di ogni allenamento in .FIT "workout" per
  Garmin (copia in GARMIN/NewFiles o tramite intervals.icu) e in .zwo; import di file .zwo.
- Avvio e pausa automatici, potenza media 3 s, schermo intero, obiettivo settimanale, zone cardio,
  backup dei dati tra dispositivi.
- **PC e Mac**: stessa webapp con Chrome o Edge (Bluetooth del computer), layout a due colonne e
  scorciatoie (frecce o + / − per le marce, Spazio avvia/pausa, G giochi). Mancano solo le funzioni
  che richiedono l'app Android: ponte Garmin e comandi musica.
- **App Android** (APK): tutto quanto sopra più il **ponte Garmin** (il telefono trasmette potenza,
  cadenza e velocità all'orologio come un sensore) e la **musica dal Click** (pressione lunga).
- **Pagina di debug** (pulsante *Debug* in alto): per ogni sensore mostra stato, servizi Bluetooth,
  valori, pacchetti grezzi e log copiabili. Per lo Zwift Click mostra i tasti premuti e permette di
  assegnarli a cambiata +/−.
- **Strava**: caricamento automatico con il tasto 🏁 *Termina*. Per tutti gli utenti ("Connetti con
  Strava" → Consenti) grazie a un piccolo ponte su Cloudflare Workers che custodisce il Client Secret:
  vedi [docs/strava.md](docs/strava.md). Senza ponte resta la modalità personale (ognuno la propria app).
- **Cardio**: fascia Bluetooth o orologio Garmin con "Trasmetti frequenza cardiaca" attivo.

## Requisiti

- **Android**: Chrome (Web Bluetooth supportato) o l'app (https://mta-world.com/app/ride-freedom.apk).
- **PC / Mac / Linux / ChromeOS**: Chrome o Edge (serve il Bluetooth nel computer o una chiavetta Bluetooth 4.0+).
- **iPhone/iPad**: Safari non supporta Web Bluetooth → usa il browser gratuito **Bluefy**.
- La pagina deve essere servita in **HTTPS** (o da `localhost`).

## Come usarla

1. Chiudi Zwift (o qualsiasi altra app collegata al rullo): il D100 accetta **una sola connessione
   Bluetooth** alla volta.
2. Apri la webapp e premi **Connetti rullo**, poi scegli il D100 dalla lista.
3. (Opzionale) **Connetti Zwift Click** per cambiare con i tasti +/−.
4. Scegli la modalità e pedala.

## Pubblicazione

Il sito è pubblicato su **https://mta-world.com** (file `CNAME`). Il workflow `.github/workflows/pages.yml`
pubblica su GitHub Pages a ogni push su `main` (o sul branch di sviluppo)
(abilita *Settings → Pages → Source: GitHub Actions*). In locale:

```sh
python3 -m http.server 8000
# poi apri http://localhost:8000 (su desktop con Chrome)
```

## Limiti noti

- Un browser non può fare da "ponte" Bluetooth verso Zwift: se la webapp è connessa al rullo, Zwift
  non può esserlo contemporaneamente. La webapp sostituisce Zwift per il controllo dell'intensità.
- Il cambio virtuale "nativo" di Zwift usa un protocollo proprietario: qui il cambio virtuale è
  implementato dalla webapp tramite comandi FTMS standard (ERG).
- Il caricamento su Garmin Connect non è automatico: l'API di upload Garmin è riservata ai partner
  approvati e richiede un server. Si carica a mano il file .FIT.
- Il supporto Zwift Click è ricostruito da progetti open source: se il firmware del Click richiede la
  cifratura i tasti potrebbero non arrivare; in quel caso usa i pulsanti a schermo.

## Crediti
- Modelli 3D: [Kenney](https://kenney.nl) — Racing Kit, Nature Kit, Blocky Characters, Graveyard Kit,
  Blaster Kit (CC0), in `assets/3d`.
- Jingle: Kenney — Music Jingles (CC0), in `assets/audio/jingles`.
- Motore 3D: [three.js](https://threejs.org) (MIT), in `vendor/three`.
