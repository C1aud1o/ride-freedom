# Piani di allenamento: principi, fonti, stato

Codice: `js/plans.js` (logica pura), `js/plans-ui.js` (scheda "Piani", card in home, promemoria). Test: `tests/plans.spec.mjs`.

## Piani gratuiti
| Piano | Durata | Uscite | Idea |
|---|---|---|---|
| Primi passi sul rullo | 3 sett. | 3 × 30–40 min | Abitudine prima dell'intensità. Test a rampa il 3° giorno e alla fine. |
| Più FTP | 6 sett. | 3–4 | Sweet spot e soglia in progressione, scarico alla sett. 4, picco alla 5, scarico + test alla 6. Test a rampa all'inizio. |
| Fondo invernale | 8 sett. | 3 | Zona 2 lunga (60→90 min) + 1 lavoro a settimana (sweet spot/tempo). Scarico alle sett. 4 e 8. |
| Ritorno in forma | 4 sett. | 3 | Ripresa graduale dopo una pausa: facile, poi un po' di fondo e un lavoro; sett. 4 di scarico e test. |

Gli allenamenti sono quelli della libreria (`sblocco`, `fondo`, `sweet`, `soglia`, `piramide`, `ramp`) più sei nuovi in % FTP: `facile` (30'), `costante` (40'), `tempo` (2×12'), `lungo60/75/90`. Nessun testo né dato copiato da altri piani: solo schemi generici.

## Principi usati
- **Progressione e sovraccarico graduale**: il carico (durata o intensità) sale poco per volta, mai entrambi insieme.
- **Scarico ogni 3–4 settimane** (meno volume/intensità per assorbire il lavoro): Più FTP (4 e 6), Fondo invernale (4 e 8), Ritorno in forma (4).
- **Distribuzione polarizzata/80-20**: la maggior parte delle uscite è facile (zona 2), una o due di qualità a settimana, mai due giorni duri di fila (giorni nella settimana: 0-2-4, 0-2-3-5, 0-2-5).
- **Test FTP all'inizio e alla fine** dove serve: il test a rampa dell'app (FTP = 75% del miglior minuto, Bergeron/Zwift-style ramp test).
- **Zone in % FTP** (Coggan): Z2 56–75%, tempo 76–90%, sweet spot 88–94%, soglia 95–105%, VO2 106–120%.
- **Recupero**: un'uscita non fatta si può recuperare entro 2 giorni; oltre è persa (niente "debito" che scoraggia).

Fonti generali (principi, non testi): Coggan & Allen, *Training and Racing with a Power Meter*; Seiler, "What is best practice for training intensity and duration distribution in endurance athletes?" (2010); Laursen & Buchheit, *Science and Application of High-Intensity Interval Training*; Mujika & Padilla sul tapering. I piani non sono consigli medici: chi ha problemi di salute chieda al medico.

## Come funziona
- Stato nel `localStorage` chiave `plan`: `{ id, start (giorno), done, skipped, moved }`. Nessun account.
- Un'uscita è **fatta** se l'allenamento giusto finisce nel suo giorno o nei 2 giorni dopo (anche spostata: conta il giorno nuovo). Si può **saltare**, **spostare a domani**, **abbandonare** il piano.
- Fine allenamento: se era in programma, spunta nella settimana in home e messaggio ("Uscita del piano fatta! 4 su 9…", "Settimana completata", "Piano completato"). Il test a rampa conta se produce un risultato.

## Promemoria
- **Android**: notifiche locali (`@capacitor/local-notifications` 7.0.7, nessun server). Una per uscita non fatta, all'ora scelta (default 18:00), fino a 60; si rifanno a ogni cambio del piano e all'avvio. Il permesso si chiede quando si inizia il piano o si attiva il promemoria; si disattiva con la casella. Nessun permesso di allarmi esatti: l'ora può slittare di qualche minuto a telefono in risparmio energetico.
- **Web**: niente push; il promemoria è la card in home.
- Dopo `npm install`: `npm run android:sync` (già fatto: modifica `android/capacitor.settings.gradle` e `capacitor.build.gradle`). Da provare su un telefono vero (non verificato qui).

## TODO
- **Sincronizzazione con l'account**: non è "semplice". `plan` e `planRemind` andrebbero in `PREF_KEYS` (`js/account/sync-core.js`) **e** nell'elenco chiuso `prefKeys()` di `firebase/firestore.rules` (con il deploy delle regole e aggiornando `docs/account-architettura.md`). Il merge per chiave è già ultimo-vince. Da fare con un compito dedicato.
- Un'icona piccola per la notifica (`ic_stat_*`); ora Android usa quella predefinita.
- Spostare a un giorno qualsiasi (ora solo "a domani", ripetibile).
