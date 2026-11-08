# Contributing to Spindro

Thanks for wanting to help! Spindro is a free, open source web app and Android app for smart bike trainers
(Bluetooth FTMS, Tacx FE-C, Wahoo legacy). Every contribution is welcome: a new trainer model, a bug report,
a translation, a game idea, or a code fix.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first. For security issues, do not open a public issue:
see [SECURITY.md](SECURITY.md).

## Ways to help without writing code

- **Report your trainer.** Use the *Trainer compatibility* issue template: brand, model, firmware, phone and
  browser, and what works (connection, power, cadence, ERG, grade). This is the most useful thing you can do.
- **Report a bug.** Use the *Bug report* template. Include steps to reproduce and, if you can, the developer
  mode log.
- **Suggest a feature.** Use the *Feature request* template, or start a thread in Discussions first.
- **Translate** (coming soon, see below).

## Running the project locally

Requirements: Node.js 20 or newer. There is no build step for the web app: it is plain HTML, CSS and ES modules
served as static files.

```bash
git clone https://github.com/c1aud1o/ride-freedom.git
cd ride-freedom
npm ci
node tests/serve.mjs          # static server, no dependencies, default port 4173
```

Then open <http://127.0.0.1:4173/index.html>. Bluetooth needs a Chromium-based browser on HTTPS or `localhost`.

### Tests (Playwright)

```bash
npm run test:install          # downloads Chromium for Playwright (first time only)
npm test                      # starts the static server itself and runs tests/**/*.spec.mjs
```

If the Chromium version Playwright expects does not match a binary you already have, point the tests to it:

```bash
PW_CHROMIUM_PATH=/path/to/chromium npm test
```

To debug a failing test, run it again with `--trace on`. Traces are off by default because they slow the run.

Trainer drivers can be tested without a real trainer, using a simulated Bluetooth device:

```bash
node tests/trainers/run.mjs
```

See [tests/trainers/README.md](tests/trainers/README.md) for the simulated profiles (FE-C, Wahoo, FTMS).

### Android (optional)

```bash
npm run android:apk           # builds the web app, syncs Capacitor and runs the Gradle debug build
```

This needs the Android SDK and a JDK. Release signing keys are never stored in the repository.

## Project layout

| Path | Contents |
|---|---|
| `index.html`, `css/`, `icons/`, `manifest.webmanifest`, `sw.js` | Web app shell, styles, PWA manifest and service worker |
| `js/app.js` | Main application: screens, workout modes, game menu |
| `js/ftms.js` | FTMS trainer driver (the original, and the default) |
| `js/trainers/` | Protocol selection (`index.js`) and other drivers: `fec.js` (Tacx), `wahoo.js` (Wahoo legacy) |
| `js/games/` | In-app games (`planata.js`, `horde.js`, …) and shared helpers (`engine.js`, `base3d.js`, `kit3d.js`) |
| `js/*.js` | Other features: FIT recording, Strava, Garmin/Zwift support, gears, route, debug view |
| `assets/` | Sprites, sounds, 3D models; each folder has a `License.txt` with its origin |
| `vendor/` | Third-party libraries shipped as-is (Three.js, Capacitor) with their licences |
| `android/` | Capacitor Android project |
| `server/strava-worker/` | Optional Cloudflare Worker for the Strava OAuth flow |
| `tests/` | Playwright smoke tests, controller tests, simulated trainer (`tests/trainers/`) |
| `scripts/` | Build helpers (`copy-web.mjs`) |
| `docs/` | Design and technical notes |

## How to add a trainer (`js/trainers/`)

Most trainers already work through FTMS. Add a driver only when a trainer needs a different protocol.

1. **Create a driver** in `js/trainers/<name>.js`. It must follow the same public interface as the FTMS
   driver in `js/ftms.js`:
   - extends `EventTarget` and emits `connected`, `disconnected`, `data` and `log`;
   - has `connected` and `controllable` getters;
   - has `async setup(server)`, `disconnect()`, `setTargetPower(watts)`, `setResistancePercent(pct)`
     and `setSimulation({ grade, wind, crr, cw })`.
   Document the protocol source (spec, or open source code you compared) in the file header, as the existing
   drivers do.
2. **Detect it** in `chooseProtocol()` and `makeDriver()` in `js/trainers/index.js`. Keep the order of
   preference explained in the comment at the top of that file. Add a model name to `PREFER_FEC` only with
   evidence from a real trainer.
3. **Simulate it** in `tests/trainers/mock-bluetooth.js`: add a profile with the same services and
   characteristics the real trainer advertises, then add the test cases in `tests/trainers/run.mjs`.
4. **Record what you verified** in `tests/trainers/README.md` under "to verify with a real trainer", and say
   which parts are only tested with the simulator.

Pure logic (byte encoding, parsing) should be exported as plain functions so it can be tested without
Bluetooth.

## How to add a game (`js/games/`)

1. **Write the game** as a new file in `js/games/`, for example `js/games/mygame.js`. Look at `planata.js`
   (3D, based on `base3d.js`) or `horde.js` for the pattern. Use the shared helpers in `engine.js` and
   `kit3d.js` instead of copying them. Games receive the canvas, the game hooks and the audio object, and use
   power, cadence and gradient from the trainer.
2. **Register it** in `js/app.js`: add the `import`, then an entry in the `games` map with `game`, `title` and
   `help` (the one-line control hint). Keep the title and hint short.
3. **Test it**: add a smoke check to `tests/smoke.spec.mjs` that opens the game and checks it starts without
   errors.
4. **Describe it** in `docs/giochi.md` (design notes), briefly.

Use only original art and sounds, or assets with a licence that allows redistribution. Add the licence and
source of any new asset next to it (`License.txt`), and to the licences page.

## Translations (coming soon)

The app's interface text is currently in Italian, and the English version is in progress. Translations are
planned as JSON files in `locales/` (for example `locales/en.json`, `locales/de.json`), with one key per
user-visible string.

Glossary and naming rules (for example how to translate "trainer", "ERG" or "gears") will be in
`docs/i18n-glossario.md`, which is not in the repository yet. Until it is, ask in an issue or a discussion
before translating terms like "ERG", "FTMS" or "trainer".

## Code and commit rules

### Developer Certificate of Origin (DCO)

We do not use a CLA. Instead, every commit must be signed off with the
[Developer Certificate of Origin 1.1](https://developercertificate.org/): a line saying you wrote the code, or
have the right to submit it under the project licence (GPL-3.0).

Add it with `-s`:

```bash
git commit -s -m "Short summary of the change"
```

This adds `Signed-off-by: Your Name <you@example.com>` to the message. Commits without it cannot be merged.
If you forgot, amend with `git commit --amend -s` (or `git rebase --signoff` for several commits).

### Commit messages

- Write in English, in the imperative mood: "Add Wahoo KICKR Core profile", not "Added".
- Subject line up to 72 characters, then a blank line.
- Body: explain **why** the change is needed, if it is not obvious from the diff.
- One logical change per commit.

### Pull requests

- Keep them small: one feature or fix, ideally under about 400 changed lines. Split larger work into steps.
- Link the issue the PR addresses (`Closes #123`).
- Fill in the checklist in the PR template.
- Tests must pass (`npm test`). Do not disable or skip a test to get a green build; if a test is wrong,
  explain why in the PR.
- For UI changes, add a screenshot or a short recording taken at phone width.
- Do not commit secrets, keys, tokens, or personal data (including Strava or Garmin credentials, or test
  activity files with your location).

### Licence

By contributing you agree that your contribution is licensed under the GNU General Public License v3.0
(see [LICENSE](LICENSE)). The copyright is held by The Spindro contributors.

## Questions

Use [GitHub Discussions](../../discussions) for questions and ideas, and Issues for bugs and concrete
requests. Maintainers reply as time allows.
