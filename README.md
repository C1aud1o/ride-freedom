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
- **Cardio**: fascia Bluetooth o orologio Garmin con "Trasmetti frequenza cardiaca" attivo.

## Requisiti

- **Android**: Chrome (Web Bluetooth supportato).
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
