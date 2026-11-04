# Giochi di Ride Freedom — note di design

Due giochi originali pensati per il rullo: si controllano con i tasti +/− dello Zwift Click
(o tocco / tastiera) e con le gambe. Nessun personaggio, grafica o nome di giochi esistenti.

## Cosa rende coinvolgenti questi generi (dalla ricerca)

| Principio | Da dove viene | Come l'abbiamo applicato |
|---|---|---|
| **Game feel / "juice"**: ogni colpo deve "arrivare" con più feedback sovrapposti (micro-pausa, scossa, lampo, particelle, suono) | guide su game feel e hit-stop | hit-stop sulle uccisioni, rallentatore sul boss, lampo bianco sui nemici colpiti, schegge, bossoli, fumo, scossa dosata per importanza |
| **Animazione e personalità** sono il motivo per cui gli sparatutto a scorrimento classici sono ricordati | analisi e recensioni del genere | pixel-art animata, eroi con un carattere e un vantaggio, cattivo comico (Barone Bullone), prigionieri che salutano e ringraziano |
| **Varietà che cambia il ritmo**: armi, potenziamenti, ambientazioni, boss | analisi del genere run-and-gun | 5 armi a munizioni limitate, 3 missioni con scenari diversi, 3 boss con fasi di rabbia, casse e prigionieri |
| **Gare sempre combattute**: oggetti pesati sulla posizione ed elastico sui rivali | analisi dei giochi di kart | oggetti migliori a chi è indietro, rivali che restano vicini, volata finale |
| **Exergame: lo sforzo deve diventare spettacolo**; competizione e narrazione aumentano divertimento e intensità | ricerca su exergame in bici | potenza → colpi/s; sprint sopra soglia → OVERDRIVE / oggetti; sfide sprint a tempo (intervalli veri); pendenza reale; musica a tempo con la cadenza |

## Pedal Strike
- **Eroi**: Rocco "Chiave Inglese" (6 vite), Vale "Lampo" (+25% cadenza di tiro), Nonno Gino (6 bombe).
- **Missioni**: Periferia Arrugginita → Deserto dei Pistoni → Fabbrica del Barone, poi si ricomincia più difficile.
- **Boss**: Cingolone (carro armato), Il Frullatore (elicottero), Barone Bullone sul Mecha-Triciclo (carica: va saltata).
- **Armi**: Blaster, Mitraglia (M), Razzi a ricerca (R), Fiamme (F), Laser perforante (L).
- **Nemici**: robot, robot con scudo, droni, barili rotolanti, mine (vanno saltate), torrette.
- **Sforzo**: la soglia sprint è il 130% della tua media degli ultimi ~45 s. Restarci sopra carica l'OVERDRIVE
  (8 s invincibile, danni ×2). Ogni tanto parte una SFIDA SPRINT: 10 s sopra soglia per un premio.

## Turbo Pedali
- 8 ciclisti, 3 giri, 3 circuiti (Litorale al Tramonto, Passo delle Nuvole con salite fino al 6%, Città al Neon).
- **Scia**: stai 2–14 m dietro a un rivale nella stessa corsia → +12%.
- **Monete**: +1% di velocità ciascuna (max 10).
- **Oggetti** (scatole "?"): Gel Turbo, Vento a favore, Chiodini, Scudo. Si usano con uno **sprint** di 1,2 s.
- I rivali hanno nome, carattere e battute; i record per circuito vengono salvati.

## Dalla conoscenza di game design (oltre la ricerca)
- **Ciclo di ritorno quotidiano**: esperienza e livelli condivisi tra i giochi, 3 **sfide del giorno**
  (uguali per tutto il giorno, cambiano a mezzanotte) e 15 **obiettivi** con notifiche.
- **Corsa con la cultura del ciclismo**: **traguardo volante** e **Gran Premio della Montagna** a ogni
  giro (5/3/1 punti), con **maglia verde** e **maglia a pois** che indossi davvero se sei in testa.
- **Fantasma**: il tuo miglior tempo per circuito corre con te, con il distacco in secondi.
- **Sparatutto più profondo**: *colpo di pompa* automatico a contatto, veicolo **Cargo-Cannone**
  (corazza + cannone, a metà missione), **punti deboli** lampeggianti sui boss (danno ×2),
  i robot **scappano** quando sei in OVERDRIVE.

## Idee per il futuro
- Sessioni strutturate: livelli = blocchi di un allenamento a intervalli.
- Classifiche condivise tra amici.
