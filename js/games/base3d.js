// Base comune dei giochi 3D "semplici": ciclo, menu, fine partita, sensori, testi a comparsa.
// Ogni gioco implementa: assets(), build(), reset(), press(dir), step(dt), view(dt), hud(ctx, W, H) e summary().
import { THREE, Stage, loadAll } from './kit3d.js';
import { hudText, Effort, clamp } from './engine.js';
import { SONGS } from './audio.js';

export class Base3D {
  constructor(hudCanvas, hooks, audio, { key, title, tagline, rules, song = 'race' }) {
    Object.assign(this, { hudCanvas, hooks, audio, key, title, tagline, rules, songName: song });
    this.active = false; this.best = Number(localStorage.getItem(`${key}Best`)) || 0;
    this.loop = this.loop.bind(this);
  }

  async start() {
    this.active = true; this.camInit = false;
    this.stage = new Stage(this.hudCanvas);
    this.effort = new Effort();
    this.state = 'loading'; this.t = 0; this.texts = []; this.pops = []; this.held = 0; this.heldT = 0;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
    this.audio.playSong(SONGS.menu);
    try {
      this.m = await loadAll(this.assets(), (p) => { this.loadPct = p; });
      if (!this.active) return;
      this.build(); this.reset();
      this.state = 'menu'; this.stateT = 0;
    } catch (err) { this.state = 'error'; this.error = err.message; }
  }

  stop() { this.active = false; this.audio.stopSong(); this.hooks.setGrade(null); this.stage?.dispose(); }

  input(dir) {
    this.audio.ensure();
    if (this.state === 'menu') { if (dir > 0 && this.stateT > 0.4) this.begin(); return; }
    if (this.state === 'over') { if (this.stateT > 1.2) { this.reset(); this.begin(); } return; }
    if (this.state === 'play') this.press(dir);
  }

  hold(dir) { this.held = dir; this.heldT = 0; }

  begin() {
    this.state = 'play'; this.stateT = 0; this.score = 0;
    this.audio.playSong(SONGS[this.songName] || SONGS.race); this.audio.sfx('go');
    this.onBegin?.();
  }

  end(extraXp = 0) {
    if (this.state !== 'play') return;
    this.score = Math.round(this.score);
    this.state = 'over'; this.stateT = 0;
    this.audio.stopSong(); this.audio.sfx('lose');
    this.newBest = this.score > this.best;
    if (this.newBest) { this.best = this.score; localStorage.setItem(`${this.key}Best`, this.best); this.audio.sfx('win'); }
    this.hooks.progress?.event('races', 0, 20 + extraXp);
    this.hooks.setGrade(0);
  }

  say(text, color = '#ffd34d', t = 1.6, big = false) { this.texts.push({ text, color, t, big }); }
  pop(text, color, x, y, z, t = 0.9) { this.pops.push({ text, color, x, y, z, t, t0: t }); }
  prog(stat, n = 1, xp = 0) { this.hooks.progress?.event(stat, n, xp); }

  // legge rullo e sensori (in demo valori finti, così si può provare senza rullo)
  sense(dt) {
    const connected = this.hooks.connected(); const st = this.hooks.stats();
    const demo = !connected;
    this.connected = connected;
    this.power = demo ? (this.demoPower?.() ?? 170 + 60 * Math.sin(this.t * 0.6)) : st.power || 0;
    this.cadence = demo ? 88 : st.cadence || 0;
    this.kmh = demo ? 28 : this.hooks.speedKmh();
    this.sprinting = this.effort.update(this.power, dt, demo ? 0 : 50);
    if (this.audio.song) this.audio.setTempo(this.audio.song.bpm * clamp((this.cadence || 85) / 88, 0.85, 1.25));
  }

  // sterzata continua: un tocco = passo singolo, tenuto premuto = movimento fluido
  steer(dt, speed) {
    if (!this.held) return 0;
    this.heldT += dt;
    return this.heldT > 0.12 ? this.held * speed * dt : 0;
  }

  loop(now) {
    if (!this.active) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now; this.t += dt;
    this.sense(dt);
    this.texts.forEach((x) => { x.t -= dt; }); this.texts = this.texts.filter((x) => x.t > 0);
    if (this.state !== 'loading' && this.state !== 'error') {
      this.stateT += dt;
      if (this.state === 'play') this.step(dt);
      this.view(dt);
      this.stage.render();
    }
    this.drawHud(dt);
    requestAnimationFrame(this.loop);
  }

  drawHud(dt) {
    const { ctx, W, H } = this.stage;
    ctx.clearRect(0, 0, W, H);
    if (this.state === 'loading') { ctx.fillStyle = '#0f0e0c'; ctx.fillRect(0, 0, W, H); hudText(ctx, 'CARICAMENTO…', W / 2, H / 2, { size: 22, align: 'center', color: '#d9ff3d' }); hudText(ctx, `${Math.round((this.loadPct || 0) * 100)}%`, W / 2, H / 2 + 28, { size: 14, align: 'center' }); return; }
    if (this.state === 'error') { hudText(ctx, `Errore: ${this.error}`, W / 2, H / 2, { size: 14, align: 'center', color: '#ff6b6b' }); return; }
    if (this.state === 'menu') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(8,10,16,.85)'); g.addColorStop(0.45, 'rgba(8,10,16,.15)'); g.addColorStop(1, 'rgba(8,10,16,.92)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      hudText(ctx, this.title, W / 2, 120, { size: 50, align: 'center', color: '#d9ff3d' });
      hudText(ctx, this.tagline, W / 2, 150, { size: 15, align: 'center' });
      this.rules.forEach((l, i) => hudText(ctx, '· ' + l, W / 2, H * 0.62 + i * 20, { size: 12, align: 'center', color: '#e8e8e8' }));
      hudText(ctx, `Record: ${this.best}`, W / 2, H * 0.62 + this.rules.length * 20 + 14, { size: 12, align: 'center', color: '#bbb' });
      hudText(ctx, '+  INIZIA', W / 2, H - 50, { size: 20, align: 'center', color: '#d9ff3d' });
      this.hooks.progress?.drawToasts(ctx, W, dt);
      return;
    }
    this.hud(ctx, W, H, dt);
    const v3 = new THREE.Vector3();
    for (const p of this.pops) {
      p.t -= dt; const k = 1 - p.t / p.t0;
      v3.set(p.x, p.y + k * 1.8, p.z).project(this.stage.camera);
      ctx.globalAlpha = clamp((p.t / p.t0) * 2, 0, 1);
      hudText(ctx, p.text, (v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H, { size: 20, align: 'center', color: p.color });
      ctx.globalAlpha = 1;
    }
    this.pops = this.pops.filter((p) => p.t > 0);
    let ty = H * 0.34;
    for (const x of this.texts) {
      ctx.globalAlpha = Math.min(1, x.t * 3);
      hudText(ctx, x.text, W / 2, ty, { size: x.big ? 28 : 15, color: x.color, align: 'center' }); ty += x.big ? 34 : 22;
      ctx.globalAlpha = 1;
    }
    if (!this.connected) hudText(ctx, 'DEMO: rullo non connesso', W / 2, H - 12, { size: 11, align: 'center', color: '#ffd34d' });
    if (this.state === 'over') {
      ctx.fillStyle = 'rgba(8,8,14,.8)'; ctx.fillRect(0, 0, W, H);
      const [head, ...lines] = this.summary();
      hudText(ctx, head, W / 2, H * 0.32, { size: 30, align: 'center', color: '#d9ff3d' });
      hudText(ctx, `Punti ${Math.round(this.score)}${this.newBest ? '  · RECORD!' : ''}`, W / 2, H * 0.32 + 40, { size: 18, align: 'center' });
      lines.forEach((l, i) => hudText(ctx, l, W / 2, H * 0.32 + 66 + i * 22, { size: 13, align: 'center', color: '#e8e8e8' }));
      if (this.stateT > 1.2) hudText(ctx, '+  RIPROVA', W / 2, H * 0.32 + 150, { size: 20, align: 'center', color: '#d9ff3d' });
    }
    this.hooks.progress?.drawToasts(ctx, W, dt);
  }

  // barra potenza standard con soglia sprint
  powerBar(ctx, x, y, w) {
    ctx.fillStyle = 'rgba(10,8,16,.6)'; ctx.fillRect(x, y, w, 12);
    const maxW = Math.max(400, (this.effort.threshold || 200) * 1.6);
    ctx.fillStyle = this.sprinting ? '#4de3ff' : '#d9ff3d'; ctx.fillRect(x, y, w * clamp(this.power / maxW, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + w * clamp((this.effort.threshold || 0) / maxW, 0, 1) - 1, y - 3, 2, 18);
    hudText(ctx, `${Math.round(this.power)} W`, x + 6, y + 10, { size: 10 });
  }
}
