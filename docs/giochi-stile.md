# Stile dei giochi 3D di Spindro

Un solo stile per tutti i giochi. Si ottiene con modelli **low-poly CC0** (Quaternius, Kenney) e con il codice
condiviso in `js/games/kit/`. Il gioco di riferimento è **Turbo Pedali** (`js/games/racer3d.js`):
le foto sono in `docs/giochi-shots/`.

## 1. Idea
Giocattolo luminoso, pomeriggio d'estate, corsa vera. Forme semplici, colori pieni, luce calda.
Mai realistico, mai cupo. Niente loghi, nomi o personaggi di altri giochi.

## 2. Palette (`PALETTE` in `kit/style.js`)
| Uso | Colori |
|---|---|
| Marchio, giocatore, numeri importanti | lime `#d9ff3d`, inchiostro `#15141b` |
| Accenti HUD | ciano `#4de3ff` (scia, sprint), oro `#ffd34d` (avvisi), rosso `#ff5a6a` (salita dura, arrivo) |
| Avversari (maglie) | 10 colori saturi, uno per corridore, mai il lime |
| Mondo | erba `#86b84f`/`#5f9440`, asfalto `#5a5960`, terra `#c08a5b`, roccia `#a99a8c` |

Regola: il lime appartiene al giocatore. Nel mondo i colori sono più spenti dei personaggi.

## 3. Luce, cielo, nebbia
- Tre **ore del giorno** (`TIMES`): `morning`, `golden`, `dusk`. Una per livello.
- **Cielo a gradiente** con alone del sole (`skyDome`): alto, orizzonte, basso.
- **Luce**: emisfera (cielo/terra) + un sole con ombre che segue il giocatore (`styleLights`).
- **Nebbia** lineare del colore dell'orizzonte (`styleFog`, 80–520 m): nasconde il fondo e fa profondità.

## 4. Materiali
- **Toon** con rampa a 3 toni (`toonMaterial`): il sole fa ombre nette, l'emisfera dà il gradiente leggero.
- Colori per vertice invece di texture quando possibile: una geometria, un materiale, un draw call.
- Texture solo piccole (palette 32×32, scritte disegnate al volo).

## 5. Camera
- FOV 60° (in volata fino a ~75°: la velocità si sente).
- Inseguimento morbido 5–6 m dietro, 2 m sopra, sguardo 20 m avanti: si vede l'orizzonte.
- **Stacchi netti** per i momenti speciali (arrivo, podio), non carrellate lente.
- **Scossa** a trauma (`Shake`): urto 0,55, oggetto 0,35, via 0,3. Mai durante la lettura dei numeri.

## 6. HUD (in bici, telefono a 1 m)
- Numeri chiave **≥ 44 px** (watt e posizione 58 px), etichette ≥ 13 px, font condensato pesante, contorno scuro.
- Angoli fissi: posizione in alto a sinistra, **watt** in alto a destra (colore = zona), distanza al centro,
  pendenza in un riquadro colorato, marcia sotto la posizione, profilo in basso.
- Pannelli semitrasparenti, mai a tutto schermo durante la corsa.
- Nomi sopra gli avversari vicini: al massimo 4, senza sovrapposizioni.

## 7. Juice: ogni evento si vede e si sente
| Evento | Effetto |
|---|---|
| Moneta | scintilla, testo "+1", suono |
| Oggetto preso / usato | esplosione di particelle, hit-stop 0,05 s, scossa, FOV più largo |
| Scia | cuneo chiaro sull'asfalto dietro chi ti precede, linee di vento, "whoosh" |
| Sorpasso | suono, testo; negli ultimi 400 m un attimo di rallentatore |
| Ultimi 500 m | striscione, campanella |
| Arrivo | rallentatore 0,22× per ~2 s, coriandoli, stacco di camera |
| Podio | ciclisti in piedi, braccia alzate, coriandoli, tifo |
| + / − | marcia evidenziata nell'HUD, click del cambio |

Le particelle usano le texture Kenney di `assets/fx`. I suoni sono sintetizzati in `js/games/audio.js`.

## 8. Prestazioni
- Obiettivo **60 fps** su Android medio, **minimo 30**.
- **Draw call < 150**: istanze per tutto ciò che si ripete (`kit/env.js`), personaggio in una mesh sola.
- Triangoli in vista < 250k (alta), < 120k (bassa).
- Modelli **.glb ottimizzati** (gltf-transform: weld, semplificazione, quantizzazione, meshopt). Texture piccole.
- **Qualità automatica** (`kit/quality.js`): si misura il frame rate nei primi secondi e si scende di livello.

| Livello | Pixel ratio | Ombre | Bagliore | Densità oggetti | Pubblico |
|---|---|---|---|---|---|
| Alta | 1,5 | 1024 | sì | 100% | 100% |
| Media | 1,0 | 512 | no | 70% | 60% |
| Bassa | 0,75 | no | no | 40% | 30% |

Si può fissare in *Giochi → Qualità grafica*.

## 9. Asset
- Solo CC0 / MIT / OFL, con `License.txt` nella cartella e crediti in README e `docs/legal/licenses.*.md`.
- Personaggi: `assets/3d/quaternius/cyclist.glb` (scheletro vero) e `fan.glb` (versione leggera per il pubblico).
  Le pose si calcolano sulle ossa (IK delle gambe sui pedali), le maglie si colorano per vertice.
- Peso dei nuovi asset dei giochi: tenere ogni aggiunta sotto i 6 MB.
