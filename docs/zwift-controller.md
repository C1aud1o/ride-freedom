# Controller Zwift: Click, Play, Ride

Codice: `js/click.js` (protocollo e mappatura), `js/clicknav.js` (navigazione col menu), `js/app.js` (collegamento e stato).
Test: `node tests/controllers/zwift-controllers.test.cjs` (Web Bluetooth finto in Playwright).

## Fonti (open source) usate per il protocollo
- ajchellew/zwiftplay — https://github.com/ajchellew/zwiftplay (UUID, handshake, messaggi Play)
- SwiftControl — https://github.com/jonasbark/swiftcontrol (Click v2, Ride, Play)
- qdomyos-zwift — https://github.com/cagnulein/qdomyos-zwift (zwiftclickremote / zwiftplayremote)

Le fonti sono state consultate a memoria, non rilette riga per riga: i punti segnati «da verificare» vanno confrontati con i sorgenti.

## Cosa è implementato
- Un solo pulsante «Click» nell'app collega tutti i modelli (filtro nome `Zwift*` oppure servizio `0xfc82`).
- Modello riconosciuto dal nome BLE (`Ride` → Zwift Ride, `Play` → Zwift Play, altrimenti Click, come prima) e corretto dal tipo di messaggio (0x07 = Play). Stato in UI: «Collegato: Zwift Click / Zwift Play / Zwift Play ×2 / Zwift Ride».
- **Due Play insieme**: dopo il primo, toccando di nuovo il pulsante l'app propone il secondo (Annulla = scollega tutto). Ogni dispositivo ha il suo stato dei tasti; `hold` e combo sono calcolati sull'unione.
- Handshake: `RideOn` in chiaro (come per il Click), notifiche su `…0002` e `…0004`.

## Mappatura predefinita
| Controller | Azione |
|---|---|
| Click v1 / v2 | invariata (v1: campi 1/2; v2: bit 12 = +, bit 8 = −) |
| Play (sx e dx) | Y/Su e A/Destra = cambio +; Z/Sinistra e B/Giù = cambio −; tasto Zwift (campo 6) = menu Click |
| Ride | tasti cambio (bit 9/10 sx, 13/14 dx) e croce Su/Giù = ±; A/Y = +, B/Z(X) = −; tasti Zwift (bit 12 e 17) = menu Click |

Il menu si apre anche con «+ e −» insieme, anche se premuti su due Play diversi. A menu aperto i tasti ± navigano (clicknav), nei giochi sono gli stessi eventi `shift`/`hold`. Le assegnazioni si cambiano dalla pagina di debug («Usa come +/−/nessuna azione»); i tasti menu invece non sono ancora riassegnabili.

## Cosa NON è implementato / da verificare su hardware reale
1. **Handshake cifrato di Play/Ride.** Alcuni firmware rispondono a `RideOn` con dati aggiuntivi (chiave pubblica) e poi cifrano i messaggi (da quanto ricordo: ECDH Curve25519 + HKDF, AES-CCM con tag da 4 byte e contatore). Senza dispositivo non si può verificare nonce, `info` HKDF e formato, quindi non è stato scritto codice di cifratura inventato. Se i controller non reagiscono, nel log di debug compare il suggerimento (messaggi 0x?? sconosciuti / «RideOn + dati»). Servirà anche AES-CCM, che WebCrypto non offre (va implementato su AES-CTR + CBC-MAC o con una libreria).
2. **Campi del messaggio Play (0x07)**: l'ordine 2=Y/Su, 3=Z/Sinistra, 4=A/Destra, 5=B/Giù, 6=Zwift, 7=Shift e il campo 1 come «lato» vanno confermati; una versione precedente del codice li etichettava diversamente (6 = leva, 7 = power). Il campo 1 non è più trattato come tasto.
3. **Quale controller è sinistro/destro**: l'app non lo distingue (i due mandano gli stessi campi); per questo i due Play hanno la stessa mappatura.
4. **Bit del Ride** (maschera 0x23): i nomi dei bit (croce, A/B/Y/Z, shift sx/dx, tasti Zwift) vengono dalla tabella già presente nel codice e da SwiftControl, non testati su un Ride.
5. Leve analogiche del Play (campi 8–9) e le «power-up» del Ride: ignorate.
6. App Android (Capacitor): il filtro per servizio `0xfc82` e la connessione a due dispositivi BLE contemporanei non sono stati provati.
