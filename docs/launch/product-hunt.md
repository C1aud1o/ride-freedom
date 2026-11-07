# Product Hunt: bozza (G3)

> **Solo bozza, nulla è pubblicato.** Product Hunt è l'ultimo canale del piano (sez. 10, punto 7): pubblico non ciclistico, serve per backlink e badge. Limiti dalla guida ufficiale di lancio (https://www.producthunt.com/launch/preparing-for-launch): tagline **max 60 caratteri**, descrizione **max 500** secondo quella pagina; altre guide citano 260 e riportano che le due pagine ufficiali non concordano → **scrivo a 260 per stare dentro entrambe** **[DA VERIFICARE nel modulo di invio]**. La guida ufficiale dice anche che il 70% dei prodotti del giorno/settimana/mese aveva un primo commento del maker.

## Tagline (≤ 60)

Consigliata (59):
```
Free, open-source app for smart trainers with virtual gears
```
Alternative: `Smart trainer app: free, open source, no subscription` (53) · `Ride your smart trainer free, with virtual gears and games` (58)

## Descrizione (≤ 260)

```
Free, open-source app for smart trainers: 24 virtual gears, ERG workouts, GPX routes, pedal-powered 3D games and .FIT export. No account, no subscription. Web (Chrome/Edge) and Android.
```
(Conteggio: 185 caratteri, verificato.)

## Dati del modulo

| Campo | Valore |
|---|---|
| Nome | Spindro |
| Link | `https://mta-world.com/?ref=producthunt` [DA VERIFICARE: dominio definitivo, decisione A1] |
| Topics | Fitness, Open Source, Android, Sports (controllare i nomi esatti disponibili) |
| Prezzo | Free |
| Maker | tu (account PH con foto e storia vera; i bot e i gruppi "scambio upvote" vietati) |
| Galleria | 1) GIF del cambio virtuale con il rullo (F3) · 2) schermata Cambio · 3) gioco 3D · 4) ponte Garmin · 5) storico. Immagine social 1200×630 (F4). Nessun logo di terzi. |
| Video | 30 s: rullo vero + schermo (F3) |

## Primo commento del maker (pubblicato entro pochi minuti dal lancio)

```
Hi Product Hunt, I'm the maker of Spindro.

I ride indoors on a budget smart trainer and didn't want to pay a monthly subscription just to use it. So I built the app I wanted: it connects over Bluetooth, gives you 24 virtual gears (shift and the resistance really changes), ERG workouts based on your FTP, GPX routes where the grade follows the track, and a few silly 3D games where your watts are the controller. It records .FIT files for Garmin Connect/Strava, and on Android the phone can act as a power/cadence/speed sensor so your watch records the ride.

It's free, open source (GPL-3.0), has no ads, and doesn't need an account: the data stays on your phone.

What to expect, honestly:
- tested mostly on one trainer (Van Rysel D100); Tacx and old Wahoo support is written but only tested on a simulated trainer, so I need people with real ones
- Zwift Click support is experimental
- the interface is Italian only today; translations are on the way
- you need a Bluetooth trainer to really use it

What I'd love from you: tell me which trainer you have and whether it connects. There's a "report a problem" button in the app that opens a prefilled GitHub issue.

Source: https://github.com/c1aud1o/ride-freedom
Thank you for looking!
```

## Cose da non fare

- Nessun voto chiesto a gruppi o a "amici dell'amico"; la guida PH chiede feedback, non upvote.
- Non dire "alternative to Zwift" in tagline: non è il confronto che vogliamo e nome di marchio altrui.
- Non lanciare finché l'app mostrata non è almeno pubblicata su Play (link funzionante) e il repo ha README in inglese e `LICENSE` [DA VERIFICARE].
- Giorno: martedì–giovedì, lancio alle 00:01 PT (09:01 in Italia) [DA VERIFICARE nelle regole PH correnti].

## Verifica conteggio

```sh
python3 - <<'PY'
print(len("Free, open-source app for smart trainers with virtual gears"))
print(len("Free, open-source app for smart trainers: 24 virtual gears, ERG workouts, GPX routes, pedal-powered 3D games and .FIT export. No account, no subscription. Web (Chrome/Edge) and Android."))
PY
```
