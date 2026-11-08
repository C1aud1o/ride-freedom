---
title: "How I made a browser talk to a smart bike trainer (Web Bluetooth, FTMS, Capacitor, Three.js)"
published: false
description: "Notes from building a free, open-source smart trainer app: FTMS parsing, serialising GATT writes, virtual gears, a navigator.bluetooth shim for Android, and pedal-powered 3D games."
tags: webdev, javascript, bluetooth, opensource
canonical_url:
---

<!-- Bozza (G4). NON pubblicata. Articolo ~1200 parole di prosa + codice. I frammenti sono presi dal repo
     c1aud1o/ride-freedom alla data 2026-11-07; se il codice cambia, ricontrollarli. Prima di pubblicare:
     [DA VERIFICARE] LICENSE nel repo, URL dei link, e riempire i campi [TUO]. -->

I have a budget smart trainer and I didn't want a monthly subscription just to ride it. So I wrote an app. It runs in Chrome/Edge as a PWA, as an Android app, and the interesting part is that **it is the same JavaScript** in both places. This post is a tour of the parts that were harder than I expected. Everything is open source (GPL-3.0). The snippets below are abridged from the real files (`js/ftms.js`, `js/gears.js`, `js/trainers/index.js`, `js/native.js`, `js/fit.js`).

> Honest status: it's one person's project, tested mostly on one trainer (a Van Rysel D100). The Tacx FE-C and old-Wahoo drivers are written and pass tests against a *simulated* trainer, but have never touched real hardware. The UI is Italian-only for now.

## 1. A trainer is just a GATT server

Most smart trainers made since about 2020 implement the Bluetooth **Fitness Machine Service (FTMS, 0x1826)**. Web Bluetooth lets a page request a device that exposes it:

```js
this.device = await navigator.bluetooth.requestDevice({
  filters: [{ services: [FTMS] }, { services: [CPS] }, { namePrefix: 'D100' }],
  optionalServices: [FTMS, CPS, CSC, HRS],
});
```

Two gotchas. First, `optionalServices` must list every service you will touch later, or `getPrimaryService` fails with a security error. Second, `requestDevice` needs a user gesture, so "connect" has to be a button.

After connecting, you subscribe to the *Indoor Bike Data* characteristic (0x2AD2) and parse it yourself. It's a bitfield: a 16-bit flags word says which fields follow, and some bits are *inverted* (bit 0 set means "no instantaneous speed here"):

```js
onIndoorBikeData(v) {
  const flags = v.getUint16(0, true);
  let o = 2;
  const d = {};
  if (!(flags & 0x0001)) { d.speed = v.getUint16(o, true) / 100; o += 2; }
  if (flags & 0x0002) o += 2; // average speed
  if (flags & 0x0004) { d.cadence = v.getUint16(o, true) / 2; o += 2; }
  if (flags & 0x0008) o += 2; // average cadence
  ...
```

You have to walk the offset by hand and skip fields you don't need. Getting one `o += 2` wrong shifts every later value, and you get plausible-looking nonsense. My debugging aid was a page that shows the raw bytes next to the parsed values.

## 2. Commands must be serialised (or trainers silently ignore you)

To control the trainer you write to the *Control Point* (0x2AD9): `0x00` request control, `0x05` set target power, `0x11` set simulation (grade, wind, Crr, CdA). The control point is request/response, and trainers don't queue. If you fire two writes without waiting for the response indication, the second is often dropped with no error.

The fix is a promise queue that waits for the matching response (with a timeout, because some trainers don't always answer):

```js
command(bytes) {
  const run = () => new Promise((resolve, reject) => {
    if (!this.cp) return reject(new Error('Trainer not controllable'));
    const op = bytes[0];
    const timer = setTimeout(() => { this.pending = null; resolve(); }, 1500);
    this.pending = { op, resolve, reject, timer };
    this.cp.writeValueWithResponse(new Uint8Array(bytes)).catch((err) => {
      clearTimeout(timer); this.pending = null; reject(err);
    });
  });
  const p = this.queue.then(run, run);
  this.queue = p.catch(() => {});
  return p;
}
```

`setTargetPower` is then three bytes, power as little-endian `uint16`:

```js
setTargetPower(watts) {
  const [min, max] = this.ranges.power;
  const w = Math.round(Math.min(Math.max(watts, Math.max(min, 0)), max || 600));
  return this.command([OP.setTargetPower, w & 0xff, (w >> 8) & 0xff]);
}
```

## 3. "Virtual gears" are 20 lines of physics

I wanted the feel of shifting gears. The trick: pretend you're on a real bike. Virtual speed comes from cadence × gear ratio × wheel circumference, and a standard power model gives the watts that speed would need at the current grade. Then I put the trainer in ERG mode and send that number:

```js
export const GEARS = Array.from({ length: 24 }, (_, i) =>
  +(0.75 * Math.pow(5.5 / 0.75, i / 23)).toFixed(2));

export function virtualSpeed(cadence, ratio) {
  return (cadence / 60) * ratio * WHEEL; // m/s
}

export function powerForSpeed(v, { grade = 0, mass = 80, cda = 0.32, crr = 0.004, efficiency = 0.97 } = {}) {
  const theta = Math.atan(grade / 100);
  const fGravity = mass * G * Math.sin(theta);
  const fRolling = mass * G * Math.cos(theta) * crr;
  const fAero = 0.5 * RHO * cda * v * v;
  return Math.max(0, ((fGravity + fRolling + fAero) * v) / efficiency);
}
```

Pedal faster or shift up, virtual speed rises, aero drag grows with v², and the target watts go up. It feels like gears because it *is* the same equation. An optional "auto shift" picks the gear that holds your target cadence.

## 4. One driver interface, several protocols

Older Tacx trainers speak ANT+ FE-C tunnelled over BLE, and pre-2020 Wahoo trainers use a proprietary control point. Each lives in its own driver exposing the same methods (`setTargetPower`, `setSimulation`, `setResistancePercent`). A pure function picks which to use, FTMS first because it's the best-trodden path:

```js
export function chooseProtocol({ ftms, fec, wahoo }, { name = '', force = 'auto' } = {}) {
  const avail = { ftms, fec, wahoo };
  if (force && force !== 'auto' && avail[force]) return force;
  if (fec && PREFER_FEC.some((p) => name.startsWith(p))) return 'fec';
  if (ftms) return 'ftms';
  if (fec) return 'fec';
  if (wahoo) return 'wahoo';
  return 'basic';
}
```

Being pure, it's trivially testable. I test the drivers against a fake BLE device in Playwright, which also keeps me honest about what's *not* tested on real hardware.

## 5. Android WebView has no Web Bluetooth

Wrapping the PWA with Capacitor gave me a WebView, and WebView has no `navigator.bluetooth`. Rather than fork the app, I install an object that implements the parts of the Web Bluetooth API I use, on top of the community BLE plugin:

```js
const bluetooth = {
  async getAvailability() { return true; },
  async requestDevice(opts = {}) {
    await init();
    const services = [];
    for (const f of opts.filters || []) {
      if (f.services) services.push(...f.services.map(uuid));
    }
    const req = services.length ? { services: [...new Set(services)] } : {};
    req.optionalServices = (opts.optionalServices || []).map(uuid);
    const d = await BLE.requestDevice(req);
    return new NativeDevice(d.deviceId, d.name || 'Device');
  },
};
Object.defineProperty(navigator, 'bluetooth', { value: bluetooth, configurable: true });
```

Characteristics are small classes with `readValue`, `writeValueWithResponse`, `startNotifications` and a `characteristicvaluechanged` event, the plugin passes hex strings, so there's a `hexToDV` helper. The trainer code never learns which world it's in. Native GATT calls also have to be serialised (same lesson as §2).

## 6. The phone as a power meter for your watch

Android *can* be a BLE peripheral. A small Java plugin opens a GATT server and advertises Cycling Power (0x1818) and Cycling Speed & Cadence (0x1816), so a watch or bike computer sees the phone as a sensor and records the ride. The data comes from the trainer, passes through the app, and goes back out as standard services. This part is Android-only.

## 7. Writing .FIT files by hand

The ride is saved as a Garmin `.FIT` file. The format is public: a header, definition messages, data messages and a CRC. The encoder is about 165 lines. The CRC is a 16-entry table:

```js
function crc16(bytes, crc = 0) {
  for (const b of bytes) {
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
  }
  return crc;
}
```

Only the official FIT SDK is used in tests, to validate my output. The file imports into Garmin Connect and Strava.

## 8. Games where pedalling is the controller

Because I was bored on long endurance rides, I added 3D games where watts and cadence replace the gamepad: a road stage with AI riders and drafting, a side-scroller, a horde shooter. They use Three.js as plain ES modules (an import map, no bundler) and CC0 models from Kenney. Each game extends a small `Base3D` class that owns the loop, menu, HUD text and sensor input, so a new game is mostly `build()` and `step(dt)`.

## What I'd like from you

- If you own a Tacx or an older Wahoo: does it connect? The in-app "Report a problem" button opens a prefilled GitHub issue.
- Any review of the BLE layer. I know it's rough in places.
- Translations: the interface is Italian-only right now.

**Source:** https://github.com/c1aud1o/ride-freedom
**Try it (Chrome/Edge, or the Android APK from the repo):** https://mta-world.com/?ref=devto

*Zwift, Garmin, Strava, Tacx, Wahoo and Van Rysel are trademarks of their owners; this project is independent and not affiliated with them.*
