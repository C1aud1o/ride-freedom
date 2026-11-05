// Effetti sonori e musica chiptune generati in tempo reale con Web Audio (nessun file audio).

const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

// Jingle originali Kenney "Music Jingles" (CC0) in assets/audio/jingles.
// Ogni effetto sotto, se ha un jingle, usa quello; altrimenti il suono sintetizzato.
const JINGLE_FOR = { win: 'win', lose: 'lose', go: 'go', rescue: 'reward', overdrive: 'levelup', alarm: 'boss', menu: 'menu' };
const JINGLE_FILES = ['win', 'win2', 'lose', 'lose2', 'go', 'reward', 'levelup', 'boss', 'menu'];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('gameMuted') === '1';
    this.song = null; this.bpm = 120; this.step = 0; this.timer = null; this.nextTime = 0;
    this.transpose = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.loadJingles();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  async loadJingles() {
    this.jingles = {};
    await Promise.all(JINGLE_FILES.map(async (n) => {
      try {
        const res = await fetch(`assets/audio/jingles/${n}.mp3`);
        this.jingles[n] = await this.ctx.decodeAudioData(await res.arrayBuffer());
      } catch { /* resta il suono sintetizzato */ }
    }));
  }

  // suona un jingle (con piccola variazione tra le versioni disponibili)
  jingle(name, vol = 0.9) {
    if (!this.ensure() || this.muted || !this.jingles) return false;
    const alt = this.jingles[`${name}2`] && Math.random() < 0.4 ? `${name}2` : name;
    const buf = this.jingles[alt]; if (!buf) return false;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.master); src.start();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('gameMuted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone({ freq, to = freq, type = 'square', dur = 0.1, vol = 0.2, at = 0, bus = this.sfxBus }) {
    const c = this.ctx; if (!c) return;
    const t = (at || c.currentTime);
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.3, freq = 1200, type = 'lowpass', at = 0, bus = this.sfxBus, sweep }) {
    const c = this.ctx; if (!c) return;
    const t = (at || c.currentTime);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  sfx(name) {
    if (!this.ensure() || this.muted) return;
    if (JINGLE_FOR[name] && this.jingle(JINGLE_FOR[name])) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'shot': this.tone({ freq: 900, to: 300, dur: 0.05, vol: 0.05 }); break;
      case 'mg': this.tone({ freq: 700, to: 200, dur: 0.04, vol: 0.05, type: 'sawtooth' }); this.noise({ dur: 0.03, vol: 0.05, freq: 3000 }); break;
      case 'laser': this.tone({ freq: 1800, to: 500, dur: 0.09, vol: 0.06, type: 'sawtooth' }); break;
      case 'rocket': this.noise({ dur: 0.25, vol: 0.12, freq: 600, sweep: 2000 }); this.tone({ freq: 180, to: 90, dur: 0.2, vol: 0.05 }); break;
      case 'flame': this.noise({ dur: 0.08, vol: 0.05, freq: 900, type: 'bandpass' }); break;
      case 'hit': this.tone({ freq: 400, to: 250, dur: 0.03, vol: 0.05, type: 'triangle' }); break;
      case 'clank': this.tone({ freq: 1500, to: 1200, dur: 0.05, vol: 0.05, type: 'square' }); break;
      case 'boom': this.noise({ dur: 0.45, vol: 0.4, freq: 900, sweep: 120 }); this.tone({ freq: 140, to: 40, dur: 0.35, vol: 0.25, type: 'sine' }); break;
      case 'bigboom':
        this.noise({ dur: 1.2, vol: 0.55, freq: 1500, sweep: 80 }); this.tone({ freq: 110, to: 30, dur: 1, vol: 0.35, type: 'sine' }); break;
      case 'jump': this.tone({ freq: 260, to: 700, dur: 0.14, vol: 0.08, type: 'square' }); break;
      case 'land': this.noise({ dur: 0.06, vol: 0.06, freq: 500 }); break;
      case 'pickup': [0, 4, 7, 12].forEach((n, i) => this.tone({ freq: mtof(76 + n), dur: 0.09, vol: 0.08, at: t + i * 0.06 })); break;
      case 'coin': this.tone({ freq: mtof(83), dur: 0.06, vol: 0.07, at: t }); this.tone({ freq: mtof(88), dur: 0.16, vol: 0.07, at: t + 0.06 }); break;
      case 'rescue': [0, 7, 12, 16, 19].forEach((n, i) => this.tone({ freq: mtof(72 + n), dur: 0.12, vol: 0.07, type: 'triangle', at: t + i * 0.07 })); break;
      case 'hurt': this.tone({ freq: 300, to: 70, dur: 0.3, vol: 0.14, type: 'sawtooth' }); break;
      case 'bomb': this.noise({ dur: 1.4, vol: 0.6, freq: 3000, sweep: 60 }); this.tone({ freq: 90, to: 25, dur: 1.2, vol: 0.4, type: 'sine' }); break;
      case 'overdrive': [0, 3, 7, 10, 12, 15, 19, 24].forEach((n, i) => this.tone({ freq: mtof(60 + n), dur: 0.1, vol: 0.07, type: 'sawtooth', at: t + i * 0.045 })); break;
      case 'alarm': for (let i = 0; i < 4; i++) { this.tone({ freq: 880, dur: 0.18, vol: 0.07, at: t + i * 0.4 }); this.tone({ freq: 660, dur: 0.18, vol: 0.07, at: t + i * 0.4 + 0.2 }); } break;
      case 'beep': this.tone({ freq: 660, dur: 0.12, vol: 0.08 }); break;
      case 'go': this.tone({ freq: 1320, dur: 0.4, vol: 0.09 }); break;
      case 'select': this.tone({ freq: 520, to: 780, dur: 0.07, vol: 0.06 }); break;
      case 'boost': this.noise({ dur: 0.5, vol: 0.12, freq: 400, sweep: 3000 }); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => this.tone({ freq: mtof(67 + n), dur: 0.16, vol: 0.08, type: 'square', at: t + i * 0.11 })); break;
      case 'lose': [7, 6, 5, 4, 0].forEach((n, i) => this.tone({ freq: mtof(60 + n), dur: 0.25, vol: 0.08, type: 'triangle', at: t + i * 0.2 })); break;
      default: break;
    }
  }

  // ---------- musica: sequencer a 16 passi per battuta ----------
  playSong(song) {
    if (!this.ensure()) return;
    this.stopSong();
    this.song = song; this.bpm = song.bpm; this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopSong() { clearInterval(this.timer); this.timer = null; this.song = null; }

  setTempo(bpm) { this.bpm = Math.max(80, Math.min(175, bpm)); }

  schedule() {
    if (!this.song || !this.ctx) return;
    const s = this.song;
    const total = s.lead.length;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % total; const t = this.nextTime;
      const dur = 60 / this.bpm / 4;
      const tr = this.transpose;
      if (!this.muted) {
        const b = s.bass[i % s.bass.length];
        if (b) this.tone({ freq: mtof(b + tr), dur: dur * 1.8, vol: 0.22, type: 'triangle', at: t, bus: this.musicBus });
        const l = s.lead[i];
        if (l) this.tone({ freq: mtof(l + tr), dur: dur * 1.6, vol: 0.09, type: s.leadType || 'square', at: t, bus: this.musicBus });
        const d = s.drums[i % s.drums.length];
        if (d === 'k' || d === 'x') this.tone({ freq: 150, to: 40, dur: 0.12, vol: 0.5, type: 'sine', at: t, bus: this.musicBus });
        if (d === 's' || d === 'x') this.noise({ dur: 0.1, vol: 0.25, freq: 1800, type: 'highpass', at: t, bus: this.musicBus });
        if (d === 'h') this.noise({ dur: 0.03, vol: 0.12, freq: 7000, type: 'highpass', at: t, bus: this.musicBus });
      }
      this.nextTime += dur; this.step++;
    }
  }
}

// Brani originali (note MIDI, 0 = pausa). Ogni stringa di batteria: k cassa, s rullante, h charleston, x entrambi.
const _ = 0;
const seq = (str) => [...str];
export const SONGS = {
  // Missione 1: ritmo incalzante in La minore
  city: {
    bpm: 132,
    bass: [45, _, 45, _, 57, _, 45, _, 43, _, 43, _, 55, _, 43, _, 41, _, 41, _, 53, _, 41, _, 43, _, 43, _, 55, _, 47, _],
    lead: [69, _, 72, 74, 76, _, 74, _, 72, _, 71, _, 67, _, _, _, 65, _, 69, 72, 77, _, 76, _, 74, _, 72, _, 71, _, 74, _,
      69, _, 72, 74, 76, _, 79, _, 81, _, 79, _, 76, _, 74, _, 77, _, 76, _, 74, _, 72, _, 71, 72, 74, _, 76, _, _, _],
    drums: seq('k.h.s.h.k.k.s.h.k.h.s.h.k.k.s.hs'),
  },
  // Missione 2: deserto, scala frigia
  desert: {
    bpm: 124, leadType: 'sawtooth',
    bass: [40, _, _, 40, 41, _, 40, _, 40, _, _, 40, 43, _, 41, _],
    lead: [64, _, 65, _, 68, _, 69, _, 68, _, 65, _, 64, _, _, _, 64, 65, 68, 69, 71, _, 69, _, 68, _, 65, _, 64, _, 62, _,
      64, _, 65, _, 68, _, 72, _, 71, _, 69, _, 68, _, _, _, 69, _, 68, _, 65, _, 64, _, 65, _, 64, _, 62, _, 64, _],
    drums: seq('k..hs.h.k.khs.h.'),
  },
  // Missione 3: fabbrica, cupo e veloce
  factory: {
    bpm: 140,
    bass: [38, 38, 50, 38, 38, 50, 38, 48, 36, 36, 48, 36, 41, 41, 53, 43],
    lead: [62, _, 65, _, 69, _, 68, _, 65, _, 62, _, 61, _, 62, _, 74, _, 72, _, 69, _, 68, _, 69, _, 65, _, 64, _, 65, _,
      62, _, 65, _, 69, _, 74, _, 77, _, 76, _, 74, _, 72, _, 69, 68, 69, _, 72, _, 74, _, 76, _, 74, _, 73, _, 74, _],
    drums: seq('x.h.s.hkk.h.s.hs'),
  },
  // Boss: tensione
  boss: {
    bpm: 150, leadType: 'sawtooth',
    bass: [33, 33, 45, 33, 34, 34, 46, 34],
    lead: [69, 70, 69, 67, 69, _, 64, _, 69, 70, 72, 70, 69, _, 65, _, 69, 70, 69, 67, 69, _, 76, _, 75, 74, 72, 70, 69, _, _, _],
    drums: seq('k.skk.s.k.skkss'),
  },
  // Corsa: allegro e solare in Re maggiore
  race: {
    bpm: 138,
    bass: [50, _, 57, _, 50, _, 57, _, 47, _, 54, _, 47, _, 54, _, 43, _, 50, _, 43, _, 50, _, 45, _, 52, _, 45, _, 49, _],
    lead: [74, _, 78, _, 81, _, 78, 81, 83, _, 81, _, 78, _, 76, _, 74, _, 76, _, 78, _, 79, 78, 76, _, 73, _, 74, _, _, _,
      74, _, 78, _, 81, _, 86, _, 85, _, 83, _, 81, _, 78, _, 79, _, 81, _, 83, _, 81, 79, 78, _, 76, _, 74, _, _, _],
    drums: seq('k.h.s.h.k.hks.h.'),
  },
  menu: {
    bpm: 110, leadType: 'triangle',
    bass: [48, _, _, _, 55, _, _, _, 45, _, _, _, 53, _, 55, _],
    lead: [72, _, 76, _, 79, _, 76, _, 81, _, 79, _, 76, _, 74, _, 72, _, 74, _, 76, _, 79, _, 77, _, 76, _, 74, _, _, _],
    drums: seq('k...s...k.k.s...'),
  },
};
