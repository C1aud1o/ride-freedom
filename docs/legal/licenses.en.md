# Licences and credits

*Last updated: [DATE]*

Spindro is built on the work of others. This page lists what is **actually present** in the repository or loaded by the app, with its licence.

> List checked by reading the repository files (`package.json`, `package-lock.json`, `vendor/`, `assets/`, `android/`, `index.html`). It must be redone whenever a dependency or asset is added.

## Spindro's licence

Spindro's code is released under the **GNU GPL-3.0** licence *(planned licence: the `LICENSE` file still has to be added to the repository, task D6)*. Copyright © [YEAR] [NAME].

## Libraries included in the app

| Component | Version | Licence | Where |
|---|---|---|---|
| **three.js** (Mrdoob and the three.js authors) | r170 | MIT | `vendor/three/three.module.min.js` and `vendor/three/addons/` (GLTFLoader, EffectComposer, UnrealBloomPass and other effects). Text: `vendor/three/LICENSE`. © 2010-2024 three.js authors |
| **meshoptimizer** — decoder (Arseny Kapoulkine) | 0.18+ (copy from three r170) | MIT | `vendor/three/addons/libs/meshopt_decoder.module.js`: decompresses the optimised 3D models. Licence in the file header. |
| **Capacitor Core** (Drifty Co.) | 7.6.10 | MIT | `vendor/capacitor/capacitor.js` (build of `@capacitor/core`). Text: `vendor/capacitor/LICENSE`. © 2017-present Drifty Co. |
| **@capacitor/android** | 7.6.10 | MIT | `package.json` dependency, part of the Android app |
| **@capacitor-community/bluetooth-le** | 7.3.2 | MIT | `package.json` dependency, Bluetooth of the Android app |

Only used to build the app (not part of what you install):

| Component | Version | Licence |
|---|---|---|
| **@capacitor/cli** | 7.6.10 | MIT |

Android components of the project (`android/app/build.gradle`): **AndroidX** `appcompat`, `coordinatorlayout`, `core-splashscreen`, released by Google under the **Apache 2.0** licence. *[TO BE VERIFIED in the final dependency list of the release AAB]*

The licences of the other indirect dependencies in the lockfile (`package-lock.json`) are listed in that file.

## Fonts

| Component | Licence | How |
|---|---|---|
| **Barlow** and **Barlow Condensed** (The Barlow Project Authors) | SIL Open Font License 1.1 | Not in the repository. The page loads them from **Google Fonts** (`index.html`). If we self-host them in future, the OFL licence text must be included. |

## Graphics, 3D models and sounds

They come from **Kenney** ([kenney.nl](https://www.kenney.nl)) and **Quaternius** ([quaternius.com](https://quaternius.com)), under the **Creative Commons Zero (CC0 1.0)** licence: free to use, also commercially, credit not required. We gladly give it.

| Folder | Content | Files | Licence |
|---|---|---|---|
| `assets/3d/blasters/` | Blaster Kit 2.1 (weapons, crates, grenade) | 13 | CC0 |
| `assets/3d/characters/` | Blocky Characters 2.0 | 10 | CC0 |
| `assets/3d/graveyard/` | Graveyard Kit 5.0 (graveyard, monsters, trees) | 30 | CC0 |
| `assets/3d/nature/` | Nature Kit 2.1 (trees, rocks, plants) | 30 | CC0 |
| `assets/3d/pickups/` | Platformer Kit 4.1 (coins, heart, gem, star) | 4 | CC0 |
| `assets/3d/racing/` | Racing Kit 1.2 (barriers, flags, grandstands) | 30 | CC0 |
| `assets/3d/quaternius/` | **Quaternius**: Ultimate Modular Men (cyclist and crowd), Simple Nature Pack, Farm Buildings, Simple Buildings — converted and optimised | 26 | CC0 |
| `assets/audio/jingles/` | Music Jingles (game jingles) | 9 | CC0 |
| `assets/fx/` | Particle Pack (particles and effects) | 12 | CC0 |

Each folder contains the original `License.txt` file (Kenney's or Quaternius's, with the list of packs and changes).

**Thank you, Kenney and Quaternius.**

## Other resources

- **Icon and interface** (`icons/`, `css/`): original works of the project, under the same licence as the code.
- **Games**: they are original. They use no names or characters from other games.
- **FIT format**: the code that writes `.FIT` files was written from scratch from Garmin's public specification. It does not include Garmin's SDK.

## External services (not included in the code)

Strava, YouTube and Google Fonts are third-party services with their own terms. See also the [trademark notice](trademarks.en.md) and the [Privacy Policy](privacy.en.md).
