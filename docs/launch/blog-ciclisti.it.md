---
title: "Allenarsi sul rullo senza abbonamento: l'orologio come computer da bici e lo Zwift Click fuori da Zwift"
published: false
description: "Come usare un rullo smart senza pagare ogni mese: un'app gratuita e open source, l'attività sull'orologio Garmin e il Click come cambio virtuale."
---

<!-- Bozza (G4). NON pubblicata. ~800 parole. Dove serve la tua voce: [TUO]. Controlli: [DA VERIFICARE] LICENSE nel repo, modello di orologio provato. -->

Se hai comprato un rullo smart da 200–400 euro (un Van Rysel D100 o D500, un Elite, un Tacx, un Wahoo Core…), probabilmente hai scoperto una cosa: il rullo è la parte facile. Poi arriva l'abbonamento mensile per usarlo bene. Non c'è nulla di sbagliato nell'abbonamento, se ti serve il mondo virtuale, le gare e la community. Ma se la sera vuoi solo fare un buon allenamento di un'ora, forse non ne hai bisogno.

Questo articolo racconta come ci alleniamo noi senza pagare ogni mese. Ti avviso: l'app di cui parlo l'ho scritta io, è gratuita e open source, e ha dei limiti che ti dico subito.

## Cosa serve davvero per allenarsi bene sul rullo

Un buon allenamento indoor ha pochi ingredienti:

1. **Un modo di controllare la resistenza**: potenza fissa (ERG) per gli intervalli, oppure pendenza simulata per i percorsi.
2. **Una struttura**: sapere cosa fare nei prossimi 10 minuti, calcolato sulla tua FTP.
3. **Un modo di non annoiarsi**: video, musica, giochi o un percorso.
4. **Registrare l'uscita**, così finisce su Garmin Connect o Strava e conta nello storico.

Quasi tutti i rulli smart dal 2020 parlano lo stesso protocollo Bluetooth (FTMS), quindi l'app non è legata alla marca del rullo. Una nota onesta: io l'ho provata soprattutto con il Van Rysel D100. I Tacx più vecchi e i Wahoo con firmware vecchio li ho implementati, ma finora solo con un rullo simulato; se ne hai uno, la tua segnalazione vale oro.

## Il cambio virtuale: la parte che mi mancava

Su un rullo con ERG puoi fare intervalli, ma se pedali "a mano" senza cambio la resistenza non ti dà la sensazione di una bici vera. Per questo ho aggiunto un **cambio virtuale a 24 marce**: l'app calcola la potenza richiesta a partire da cadenza, marcia, pendenza e peso. Se cambi marcia, la resistenza cambia davvero; se pedali più forte, aumenta come su strada. C'è anche il cambio automatico, che sceglie la marcia per mantenere la cadenza che hai deciso (80–95 giri).

Per allenarti non serve altro: scegli un allenamento (sweet spot, soglia, VO2max, piramide, 30/30), oppure fai il test FTP a rampa per sapere da dove partire. Se vuoi, crei il tuo allenamento con l'editor a blocchi.

## L'orologio come computer da bici

Qui c'è la funzione che mi ha convinto a pubblicare l'app. Con l'app per Android, il telefono **trasmette potenza, cadenza e velocità come se fosse un sensore Bluetooth**. Il tuo Garmin li vede come un normale misuratore di potenza, registra l'uscita come attività indoor e la sincronizza su Garmin Connect come sempre [DA VERIFICARE su più modelli: è il comportamento normale di un sensore BLE, ma va confermato con i tuoi dispositivi]. L'app salva comunque anche un file .FIT che puoi importare a mano.

Un trucco che mi ha fatto perdere un po' di tempo: se l'orologio resta collegato al telefono, tende a usare quello come fonte. Nell'app c'è una piccola guida illustrata per scollegarlo (tieni premuto il tasto luce, poi Telefono → disattivato). [TUO: modello di orologio/ciclocomputer che hai provato; non so su quali altri modelli funzioni, quindi non prometto nulla.]

Questo funziona solo su Android. Su iPhone Safari non ha il Bluetooth per le web app: si può usare il browser gratuito Bluefy per la versione web, ma il ponte verso l'orologio non c'è.

## Lo Zwift Click, anche fuori da Zwift

Se hai il Click (viene incluso in alcuni rulli "Zwift Ready", come il D100), puoi usarlo come **cambio** anche nell'app: + e − cambiano marcia,. Il supporto è sperimentale: il protocollo è stato ricostruito da progetti open source, e su alcuni firmware potrebbe non funzionare. Se non risponde, ci sono i pulsanti a schermo, la tastiera o telecomandi Bluetooth che mandano frecce o pagina su/giù. Non abbiamo alcun legame con Zwift: sono marchi dei rispettivi proprietari.

## E per non annoiarsi?

Ho aggiunto cose che non troverai su un'app seria. Un video di YouTube (o un tuo file) che scorre alla tua velocità. Percorsi GPX in cui la pendenza segue il tracciato. E dei **giochi 3D a pedali**: una tappa in linea con otto avversari, uno sparatutto, un aereo che vola a watt. Sono stupidi e funzionano: un'ora di fondo passa molto più in fretta. Le salite del gioco arrivano al rullo come pendenza reale.

## Quanto costa, cosa fa dei tuoi dati

Zero euro. Nessun account: storico, record e allenamenti restano sul tuo dispositivo, con un backup che puoi esportare. Il codice è pubblico (licenza GPL-3.0), quindi chiunque può guardare cosa fa. Account e classifiche sono in arrivo, ma saranno facoltativi.

## I limiti, senza giri di parole

- L'interfaccia e il coach vocale sono **solo in italiano** (per ora).
- Niente mondi virtuali, niente corse online: non è il suo scopo.
- Tacx e Wahoo vecchi: scritti, ma mai provati su un rullo vero.
- Click sperimentale, orologi da verificare modello per modello.
- È il progetto di una persona sola: ci sono spigoli.

## Come provarla

Su Android scarica l'app; su PC o Mac apri la versione web con Chrome o Edge (serve il Bluetooth). Chiudi prima le altre app collegate al rullo: ne accetta una sola alla volta. Se il tuo rullo non si collega, usa il pulsante "Segnala un problema": mi dice quali servizi Bluetooth espone e apre una segnalazione precompilata su GitHub.

- App e versione web: https://mta-world.com/?ref=blog-it
- Codice sorgente: https://github.com/c1aud1o/ride-freedom

Dimmi che rullo hai e cosa non funziona: è il modo migliore per renderla utile a più persone.
