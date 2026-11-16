// Audio entièrement synthétisé (Web Audio) : impacts, parades, souffles, tambours.
// Aucun fichier son externe → aucun problème de droits ni de chargement.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.nextBeat = 0;
    this.step = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 1;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  get ok() { return this.ctx && !this.muted; }

  noiseHit({ t = 0, dur = 0.15, freq = 1200, q = 1, type = 'bandpass', gain = 0.6, sweep = null, dest = null }) {
    const c = this.ctx; const now = c.currentTime + t;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, now + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.master);
    src.start(now, Math.random() * 0.5); src.stop(now + dur + 0.02);
  }

  tone({ t = 0, dur = 0.2, f0 = 120, f1 = 50, type = 'sine', gain = 0.7, dest = null }) {
    const c = this.ctx; const now = c.currentTime + t;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, now); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(now); o.stop(now + dur + 0.02);
  }

  hit(heavy) {
    if (!this.ok) return;
    this.tone({ dur: heavy ? 0.28 : 0.16, f0: heavy ? 140 : 190, f1: 40, gain: heavy ? 0.9 : 0.6 });
    this.noiseHit({ dur: heavy ? 0.18 : 0.1, freq: heavy ? 900 : 1600, q: 0.8, gain: heavy ? 0.7 : 0.5 });
  }
  block(shield) {
    if (!this.ok) return;
    this.noiseHit({ dur: 0.12, freq: shield ? 700 : 2600, q: shield ? 2 : 6, gain: 0.5 });
    this.tone({ dur: 0.1, f0: shield ? 220 : 900, f1: shield ? 160 : 700, type: 'triangle', gain: 0.25 });
  }
  whoosh(heavy) {
    if (!this.ok) return;
    this.noiseHit({ dur: heavy ? 0.22 : 0.12, freq: 600, sweep: heavy ? 2400 : 3000, q: 1.2, gain: heavy ? 0.35 : 0.22 });
  }
  jump() { if (this.ok) this.noiseHit({ dur: 0.08, freq: 500, sweep: 1400, gain: 0.15 }); }
  land(hard) { if (this.ok) { this.noiseHit({ dur: hard ? 0.25 : 0.1, freq: 300, type: 'lowpass', gain: hard ? 0.7 : 0.25 }); if (hard) this.tone({ dur: 0.25, f0: 90, f1: 35, gain: 0.6 }); } }
  slam(big) {
    if (!this.ok) return;
    this.tone({ dur: big ? 0.7 : 0.4, f0: big ? 110 : 130, f1: 28, gain: 1.0 });
    this.noiseHit({ dur: big ? 0.6 : 0.3, freq: 400, type: 'lowpass', gain: 0.9 });
  }
  parry() { if (!this.ok) return; this.tone({ dur: 0.22, f0: 1400, f1: 900, type: 'triangle', gain: 0.4 }); this.noiseHit({ dur: 0.1, freq: 5200, q: 8, gain: 0.45 }); this.drum('slap', 0.02); }
  guardBreak() { if (!this.ok) return; this.noiseHit({ dur: 0.45, freq: 1800, sweep: 300, q: 1.5, gain: 0.8 }); this.tone({ dur: 0.4, f0: 220, f1: 60, type: 'sawtooth', gain: 0.35 }); }
  dash() { if (this.ok) this.noiseHit({ dur: 0.16, freq: 700, sweep: 2200, q: 1, gain: 0.2 }); }
  finisher() { if (!this.ok) return; this.tone({ dur: 1.6, f0: 80, f1: 30, gain: 1.0 }); for (let i = 0; i < 8; i++) this.drum(i % 2 ? 'bass' : 'slap', 0.15 + i * 0.09); }
  reward() { if (!this.ok) return; [0, 0.1, 0.2, 0.34].forEach((t, i) => this.tone({ t, dur: 0.25, f0: [392, 494, 587, 784][i], f1: [392, 494, 587, 784][i], type: 'triangle', gain: 0.3 })); }
  grab() { if (this.ok) this.noiseHit({ dur: 0.1, freq: 900, q: 3, gain: 0.35 }); }

  // Tambours (djembé synthétisé) : basse, tonique, claqué
  drum(kind, t = 0, dest = null, vol = 1) {
    if (!this.ctx) return;
    if (kind === 'bass') { this.tone({ t, dur: 0.35, f0: 95, f1: 45, gain: 0.9 * vol, dest }); }
    else if (kind === 'tone') { this.tone({ t, dur: 0.18, f0: 260, f1: 190, gain: 0.45 * vol, dest }); this.noiseHit({ t, dur: 0.05, freq: 1800, q: 1, gain: 0.15 * vol, dest }); }
    else { this.noiseHit({ t, dur: 0.07, freq: 3200, q: 1.5, gain: 0.45 * vol, dest }); this.tone({ t, dur: 0.06, f0: 420, f1: 300, gain: 0.2 * vol, dest }); }
  }
  roundStart() { if (!this.ok) return; ['bass', 'tone', 'tone', 'bass', 'slap', 'slap', 'bass'].forEach((k, i) => this.drum(k, i * 0.11)); }
  special(char) {
    if (!this.ok) return;
    for (let i = 0; i < 6; i++) this.drum(i % 2 ? 'slap' : 'tone', i * 0.06);
    this.drum('bass', 0.38);
    this.tone({ dur: 0.6, f0: char === 'themba' ? 180 : 140, f1: char === 'lekishon' ? 420 : 90, type: 'sawtooth', gain: 0.12 });
  }
  cue(cue) {
    if (!this.ok) return;
    if (cue === 'stomp') { this.drum('bass'); this.noiseHit({ dur: 0.2, freq: 250, type: 'lowpass', gain: 0.5 }); }
    if (cue === 'roar' || cue === 'warcry') { this.noiseHit({ dur: 0.5, freq: 500, q: 2, gain: 0.35, sweep: 300 }); this.tone({ dur: 0.5, f0: 160, f1: 110, type: 'sawtooth', gain: 0.15 }); }
    if (cue === 'hop') this.drum('tone');
    if (cue === 'leap') this.whoosh(true);
    if (cue === 'dash') this.noiseHit({ dur: 0.3, freq: 400, sweep: 1500, gain: 0.3 });
  }
  ko() {
    if (!this.ok) return;
    this.tone({ dur: 1.4, f0: 110, f1: 40, gain: 0.9 });
    this.noiseHit({ dur: 1.0, freq: 200, type: 'lowpass', gain: 0.6 });
    [0.5, 0.7, 0.9].forEach((t) => this.drum('bass', t));
  }
  ui(kind = 'move') { if (this.ok) kind === 'move' ? this.drum('slap', 0, null, 0.5) : this.drum('tone', 0, null, 0.8); }

  // Rythme de fond : motif polyrythmique simple (12/8 à la manière d'un djembé)
  startMusic() { this.musicOn = true; if (this.ctx) this.nextBeat = this.ctx.currentTime + 0.1; }
  stopMusic() { this.musicOn = false; }
  tick() {
    if (!this.ctx || !this.musicOn || this.muted) return;
    const spb = 60 / 118 / 3; // croches de triolet
    const pattern = ['bass', null, 'tone', 'slap', 'tone', null, 'bass', 'slap', 'tone', 'slap', null, 'tone'];
    const accomp = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0];
    while (this.nextBeat < this.ctx.currentTime + 0.15) {
      const t = this.nextBeat - this.ctx.currentTime;
      const k = pattern[this.step % 12];
      if (k) this.drum(k, Math.max(0, t), this.musicGain, 0.8);
      if (accomp[this.step % 12]) this.noiseHit({ t: Math.max(0, t), dur: 0.03, freq: 6000, q: 2, gain: 0.08, dest: this.musicGain });
      this.nextBeat += spb;
      this.step++;
    }
  }
}
