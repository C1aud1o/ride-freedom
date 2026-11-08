# Q1 – Qualità della prima esperienza

## Misure (telefono 390×844, Slow 4G 1,6 Mbit/s + 150 ms, CPU 4×, mediana di 3; `node scripts/measure-startup.mjs`)
| | Prima | Dopo |
|---|---|---|
| Home pronta (testi e pulsanti disegnati) | 9,1 s | 3,4 s |
| Dati scaricati all'avvio | 1600 KB | 495 KB |
| Richieste all'avvio | 65 | 40 |
| Accessibilità Lighthouse (home) | 96 | 100 |
| Violazioni axe (home, impostazioni, giochi, allenamenti) | 2–3 per pagina | 0 |

Caricati solo all'uso: giochi + three.js (690 KB), editor allenamenti, scheda di condivisione, account (già pigro).
`history.js` resta statico: `rideStats` serve in modo sincrono a fine uscita e pesa 8 KB.

## Accesso nell'app Android
Google blocca il login Google nelle WebView: nell'app nativa il pulsante Google è nascosto e resta l'email, con una riga che spiega che Google arriverà. Login Google nativo = compito futuro (vedi `docs/account-architettura.md` §10).
