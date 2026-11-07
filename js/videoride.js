// PEDALA SU UN VIDEO — un video di un percorso (YouTube o un file del telefono/PC) che scorre
// alla tua velocità: ti fermi e si ferma, acceleri e accelera. + / − restano il cambio.
import { hudText } from './games/engine.js';

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/;
const REF_KMH = [{ v: 15, t: 'Corsa a piedi / salita' }, { v: 25, t: 'Bici tranquilla' }, { v: 32, t: 'Bici veloce' }];

export class VideoRide {
  constructor(hudCanvas, hooks) {
    this.hud = hudCanvas; this.hooks = hooks; this.active = false;
    this.ref = Number(localStorage.getItem('videoRef')) || 25;
    this.loop = this.loop.bind(this);
  }

  start() {
    this.active = true; this.rate = 1; this.playing = false;
    const panel = this.hud.parentElement;
    this.box = document.createElement('div'); this.box.className = 'video-box';
    panel.insertBefore(this.box, this.hud);
    this.ui = document.createElement('div'); this.ui.className = 'video-pick';
    const last = localStorage.getItem('videoLast') || '';
    this.ui.innerHTML = `
      <h2>Pedala su un video</h2>
      <p>Incolla il link di un video YouTube di un percorso in bici (cerca per esempio "cycling 4K" o "virtual ride"), oppure scegli un video dal dispositivo. Il video scorre alla tua velocità.</p>
      <label class="field"><span>Link YouTube</span><input id="vrUrl" type="url" inputmode="url" placeholder="https://youtu.be/…" value="${last.replace(/"/g, '')}"></label>
      <div class="row2"><button id="vrGo" class="cta-sm">Guarda</button><button id="vrPaste" class="ghost">Incolla link</button></div>
      <a class="ghost vr-search" href="https://www.youtube.com/results?search_query=virtual+cycling+4k" target="_blank" rel="noopener">Cerca su YouTube</a>
      <p class="fine vr-how">${window.Capacitor?.isNativePlatform?.()
    ? '<b>Dall\'app YouTube:</b> apri il video, premi <b>Condividi</b> e scegli <b>Ride Freedom</b>: torni qui e il video parte da solo.'
    : '<b>Da YouTube:</b> apri il video, premi <b>Condividi → Copia link</b>, torna qui e premi <b>Incolla link</b>.'}</p>
      <label class="ghost file-btn">Video dal dispositivo<input id="vrFile" type="file" accept="video/*" hidden></label>
      <p class="fine">Velocità a cui è stato girato il video:</p>
      <div class="chips" id="vrRef">${REF_KMH.map((r) => `<button data-v="${r.v}" class="${r.v === this.ref ? 'on' : ''}">${r.v} km/h<small>${r.t}</small></button>`).join('')}</div>
      <p class="fine">Netflix, Prime Video e simili non si possono mettere dentro un'altra app (protezione dei contenuti): usa lo schermo diviso del telefono e la musica si comanda dal Click (Impostazioni → Musica).</p>`;
    panel.appendChild(this.ui);
    this.ui.querySelector('#vrGo').addEventListener('click', () => this.openUrl(this.ui.querySelector('#vrUrl').value));
    this.ui.querySelector('#vrPaste').addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        this.ui.querySelector('#vrUrl').value = t.trim();
        if (YT_RE.test(t)) this.openUrl(t.trim());
      } catch { this.ui.querySelector('#vrUrl').focus(); }
    });
    this.ui.querySelector('#vrFile').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) this.openFile(f); });
    this.ui.querySelectorAll('#vrRef button').forEach((b) => b.addEventListener('click', () => {
      this.ref = Number(b.dataset.v); localStorage.setItem('videoRef', this.ref);
      this.ui.querySelectorAll('#vrRef button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    this.ctx = this.hud.getContext('2d');
    this.resize(); this.onResize = () => this.resize(); window.addEventListener('resize', this.onResize);
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.active = false;
    window.removeEventListener('resize', this.onResize);
    try { this.yt?.destroy(); } catch { /* già chiuso */ }
    if (this.video?.src?.startsWith('blob:')) URL.revokeObjectURL(this.video.src);
    this.box?.remove(); this.ui?.remove(); this.yt = null; this.video = null;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.hud.width, this.hud.height);
    this.hooks.setGrade(null);
  }

  resize() {
    const r = this.hud.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width; this.H = r.height;
    this.hud.width = Math.round(r.width * dpr); this.hud.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // + / − cambiano marcia come fuori dai giochi
  input(dir) { if (this.ui && !this.ui.hidden) return; this.hooks.shift?.(dir); }

  openUrl(url) {
    const id = (url.match(YT_RE) || [])[1] || (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null);
    if (!id) { this.ui.querySelector('#vrUrl').setCustomValidity('Link YouTube non valido'); this.ui.querySelector('#vrUrl').reportValidity(); return; }
    localStorage.setItem('videoLast', url);
    this.ui.hidden = true; this.kind = 'yt';
    this.box.innerHTML = '<div id="vrYt"></div>';
    loadYouTubeApi().then((YT) => {
      if (!this.active) return;
      this.yt = new YT.Player('vrYt', {
        videoId: id, width: '100%', height: '100%',
        playerVars: { origin: location.origin, playsinline: 1, controls: 0, rel: 0, modestbranding: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
        events: {
          onReady: () => { this.yt.mute(); this.yt.playVideo(); this.ready = true; },
          onError: (e) => { this.error = `YouTube non permette di mostrare questo video qui (errore ${e.data}). Provane un altro.`; },
        },
      });
    }).catch(() => { this.error = 'Impossibile caricare YouTube (serve internet).'; });
  }

  openFile(file) {
    this.ui.hidden = true; this.kind = 'file';
    this.video = document.createElement('video');
    this.video.src = URL.createObjectURL(file); this.video.muted = true; this.video.playsInline = true; this.video.loop = true;
    this.box.innerHTML = ''; this.box.appendChild(this.video);
    this.video.play().catch(() => {});
    this.ready = true;
  }

  // la velocità del video segue la tua: sotto i 3 km/h si ferma
  sync() {
    if (!this.ready) return;
    const kmh = this.hooks.connected() ? this.hooks.speedKmh() : 25;
    const want = kmh < 3 ? 0 : Math.max(0.25, Math.min(2, kmh / this.ref));
    if (this.kind === 'file' && this.video) {
      if (!want) { if (!this.video.paused) this.video.pause(); } else {
        if (this.video.paused) this.video.play().catch(() => {});
        if (Math.abs(this.video.playbackRate - want) > 0.02) this.video.playbackRate = want;
      }
      this.rate = want;
    } else if (this.kind === 'yt' && this.yt?.getPlayerState) {
      // YouTube accetta solo alcuni valori (0.25 … 2 a passi di 0.25)
      const q = want ? Math.max(0.25, Math.round(want * 4) / 4) : 0;
      const st = this.yt.getPlayerState();
      if (!q) { if (st === 1) this.yt.pauseVideo(); } else {
        if (st !== 1 && st !== 3) this.yt.playVideo();
        if (q !== this.rate) this.yt.setPlaybackRate(q);
      }
      this.rate = q;
    }
  }

  loop() {
    if (!this.active) return;
    this.syncT = (this.syncT || 0) + 1;
    if (this.syncT % 15 === 0) this.sync();
    const { ctx, W, H } = this; ctx.clearRect(0, 0, W, H);
    if (this.ui.hidden) {
      const st = this.hooks.stats();
      const kmh = this.hooks.connected() ? this.hooks.speedKmh() : 0;
      ctx.fillStyle = 'rgba(10,10,10,.55)'; ctx.fillRect(12, H - 92, W - 24, 70);
      const cells = [[`${Math.round(st.power)}`, 'W'], [`${Math.round(st.cadence)}`, 'rpm'], [kmh.toFixed(1), 'km/h'], [st.gear ? `${st.gear}` : '–', 'marcia']];
      cells.forEach(([v, u], i) => {
        const x = 12 + (W - 24) * (i + 0.5) / 4;
        hudText(ctx, v, x, H - 54, { size: 26, align: 'center', color: i === 0 ? '#d9ff3d' : '#fff' });
        hudText(ctx, u, x, H - 34, { size: 11, align: 'center', color: '#ccc' });
      });
      hudText(ctx, this.rate ? `video ×${this.rate.toFixed(2)}` : 'video in pausa: pedala!', W - 16, 76, { size: 13, align: 'right', color: this.rate ? '#fff' : '#ffd34d' });
      if (!this.hooks.connected()) hudText(ctx, 'Rullo non connesso: il video scorre a velocità normale', W / 2, 100, { size: 12, align: 'center', color: '#ffd34d' });
      if (this.error) hudText(ctx, this.error, W / 2, H / 2, { size: 13, align: 'center', color: '#ff6b6b' });
    }
    requestAnimationFrame(this.loop);
  }
}

let ytPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { ytPromise = null; reject(new Error('yt')); };
    document.head.appendChild(s);
  });
  return ytPromise;
}
