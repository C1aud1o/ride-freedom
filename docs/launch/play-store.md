# Scheda Google Play Store: bozza (G1)

> **Solo bozza, nulla è pubblicato.** Stato del codice al 2026-11-07 (branch `spindro/g-launch-content`).
> Limiti Play: titolo ≤ 30, descrizione breve ≤ 80, descrizione lunga ≤ 4000, "novità" ≤ 500 caratteri.
> I conteggi sono verificati con lo script in fondo al file (tutti i campi risultano nei limiti).

## Prima di inviare: 6 controlli (cose che le bozze presuppongono)

1. **Lingua dell'app.** Oggi l'interfaccia, il coach vocale e i testi dell'app sono **solo in italiano** (non esiste ancora `js/i18n.js` né `locales/`, vedi PIANO-LANCIO fase C). Le schede EN/FR/ES/DE sono pronte, ma pubblicarle prima della fase C porta utenti francesi/spagnoli/tedeschi in un'app italiana → recensioni da 1 stella. **Regola:** pubblica una lingua della scheda solo quando esiste la stessa lingua nell'app. Fino ad allora: IT + EN (e in EN dichiara "interface currently in Italian" → [DA VERIFICARE] se Google lo accetta come omissione corretta; la riga è già nella bozza EN).
2. **Il titolo non contiene "Zwift".** Il piano (sez. 9) suggeriva "Ride Freedom: Smart Trainer & Zwift Click". Il nome di un marchio altrui nel titolo è il modo più rapido per ricevere un rifiuto/sospensione dalla policy sui metadati e dai titolari del marchio. Il titolo qui sotto è esattamente il nome dell'app (30 caratteri) e contiene già "Smart Trainer". "Zwift Click" compare nella descrizione solo come "compatibile con", con la nota "nessuna affiliazione" (vedi `docs/legal/trademarks.*.md`).
3. **Nome definitivo** (decisione A1 del piano): il nome nel repo è già *Spindro*. Se cambia, cambiano titolo e testi.
4. **Licenza.** Le bozze dicono "open source (GPL-3.0)". Nel repo **manca ancora il file `LICENSE`** (`ls LICENSE*` non trova nulla; `package.json` non ha il campo `license`). Fino a D6 la frase non è verificabile da fuori: **[DA VERIFICARE]** che il file sia nel repo prima della pubblicazione.
5. **Funzioni sperimentali.** FE-C (Tacx), Wahoo legacy e Zwift Click/Play/Ride sono dichiarati così anche nel README: nelle descrizioni compaiono come "sperimentali" o "provati con rullo simulato". Non toglierlo.
6. **Strava automatico** dipende dal Cloudflare Worker (`server/strava-worker`): **[DA VERIFICARE]** che sia pubblicato prima di scrivere "carica su Strava con un tocco". Nelle bozze la frase c'è solo come "caricamento su Strava (se attivato)" nella versione sicura; sotto, la riga è marcata.

Categoria: **Salute e fitness**. Tag Play suggeriti: Allenamento / Ciclismo [DA VERIFICARE: i tag disponibili variano per categoria]. Nome pacchetto: `com.spindro.app`.

Il Play Store **non ha un campo "parole chiave"**: la ricerca legge titolo, descrizione breve e descrizione lunga. Le parole chiave (sezione finale) vanno quindi usate in modo naturale nei testi, senza elenchi: la policy Play sul "keyword stuffing" è severa.

---

## English (EN)

#### Titolo (30)
```
Spindro: Smart Trainer Cycling
```
#### Breve (≤80)
```
Free open-source app for smart trainers: virtual gears, ERG, games, FIT export
```
#### Lunga (≤4000)
```
Spindro turns your phone into a free, open-source cycling app for your smart trainer. No subscription. No account needed. Your data stays on your device.

NOTE: the app interface and voice coach are currently in Italian only; more languages are on the way.

CONNECT YOUR TRAINER
• Bluetooth with automatic protocol choice: FTMS (most smart trainers since about 2020), Tacx FE-C over Bluetooth and Wahoo legacy (experimental: so far tested only against a simulated trainer, not on real hardware), or read-only Cycling Power / Speed & Cadence.
• Real-time power, cadence, speed and heart rate (Bluetooth chest strap, or a watch that broadcasts heart rate).
• Developed and tested mainly with the Van Rysel D100. Your trainer not working? There is a built-in "Report a problem" button; every report helps the compatibility list.

FOUR WAYS TO RIDE
• Gears: 24 virtual gears. A physics model (cadence, gear, slope, weight) sets the ERG power, so shifting really changes the resistance. Optional automatic shifting keeps your target cadence.
• ERG: fixed power.
• Slope: simulated gradient.
• Resistance: resistance level in %.
Shift with on-screen buttons, keyboard or Bluetooth remotes, or a Zwift Click (experimental support; Zwift Play and Zwift Ride are also recognised).

GAMES THAT USE YOUR LEGS
Pedal-powered 3D games: a road stage with eight rivals, a side-scrolling shooter, a horde shooter, a plane that flies on watts, a drafting game and a brick breaker. More watts, more speed or firepower; climbs arrive on the trainer as real gradient.

STRUCTURED TRAINING
• ERG workouts computed on your FTP (sweet spot, threshold, VO2max, pyramid, 30/30…) and a ramp FTP test.
• Workout editor; export workouts as Garmin FIT or .zwo, import .zwo.
• GPX routes: gradient follows the track, elevation profile, mini map, challenge your own record.
• Ride along a YouTube video or your own video file at your speed.

YOUR WATCH AS A BIKE COMPUTER (Android)
The phone can broadcast your power, cadence and speed as a Bluetooth sensor, so a Garmin watch or bike computer can record the session.

HISTORY AND EXPORT
• Records every ride as a .FIT file you can import into Garmin Connect, Strava and other services.
• History with weekly minutes, power records (5 s, 1, 5, 20 min), estimated FTP and a chart for every ride. Share card at the end of the ride.
• Auto-start and pause, weekly goal, heart-rate zones, data backup.

OPEN SOURCE
The full source code is public under the GPL-3.0 licence. Accounts and leaderboards are planned for later and will be optional: the app is already complete without them.

Tip: your trainer accepts one Bluetooth connection at a time, so close other cycling apps first.

Zwift, Garmin, Strava, Tacx, Wahoo, Van Rysel and other names are trademarks of their respective owners. Spindro is independent and not affiliated with them.
```
#### Novità (≤500)
```
First public release.
• 24 virtual gears, ERG, slope and resistance modes
• FTMS trainers; experimental Tacx FE-C and Wahoo legacy
• 3D pedal-powered games, structured workouts, FTP test, GPX routes
• .FIT recording and workout export
• Garmin bridge: the phone acts as a power/cadence/speed sensor
Tell us which trainer you use with "Report a problem".
```

---

## Italiano (IT)

#### Titolo (30)
```
Spindro: Smart Trainer Cycling
```
#### Breve (≤80)
```
App gratis e open source per rulli smart: cambio virtuale, ERG, giochi, file FIT
```
#### Lunga (≤4000)
```
Spindro trasforma il telefono in un'app da ciclismo gratuita e open source per il tuo rullo smart. Nessun abbonamento, nessun account obbligatorio. I tuoi dati restano sul dispositivo.

COLLEGA IL RULLO
• Bluetooth con scelta automatica del protocollo: FTMS (quasi tutti i rulli smart dal 2020 circa), Tacx FE-C su Bluetooth e Wahoo legacy (sperimentali: finora provati solo con un rullo simulato, non con rulli veri) oppure sola lettura Cycling Power / Speed & Cadence.
• Potenza, cadenza, velocità e frequenza cardiaca in tempo reale (fascia Bluetooth o orologio che trasmette il battito).
• Sviluppata e provata soprattutto con il Van Rysel D100. Il tuo rullo non va? C'è il pulsante "Segnala un problema": ogni segnalazione migliora l'elenco dei rulli compatibili.

QUATTRO MODI DI PEDALARE
• Cambio: 24 marce virtuali. Un modello fisico (cadenza, rapporto, pendenza, peso) calcola la potenza ERG, quindi cambiare marcia cambia davvero la resistenza. Il cambio automatico opzionale mantiene la cadenza scelta.
• ERG: potenza fissa.
• Pendenza: salite simulate.
• Resistenza: livello in %.
Cambi con i pulsanti a schermo, la tastiera o telecomandi Bluetooth, oppure con uno Zwift Click (supporto sperimentale; riconosciuti anche Zwift Play e Zwift Ride).

GIOCHI CHE SI GIOCANO CON LE GAMBE
Giochi 3D a pedali: una tappa in linea con otto avversari, uno sparatutto a scorrimento, uno sparatutto a orde, un aereo che vola a watt, un gioco di scia e uno di mattoni. Più watt = più velocità o più colpi; le salite arrivano sul rullo come pendenza reale.

ALLENAMENTI STRUTTURATI
• Allenamenti ERG calcolati sulla tua FTP (sweet spot, soglia, VO2max, piramide, 30/30…) e test FTP a rampa.
• Editor di allenamenti; esporta in .FIT per Garmin o .zwo, importa .zwo.
• Percorsi GPX: la pendenza segue il tracciato, profilo altimetrico, mini mappa, sfida al tuo record.
• Pedala su un video di YouTube o su un tuo file, alla tua velocità.

L'OROLOGIO COME COMPUTER DA BICI (Android)
Il telefono può trasmettere potenza, cadenza e velocità come un sensore Bluetooth, così un orologio o ciclocomputer Garmin registra l'uscita.

STORICO ED ESPORTAZIONE
• Registra ogni uscita in un file .FIT da importare in Garmin Connect, Strava e altri servizi.
• Storico con minuti settimanali, record di potenza (5 s, 1, 5, 20 min), FTP stimata e grafico di ogni uscita. Scheda da condividere a fine uscita.
• Avvio e pausa automatici, obiettivo settimanale, zone cardio, backup dei dati.
• Coach vocale in italiano: annuncia tratti, watt, ultimi secondi e salite in arrivo.

OPEN SOURCE
Il codice è pubblico con licenza GPL-3.0. Account e classifiche sono in arrivo, saranno facoltativi: l'app è già completa senza.

Consiglio: il rullo accetta una sola connessione Bluetooth alla volta, quindi chiudi le altre app di ciclismo.

Zwift, Garmin, Strava, Tacx, Wahoo, Van Rysel e altri nomi sono marchi dei rispettivi proprietari. Spindro è indipendente e non è affiliata a nessuno di essi.
```
#### Novità (≤500)
```
Prima versione pubblica.
• Cambio virtuale a 24 marce, modi ERG, pendenza e resistenza
• Rulli FTMS; Tacx FE-C e Wahoo legacy sperimentali
• Giochi 3D a pedali, allenamenti, test FTP, percorsi GPX
• Registrazione .FIT ed esportazione allenamenti
• Ponte Garmin: il telefono fa da sensore di potenza/cadenza/velocità
Dicci che rullo usi con "Segnala un problema".
```

---

## Français (FR)

> Pubblicare solo quando l'app ha l'interfaccia in francese (vedi controllo 1).

#### Titolo (30)
```
Spindro: Smart Trainer Cycling
```
#### Breve (≤80)
```
App gratuite et open source pour home trainer : vitesses virtuelles, ERG, jeux
```
#### Lunga (≤4000)
```
Spindro transforme votre téléphone en une application de cyclisme gratuite et open source pour votre home trainer connecté. Pas d'abonnement, pas de compte obligatoire. Vos données restent sur votre appareil.

NOTE : l'interface et le coach vocal sont pour l'instant uniquement en italien ; d'autres langues arrivent.

CONNECTEZ VOTRE HOME TRAINER
• Bluetooth avec choix automatique du protocole : FTMS (la plupart des home trainers connectés depuis 2020 environ), Tacx FE-C sur Bluetooth et Wahoo legacy (expérimentaux : testés jusqu'ici seulement avec un home trainer simulé, pas sur du matériel réel) ou lecture seule Cycling Power / Speed & Cadence.
• Puissance, cadence, vitesse et fréquence cardiaque en temps réel (ceinture Bluetooth ou montre qui diffuse le pouls).
• Développée et testée surtout avec le Van Rysel D100. Votre home trainer ne fonctionne pas ? Le bouton « Signaler un problème » est intégré : chaque signalement enrichit la liste de compatibilité.

QUATRE FAÇONS DE PÉDALER
• Vitesses : 24 rapports virtuels. Un modèle physique (cadence, rapport, pente, poids) calcule la puissance ERG : changer de vitesse change vraiment la résistance. Le changement automatique en option garde la cadence visée.
• ERG : puissance fixe.
• Pente : montées simulées.
• Résistance : niveau en %.
Changez avec les boutons à l'écran, le clavier, des télécommandes Bluetooth ou un Zwift Click (prise en charge expérimentale ; Zwift Play et Zwift Ride sont aussi reconnus).

DES JEUX QUI SE JOUENT AVEC LES JAMBES
Jeux 3D au pédalier : une étape en ligne avec huit rivaux, un shoot'em up à défilement, un jeu de hordes, un avion qui vole aux watts, un jeu d'aspiration et un casse-briques. Plus de watts = plus de vitesse ou de tirs ; les montées arrivent sur le home trainer comme une vraie pente.

ENTRAÎNEMENTS STRUCTURÉS
• Séances ERG calculées sur votre FTP (sweet spot, seuil, VO2max, pyramide, 30/30…) et test FTP en rampe.
• Éditeur de séances ; export en .FIT pour Garmin ou en .zwo, import de .zwo.
• Parcours GPX : la pente suit le tracé, profil altimétrique, mini-carte, défi contre votre record.
• Pédalez sur une vidéo YouTube ou votre propre fichier, à votre vitesse.

LA MONTRE COMME COMPTEUR (Android)
Le téléphone peut diffuser puissance, cadence et vitesse comme un capteur Bluetooth : une montre ou un compteur Garmin enregistre la séance.

HISTORIQUE ET EXPORT
• Enregistre chaque sortie dans un fichier .FIT à importer dans Garmin Connect, Strava et d'autres services.
• Historique : minutes par semaine, records de puissance (5 s, 1, 5, 20 min), FTP estimée et graphique de chaque sortie. Carte à partager en fin de sortie.
• Démarrage et pause automatiques, objectif hebdomadaire, zones cardio, sauvegarde des données.

OPEN SOURCE
Le code source est public sous licence GPL-3.0. Comptes et classements sont prévus plus tard, ils seront facultatifs : l'application est déjà complète sans eux.

Astuce : le home trainer n'accepte qu'une connexion Bluetooth à la fois, fermez les autres applications de cyclisme.

Zwift, Garmin, Strava, Tacx, Wahoo, Van Rysel et d'autres noms sont des marques de leurs propriétaires. Spindro est indépendante et n'est affiliée à aucun d'eux.
```
#### Novità (≤500)
```
Première version publique.
• 24 vitesses virtuelles, modes ERG, pente et résistance
• Home trainers FTMS ; Tacx FE-C et Wahoo legacy expérimentaux
• Jeux 3D au pédalier, séances, test FTP, parcours GPX
• Enregistrement .FIT et export des séances
• Pont Garmin : le téléphone sert de capteur puissance/cadence/vitesse
Dites-nous quel home trainer vous utilisez via « Signaler un problème ».
```

---

## Español (ES)

> Pubblicare solo quando l'app ha l'interfaccia in spagnolo (vedi controllo 1).

#### Titolo (30)
```
Spindro: Smart Trainer Cycling
```
#### Breve (≤80)
```
App gratis y open source para rodillos: marchas virtuales, ERG, juegos y FIT
```
#### Lunga (≤4000)
```
Spindro convierte tu teléfono en una app de ciclismo gratuita y de código abierto para tu rodillo inteligente. Sin suscripción y sin cuenta obligatoria. Tus datos se quedan en tu dispositivo.

NOTA: la interfaz y el entrenador de voz están por ahora solo en italiano; llegarán más idiomas.

CONECTA TU RODILLO
• Bluetooth con elección automática del protocolo: FTMS (la mayoría de los rodillos inteligentes desde 2020 aproximadamente), Tacx FE-C por Bluetooth y Wahoo legacy (experimentales: hasta ahora probados solo con un rodillo simulado, no con equipos reales) o solo lectura Cycling Power / Speed & Cadence.
• Potencia, cadencia, velocidad y frecuencia cardíaca en tiempo real (banda Bluetooth o reloj que emite el pulso).
• Desarrollada y probada sobre todo con el Van Rysel D100. ¿Tu rodillo no funciona? Hay un botón «Informar de un problema»: cada informe mejora la lista de compatibilidad.

CUATRO FORMAS DE PEDALEAR
• Marchas: 24 desarrollos virtuales. Un modelo físico (cadencia, desarrollo, pendiente, peso) calcula la potencia ERG, así que cambiar de marcha cambia de verdad la resistencia. El cambio automático opcional mantiene la cadencia elegida.
• ERG: potencia fija.
• Pendiente: subidas simuladas.
• Resistencia: nivel en %.
Cambia con los botones de pantalla, el teclado, mandos Bluetooth o un Zwift Click (soporte experimental; también se reconocen Zwift Play y Zwift Ride).

JUEGOS QUE SE JUEGAN CON LAS PIERNAS
Juegos 3D a pedales: una etapa en línea con ocho rivales, un shooter lateral, un shooter de hordas, un avión que vuela a vatios, un juego de rueda y un rompeladrillos. Más vatios = más velocidad o más disparos; las subidas llegan al rodillo como pendiente real.

ENTRENAMIENTOS ESTRUCTURADOS
• Entrenos ERG calculados sobre tu FTP (sweet spot, umbral, VO2max, pirámide, 30/30…) y test de FTP en rampa.
• Editor de entrenos; exporta a .FIT para Garmin o .zwo, importa .zwo.
• Rutas GPX: la pendiente sigue el track, perfil de altitud, minimapa, reto contra tu récord.
• Pedalea sobre un vídeo de YouTube o un archivo propio, a tu velocidad.

EL RELOJ COMO CICLOCOMPUTADOR (Android)
El teléfono puede emitir potencia, cadencia y velocidad como un sensor Bluetooth, para que un reloj o ciclocomputador Garmin grabe la sesión.

HISTORIAL Y EXPORTACIÓN
• Graba cada salida en un archivo .FIT que puedes importar a Garmin Connect, Strava y otros servicios.
• Historial con minutos semanales, récords de potencia (5 s, 1, 5, 20 min), FTP estimada y gráfico de cada salida. Tarjeta para compartir al terminar.
• Inicio y pausa automáticos, objetivo semanal, zonas cardíacas, copia de seguridad.

CÓDIGO ABIERTO
El código fuente es público con licencia GPL-3.0. Cuentas y clasificaciones llegarán más adelante y serán opcionales: la app ya está completa sin ellas.

Consejo: el rodillo admite una sola conexión Bluetooth a la vez; cierra otras apps de ciclismo.

Zwift, Garmin, Strava, Tacx, Wahoo, Van Rysel y otros nombres son marcas de sus respectivos propietarios. Spindro es independiente y no está afiliada a ninguno.
```
#### Novità (≤500)
```
Primera versión pública.
• 24 marchas virtuales, modos ERG, pendiente y resistencia
• Rodillos FTMS; Tacx FE-C y Wahoo legacy experimentales
• Juegos 3D a pedales, entrenos, test FTP, rutas GPX
• Grabación .FIT y exportación de entrenos
• Puente Garmin: el teléfono actúa como sensor de potencia/cadencia/velocidad
Cuéntanos qué rodillo usas con «Informar de un problema».
```

---

## Deutsch (DE)

> Pubblicare solo quando l'app ha l'interfaccia in tedesco (vedi controllo 1).

#### Titolo (30)
```
Spindro: Smart Trainer Cycling
```
#### Breve (≤80)
```
Kostenlose Open-Source-App für Smart Trainer: virtuelle Gänge, ERG, Spiele, FIT
```
#### Lunga (≤4000)
```
Spindro macht dein Handy zu einer kostenlosen Open-Source-Radsport-App für deinen Smart Trainer. Kein Abo, kein Konto nötig. Deine Daten bleiben auf deinem Gerät.

HINWEIS: Oberfläche und Sprach-Coach sind derzeit nur auf Italienisch; weitere Sprachen folgen.

TRAINER VERBINDEN
• Bluetooth mit automatischer Protokollwahl: FTMS (die meisten Smart Trainer seit etwa 2020), Tacx FE-C über Bluetooth und Wahoo Legacy (experimentell: bisher nur mit einem simulierten Trainer getestet, nicht mit echter Hardware) oder reine Anzeige über Cycling Power / Speed & Cadence.
• Leistung, Trittfrequenz, Geschwindigkeit und Herzfrequenz in Echtzeit (Bluetooth-Brustgurt oder Uhr, die den Puls sendet).
• Vor allem mit dem Van Rysel D100 entwickelt und getestet. Dein Trainer läuft nicht? Der Button „Problem melden" ist eingebaut: Jede Meldung verbessert die Kompatibilitätsliste.

VIER ARTEN ZU FAHREN
• Gänge: 24 virtuelle Gänge. Ein Physikmodell (Trittfrequenz, Übersetzung, Steigung, Gewicht) berechnet die ERG-Leistung – Schalten ändert den Widerstand wirklich. Optionale Automatikschaltung hält die Wunsch-Trittfrequenz.
• ERG: feste Leistung.
• Steigung: simulierte Anstiege.
• Widerstand: Stufe in %.
Geschaltet wird per Bildschirmtasten, Tastatur, Bluetooth-Fernbedienung oder Zwift Click (experimentelle Unterstützung; Zwift Play und Zwift Ride werden ebenfalls erkannt).

SPIELE, DIE MAN MIT DEN BEINEN SPIELT
3D-Spiele mit Pedalkraft: eine Straßenetappe mit acht Rivalen, ein seitlich scrollender Shooter, ein Horden-Shooter, ein Flugzeug, das mit Watt fliegt, ein Windschatten-Spiel und ein Brick-Breaker. Mehr Watt = mehr Tempo oder Feuerkraft; Anstiege kommen als echte Steigung am Trainer an.

STRUKTURIERTES TRAINING
• ERG-Workouts auf Basis deiner FTP (Sweetspot, Schwelle, VO2max, Pyramide, 30/30 …) und Stufentest zur FTP.
• Workout-Editor; Export als Garmin-FIT oder .zwo, Import von .zwo.
• GPX-Strecken: Steigung folgt dem Track, Höhenprofil, Minikarte, Duell gegen deinen Rekord.
• Fahre zu einem YouTube-Video oder eigener Videodatei in deinem Tempo.

DIE UHR ALS FAHRRADCOMPUTER (Android)
Das Handy kann Leistung, Trittfrequenz und Geschwindigkeit wie ein Bluetooth-Sensor senden, sodass eine Garmin-Uhr oder ein Garmin-Radcomputer die Einheit aufzeichnet.

VERLAUF UND EXPORT
• Jede Fahrt wird als .FIT-Datei gespeichert, importierbar in Garmin Connect, Strava und andere Dienste.
• Verlauf mit Wochenminuten, Leistungsrekorden (5 s, 1, 5, 20 Min.), geschätzter FTP und Diagramm je Fahrt. Teilen-Karte am Ende der Fahrt.
• Automatischer Start und Pause, Wochenziel, Herzfrequenzzonen, Datensicherung.

OPEN SOURCE
Der Quellcode ist öffentlich unter der GPL-3.0. Konten und Bestenlisten sind für später geplant und werden optional sein: Die App ist auch ohne sie vollständig.

Tipp: Der Trainer akzeptiert nur eine Bluetooth-Verbindung gleichzeitig – schließe andere Rad-Apps vorher.

Zwift, Garmin, Strava, Tacx, Wahoo, Van Rysel und weitere Namen sind Marken ihrer jeweiligen Inhaber. Spindro ist unabhängig und nicht mit ihnen verbunden.
```
#### Novità (≤500)
```
Erste öffentliche Version.
• 24 virtuelle Gänge, Modi ERG, Steigung und Widerstand
• FTMS-Trainer; Tacx FE-C und Wahoo Legacy experimentell
• 3D-Spiele mit Pedalkraft, Workouts, FTP-Test, GPX-Strecken
• .FIT-Aufzeichnung und Workout-Export
• Garmin-Brücke: Das Handy dient als Leistungs-/Trittfrequenz-/Geschwindigkeitssensor
Sag uns über „Problem melden", welchen Trainer du nutzt.
```

---

## Testi "novità" per le versioni successive (modelli, EN/IT)

Da adattare a ciò che c'è davvero in ogni release. Tenere ≤ 500 caratteri.

| Tipo | EN | IT |
|---|---|---|
| Nuovo rullo supportato | `Added support/fixes for <trainer> thanks to your reports. Thank you!` | `Supporto/correzioni per <rullo> grazie alle vostre segnalazioni. Grazie!` |
| Traduzione | `New interface language: <language>.` | `Nuova lingua dell'interfaccia: <lingua>.` |
| Correzioni | `Fixes: <one line per fix>. Report problems from the app.` | `Correzioni: <una riga per correzione>. Segnala i problemi dall'app.` |
| Account (quando esisteranno) | `Optional account: backup and sync of history and workouts. Everything still works without one.` | `Account facoltativo: backup e sincronizzazione di storico e allenamenti. Tutto funziona anche senza.` |

---

## Didascalie per gli 8 screenshot

Ordine consigliato (il primo conta di più). Ogni schermata è generata da Playwright con dati finti (F2 del piano). Didascalie ≤ 40 caratteri.

| # | Schermata | EN | IT | FR | ES | DE |
|---|---|---|---|---|---|---|
| 1 | Collegamento rullo + dati live | Connect your smart trainer | Collega il tuo rullo smart | Connectez votre home trainer | Conecta tu rodillo inteligente | Smart Trainer verbinden |
| 2 | Modo Cambio, 24 marce | 24 virtual gears, real resistance | 24 marce virtuali, resistenza vera | 24 vitesses, vraie résistance | 24 marchas, resistencia real | 24 Gänge, echter Widerstand |
| 3 | Allenamento ERG strutturato | Structured ERG workouts | Allenamenti ERG strutturati | Séances ERG structurées | Entrenos ERG estructurados | Strukturierte ERG-Workouts |
| 4 | Turbo Pedali 3D (tappa) | Race a 3D stage on pedal power | Una tappa 3D a forza di pedali | Une étape 3D à la force des jambes | Una etapa 3D a pedales | 3D-Etappe mit Pedalkraft |
| 5 | L'Orda o Pedal Strike 3D | Watts become firepower | I watt diventano colpi | Les watts deviennent des tirs | Los vatios son disparos | Watt werden zu Schüssen |
| 6 | Ponte Garmin (Android) | Your watch records the ride | L'orologio registra l'uscita | Votre montre enregistre | Tu reloj graba la salida | Deine Uhr zeichnet auf |
| 7 | Percorso GPX + profilo | Ride a GPX route with real grades | Percorsi GPX con pendenze vere | Parcours GPX, vraies pentes | Rutas GPX con pendientes reales | GPX-Strecken mit echter Steigung |
| 8 | Storico, record e FTP | History, records and FTP estimate | Storico, record e stima FTP | Historique, records et FTP | Historial, récords y FTP | Verlauf, Rekorde und FTP |

Nota: mostrare nelle immagini solo funzioni vere (niente classifiche né account: "in arrivo"). Il 6 va fatto solo per Android; nessun logo Garmin/Zwift nelle immagini (vedi `docs/legal/trademarks.*.md`).

---

## Parole chiave pensate per la ricerca nello store

Da distribuire in titolo, descrizione breve e primi due paragrafi della lunga (le prime righe pesano di più), **mai** come elenco.

| Lingua | Intenzione principale | Parole/espressioni da far comparire (naturalmente) |
|---|---|---|
| EN | trovare un'app per un rullo smart senza abbonamento | smart trainer app, indoor cycling, FTMS, ERG mode, virtual gears, FTP test, structured workouts, .fit export, GPX, cycling games, free, open source, no subscription |
| IT | "app gratis rullo", "alternativa" | app rullo smart, ciclismo indoor, rullo, cambio virtuale, ERG, test FTP, allenamenti sul rullo, file FIT, gratis, open source, senza abbonamento |
| FR | "application home trainer gratuite" | application home trainer, vélo d'appartement, cyclisme en salle, vitesses virtuelles, ERG, test FTP, entraînement structuré, fichier FIT, gratuit, open source |
| ES | "app rodillo gratis" | app rodillo inteligente, ciclismo indoor, marchas virtuales, ERG, test FTP, entrenamientos, archivo FIT, gratis, código abierto |
| DE | "kostenlose App Rollentrainer" | Smart Trainer App, Rollentrainer, Indoor-Cycling, virtuelle Gänge, ERG, FTP-Test, Workouts, FIT-Datei, kostenlos, Open Source |

Parole di marca **solo in descrizione**, come "compatibile con": Zwift Click, Garmin, Strava, Van Rysel, Tacx, Wahoo (testo, mai loghi).
Parole da **non** usare nella scheda: "best", "#1", "no ads" [DA VERIFICARE se si vuole promettere l'assenza di pubblicità: nel codice non ci sono SDK pubblicitari, ma non è una promessa che la scheda debba fare], "official", "Zwift alternative" nel titolo.

---

## Verifica dei conteggi

Incolla in un terminale dalla radice del repo:

```sh
python3 - <<'EOF'
import re
t = open('docs/launch/play-store.md', encoding='utf-8').read()
for lang, body in re.findall(r'## ([^\n]+\((?:EN|IT|FR|ES|DE)\))\n(.*?)(?=\n---|\Z)', t, re.S):
    for label, lim in (('Titolo', 30), ('Breve', 80), ('Lunga', 4000), ('Novità', 500)):
        m = re.search(r'#### ' + label + r'[^\n]*\n```\n(.*?)\n```', body, re.S)
        n = len(m.group(1)) if m else -1
        print(f"{lang:14} {label:7} {n:5}/{lim}", 'OK' if 0 < n <= lim else 'ERRORE')
EOF
```
