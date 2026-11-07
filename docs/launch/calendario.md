# Calendario di uscita su 6 settimane (G6)

> **Solo piano, nulla è programmato.** Le date sono un **esempio** con partenza **lunedì 16 novembre 2026** (7 novembre 2026 è sabato). Il vero "giorno 0" è quando valgono *tutte* le condizioni di partenza qui sotto; sposta tutto di conseguenza.

## Condizioni di partenza (non lanciare prima)

1. Test chiuso Play concluso (12 tester × 14 giorni) e app pubblicata, o almeno APK stabile su GitHub Releases (piano, sez. 9).
2. `README` in inglese, `LICENSE` GPL-3.0 nel repo, template issue "il mio rullo non funziona" (oggi mancano: D6 del piano).
3. Una GIF/video di 15–30 s con il rullo vero (F3) e le immagini social (F4).
4. **Contatore delle visite per canale**: GoatCounter (D1) sul sito. Oggi nel codice non c'è `goatcounter` **[DA VERIFICARE]**: senza di esso i link `?ref=` non producono dati. GoatCounter registra come referrer il parametro `?ref=` **[DA VERIFICARE nella documentazione di GoatCounter]**.
5. Interfaccia in inglese (C1–C2): l'app è solo in italiano oggi. **Per i canali in inglese, la settimana 1 è bloccata finché non c'è.** Se non è pronta: partire con i soli canali italiani (blog IT, gruppi Facebook, creator italiani, bdc-forum.it) e rinviare Reddit/HN.

## Ordine e motivazione

L'ordine segue una logica: **prima ciò che dura e costa zero → poi il pubblico che perdona di più e che dà feedback tecnico → poi i canali che amplificano → infine quelli dove un solo giorno decide tutto.**

| Sett. | Giorno | Canale | Perché in questo punto |
|---|---|---|---|
| **1** | Lun 16 | **Elenchi permanenti**: GitHub topics + AlternativeTo (+ richiesta IzzyOnDroid se i requisiti sono ok) | Lavorano per anni, nessun rischio, il repo si presenta bene prima del traffico. |
| 1 | Mar 17 | **r/indoorcycling** | Il pubblico più importante e più pertinente (piano, sez. 10). Il primo post serve soprattutto a trovare i bug di compatibilità: meglio con poco traffico. |
| 1 | Gio 19 | **Blog tecnico (dev.to)** | Resta su Google e diventa la risorsa da linkare nei post tecnici delle settimane dopo. |
| **2** | Mar 24 | **r/Garmin** | Dopo 1 settimana si sono corretti i primi problemi di connessione; l'angolo "orologio" è un'altra storia, non una replica. Solo Android: avvisare. |
| 2 | Gio 26 | **Blog per ciclisti (IT e poi EN)** + prime 3–4 **mail ai creator italiani** | Gli articoli danno ai creator qualcosa da leggere oltre alla GIF. |
| **3** | Mar 1 dic | **Show HN** | Il repo ha un'altra settimana di issue chiuse e commenti; HN porta stelle e contributori, ma anche critiche: meglio quando si risponde in fretta. Ore 14–16 italiane. **Prerequisito: modalità demo/simulatore** (HN vuole qualcosa da provare). |
| 3 | Gio 3 | **r/Zwift** (dopo modmail positiva) | Il tono con la community Zwift è delicato: arrivarci con feedback reali e un'app rodata. |
| **4** | Mar 8 | **r/threejs** (con GIF dei giochi) | Pubblico che guarda il codice dei giochi; richiede materiale visivo già pronto. |
| 4 | Sab 12 | **r/webdev – Showoff Saturday** | Lo permettono solo di sabato (regola riportata da un mirror, da verificare). Collega l'articolo dev.to. |
| 4 | — | **Inizio Google Ads Ricerca** (vedi `ads.md`) | Dopo 2–4 settimane di organico, come da piano: abbiamo già parole e pagine che funzionano. |
| **5** | Mar 15 | **r/droidappshowcase** (non r/androidapps) | Vuole l'app sul Play Store; se ancora in test, rimandare. |
| 5 | Gio 17 | **r/opensource** | Dopo 4 settimane il progetto mostra continuità (commit, issue chiuse): più credibile. Controllare la regola su progetti LLM/solo-dev. |
| 5 | — | **Mail ai creator in inglese** (riserve incluse) | Si invia con una storia di settimane già alle spalle. |
| **6** | Mar 22 | **r/cycling** (solo se permesso, in forma di domanda) | Grande ma severo sulle promozioni; si va per ultimo e solo se i mod lo consentono. |
| 6 | Gio 24 dic → **meglio martedì 12 gennaio 2027** | **Product Hunt** | Ultimo, come da piano: backlink e badge; ora c'è storia e recensioni da mostrare. Il 24 dicembre è una pessima data per un lancio: Product Hunt esce quindi dalla finestra di 6 settimane. |
| 6 | — | **Reddit Ads** (se Google ha dato dati) e **bilancio** delle 6 settimane | Si promuove il post organico migliore. |

**Perché non 2 post lo stesso giorno:** ogni post richiede 3 ore di risposte. **Perché dopo 2–3 giorni tra post nello stesso tema:** i commenti del primo dettano le correzioni.

**Le feste:** dal 24 dicembre al 1° gennaio HN e Product Hunt sono deboli. Se il giorno 0 slitta oltre il 23 novembre, sposta anche Show HN e r/cycling a gennaio.

## Link con `?ref=canale`

Convenzione: minuscole, trattini, `canale` o `canale-sub`. Base: `https://mta-world.com/` [DA VERIFICARE il dominio definitivo; il sito oggi è `mta-world.com` e il file `CNAME` lo conferma].

| Canale | Link |
|---|---|
| r/indoorcycling | `https://mta-world.com/?ref=reddit-indoorcycling` |
| r/Garmin | `https://mta-world.com/?ref=reddit-garmin` |
| r/Zwift | `https://mta-world.com/?ref=reddit-zwift` |
| r/cycling | `https://mta-world.com/?ref=reddit-cycling` |
| r/opensource | `https://mta-world.com/?ref=reddit-opensource` |
| r/droidappshowcase | `https://mta-world.com/?ref=reddit-droidappshowcase` |
| r/webdev | `https://mta-world.com/?ref=reddit-webdev` |
| r/threejs | `https://mta-world.com/?ref=reddit-threejs` |
| Show HN | `https://mta-world.com/?ref=hn` |
| Product Hunt | `https://mta-world.com/?ref=producthunt` |
| dev.to | `https://mta-world.com/?ref=devto` |
| Blog IT / EN | `…/?ref=blog-it` · `…/?ref=blog-en` |
| Creator (uno per canale) | `…/?ref=creator-dcrainmaker`, `creator-gplama`, `creator-zwiftinsider`, `creator-bikeradar`, `creator-gcnitalia`, `creator-bicipro`… |
| AlternativeTo | `…/?ref=alternativeto` |
| GitHub | `…/?ref=github` |
| Google Ads | `…/?ref=gads-it` · `gads-en` · `gads-fr` (e `utm_term` se serve) |
| Reddit Ads | `…/?ref=radsr-indoorcycling` ecc. |
| Gruppi Facebook, forum TrainerRoad, bdc-forum.it | `…/?ref=fb-d100`, `…/?ref=trforum`, `…/?ref=bdcforum` |

Nota: il link a Play Store non accetta `?ref=`; per contare le installazioni da canale usare il parametro `referrer` del link Play (`&referrer=utm_source%3Dreddit-indoorcycling`) **[DA VERIFICARE]** e leggere il dato nella Play Console. Per l'APK di GitHub, il contatore è il numero di download della release e GoatCounter sul click.

## Metriche da guardare

Pochi numeri, controllati ogni lunedì (non ogni ora):

| Livello | Metrica | Fonte | Segnale buono (indicativo, da calibrare) |
|---|---|---|---|
| Arrivo | Visite al sito per `ref` | GoatCounter | Conta il rapporto visite/impression, non il totale |
| Interesse | Clic su "Scarica APK" / "Apri l'app" per `ref` | GoatCounter (evento) **[DA VERIFICARE: l'evento non esiste ancora]** | ≥ 10% delle visite |
| Uso | Utenti attivi mensili | Play Console (Android vitals/installazioni attive), GoatCounter per il web | Obiettivo del piano: 500 MAU in 3 mesi |
| Prova reale | **Numero di rulli diversi segnalati** con "Segnala un problema" e quanti sono "funziona" | Issue GitHub | È la metrica che conta: la tabella "Rulli compatibili" cresce |
| Comunità | Stelle GitHub, issue, PR di terzi | GitHub | Obiettivo del piano: 100 stelle in 3 mesi |
| Qualità | Voto Play, recensioni, crash | Play Console (Android vitals) | ≥ 4,0; crash-free alto |
| Costo | € per click / € per apertura app | Google/Reddit Ads | Regola di stop in `ads.md` |
| Sentimento | Commenti negativi ricorrenti | Reddit/HN | Se uno stesso problema compare 3 volte → priorità immediata |

**Diario di bordo:** un foglio con data, canale, link, upvote/commenti nelle prime 24 h, visite per `ref`, bug emersi. Dopo ogni post, 1 riga di "cosa cambierei".

**Regola di rallentamento:** se un post genera ≥ 5 segnalazioni di "il mio rullo non si collega" per lo stesso modello, ferma i post successivi finché non è corretto.
