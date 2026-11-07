const CACHE = 'ride-freedom-v24';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/ftms.js', 'js/click.js', 'js/gears.js', 'js/hr.js', 'js/fit.js', 'js/native.js', 'js/build.js', 'js/powermeter.js', 'vendor/capacitor/capacitor.js', 'js/strava.js', 'js/config.js', 'js/debug.js', 'js/debugview.js', 'js/games/engine.js', 'js/games/audio.js', 'js/games/strike.js', 'js/games/racer3d.js', 'js/games/kit3d.js', 'js/games/horde.js', 'js/games/strike3d.js', 'js/games/progress.js', 'js/watchguide.js', 'js/games/base3d.js', 'js/games/gruppetto.js', 'js/games/mattoni.js', 'js/games/planata.js', 'js/videoride.js', 'js/workouts.js', 'js/history.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rete prima, cache come riserva (così gli aggiornamenti arrivano subito)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
