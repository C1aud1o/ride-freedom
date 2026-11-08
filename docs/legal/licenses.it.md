# Licenze e crediti

*Ultimo aggiornamento: [DATA]*

Spindro è costruito con il lavoro di altri. Questa pagina elenca ciò che è **realmente presente** nel repository o caricato dall'app, con la sua licenza.

> Elenco verificato leggendo i file del repository (`package.json`, `package-lock.json`, `vendor/`, `assets/`, `android/`, `index.html`). Va rifatto a ogni nuova dipendenza o asset.

## Licenza di Spindro

Il codice di Spindro è rilasciato con licenza **GNU GPL-3.0** *(licenza prevista: il file `LICENSE` va aggiunto al repository, attività D6)*. Copyright © [ANNO] [NOME].

## Librerie incluse nell'app

| Componente | Versione | Licenza | Dove |
|---|---|---|---|
| **three.js** (Mrdoob e autori di three.js) | r170 | MIT | `vendor/three/three.module.min.js` e `vendor/three/addons/` (GLTFLoader, EffectComposer, UnrealBloomPass e altri effetti). Testo: `vendor/three/LICENSE`. © 2010-2024 three.js authors |
| **meshoptimizer** — decoder (Arseny Kapoulkine) | 0.18+ (copia di three r170) | MIT | `vendor/three/addons/libs/meshopt_decoder.module.js`: decomprime i modelli 3D ottimizzati. Licenza nell'intestazione del file. |
| **Capacitor Core** (Drifty Co.) | 7.6.10 | MIT | `vendor/capacitor/capacitor.js` (build di `@capacitor/core`). Testo: `vendor/capacitor/LICENSE`. © 2017-present Drifty Co. |
| **@capacitor/android** | 7.6.10 | MIT | Dipendenza di `package.json`, parte dell'app Android |
| **@capacitor-community/bluetooth-le** | 7.3.2 | MIT | Dipendenza di `package.json`, Bluetooth dell'app Android |

Solo per costruire l'app (non fanno parte di ciò che installi):

| Componente | Versione | Licenza |
|---|---|---|
| **@capacitor/cli** | 7.6.10 | MIT |

Componenti Android del progetto (`android/app/build.gradle`): **AndroidX** `appcompat`, `coordinatorlayout`, `core-splashscreen`, rilasciati da Google con licenza **Apache 2.0**. *[DA VERIFICARE nel file delle dipendenze finale dell'AAB di release]*

Le licenze delle altre dipendenze indirette del lockfile (`package-lock.json`) sono in quel file.

## Caratteri

| Componente | Licenza | Come |
|---|---|---|
| **Barlow** e **Barlow Condensed** (The Barlow Project Authors) | SIL Open Font License 1.1 | Non sono nel repository. La pagina li carica da **Google Fonts** (`index.html`). Se in futuro li ospitiamo noi, va inclusa la licenza OFL. |

## Grafica, modelli 3D e suoni

Provengono da **Kenney** ([kenney.nl](https://www.kenney.nl)) e da **Quaternius** ([quaternius.com](https://quaternius.com)), con licenza **Creative Commons Zero (CC0 1.0)**: uso libero anche commerciale, il credito non è obbligatorio. Lo diamo volentieri.

| Cartella | Contenuto | File | Licenza |
|---|---|---|---|
| `assets/3d/blasters/` | Blaster Kit 2.1 (armi, casse, granata) | 13 | CC0 |
| `assets/3d/characters/` | Blocky Characters 2.0 | 10 | CC0 |
| `assets/3d/graveyard/` | Graveyard Kit 5.0 (cimitero, mostri, alberi) | 30 | CC0 |
| `assets/3d/nature/` | Nature Kit 2.1 (alberi, rocce, piante) | 30 | CC0 |
| `assets/3d/pickups/` | Platformer Kit 4.1 (monete, cuore, gemma, stella) | 4 | CC0 |
| `assets/3d/racing/` | Racing Kit 1.2 (barriere, bandiere, tribune) | 30 | CC0 |
| `assets/3d/quaternius/` | **Quaternius**: Ultimate Modular Men (ciclista e pubblico), Simple Nature Pack, Farm Buildings, Simple Buildings — convertiti e ottimizzati | 26 | CC0 |
| `assets/audio/jingles/` | Music Jingles (musichette dei giochi) | 9 | CC0 |
| `assets/fx/` | Particle Pack (particelle ed effetti) | 12 | CC0 |

Ogni cartella contiene il file `License.txt` originale (di Kenney o di Quaternius, con l'elenco dei pacchetti e delle modifiche).

**Grazie, Kenney e Quaternius.**

## Altre risorse

- **Icona e interfaccia** (`icons/`, `css/`): opere originali del progetto, sotto la stessa licenza del codice.
- **Giochi**: sono originali. Non usano nomi o personaggi di altri giochi.
- **Formato FIT**: il codice che scrive i file `.FIT` è stato scritto da zero in base alla specifica pubblica di Garmin. Non include l'SDK di Garmin.

## Servizi esterni (non incluse nel codice)

Strava, YouTube e Google Fonts sono servizi di terzi con le loro condizioni. Vedi anche la [nota sui marchi](trademarks.it.md) e l'[Informativa sulla privacy](privacy.it.md).
