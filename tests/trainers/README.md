# Test dei driver dei rulli (senza rulli veri)

```
node tests/trainers/run.mjs
```

Usa il Chromium e il Playwright già installati (`require('playwright')`), avvia un server statico sulla
cartella del progetto e apre l'app con `mock-bluetooth.js` iniettato al posto di `navigator.bluetooth`.

Profili del rullo finto (`window.__MOCK_PROFILE`):

| Profilo | Cosa emula |
|---|---|
| `fec` | Tacx con solo FE-C over BLE (servizio `6e40fec1-…`, notifiche pagine 0x10 e 0x19) |
| `tacx-both` | Tacx con FTMS e FE-C insieme (firmware recenti) |
| `wahoo` | Wahoo Kickr legacy: Cycling Power 0x2a63 + controllo `a026e005-…` con risposte `01 <op> 01` |
| `ftms` | rullo FTMS semplice, per controllare che il percorso FTMS non sia cambiato |

Il test controlla: filtri / `optionalServices` della `requestDevice`, scelta del protocollo, potenza / cadenza /
velocità mostrate, e i byte esatti dei comandi ERG, pendenza, resistenza (scritti a mano nel test a partire
dall'esempio del documento Tacx "FE-C over BLE" e dalle formule delle fonti citate in `js/trainers/*.js`).

## Da verificare con un rullo vero

**Tacx FE-C**
- Tipo di messaggio dei comandi: usiamo `0x4F` (acknowledged), come GoldenCheetah, pycycling e incyclist; il
  documento Tacx dice che il tipo "può variare". Se un modello ignora i comandi, provare `0x4E` (broadcast).
- Scrittura senza risposta su `6e40fec3` (se la caratteristica la permette), come GoldenCheetah e incyclist.
- Il nibble alto del byte 6 della pagina 0x19 (bit 2 "configurazione utente richiesta"): oggi lo mostriamo solo nel
  debug; la pagina 0x37 parte solo quando si entra in modalità Pendenza.
- Risposta alla richiesta della pagina 0x36 (capacità): se arriva, aggiorna ERG/pendenza/resistenza disponibili.
- Ricerca su Android: il plugin nativo filtra per servizi pubblicizzati; se un Tacx non pubblicizza né FE-C né
  Cycling Power nella pubblicità BLE non compare (nel browser c'è anche il filtro per nome "Tacx").
- Tacx con FTMS e FE-C: usiamo FTMS. Se un modello va male in FTMS: `localStorage.setItem('trainerProtocol', 'fec')`
  e, se confermato, aggiungerlo a `PREFER_FEC` in `js/trainers/index.js`.

**Wahoo legacy**
- Crr nel comando `0x43`: GoldenCheetah e incyclist lo scrivono ×10000, SwiftySensors e qdomyos-zwift ×1000.
  Usiamo ×10000. Con il valore sbagliato la pendenza "pesa" molto meno (o molto di più) del previsto in pianura.
- Le "indication" della caratteristica `a026e005` vanno abilitate con `startNotifications()` (Web Bluetooth lo fa),
  e lo sblocco `20 EE FC` va mandato prima di qualsiasi comando.
- Alcuni firmware (Kickr Snap secondo incyclist) non rispondono a `0x43`: aspettiamo al massimo 800 ms e proseguiamo.
- La velocità arriva solo se il rullo manda i giri ruota in 0x2a63 (circonferenza fissa 2105 mm, come per CPS).
