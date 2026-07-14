// Audio module: WebAudio sound effects driven by simulation events.
// Presentation layer — reads the same event stream as the renderer and never
// touches the engine. Everything is synthesized at runtime (no asset files),
// so file:// and the offline desktop build work without external requests.
class SoundEngine {
  constructor(settings) {
    this.enabled = settings ? settings.soundOn !== false : true;
    this.volume = settings && settings.soundVolume != null ? settings.soundVolume : 0.6;
    this.musicOn = settings ? settings.musicOn === true : false;
    this.musicVolume = settings && settings.musicVolume != null ? settings.musicVolume : 0.4;
    this.ctx = null;
    this.master = null;      // sfx bus
    this.musicGain = null;   // music bus (independent volume)
    this._nb = null;
    this._unlocked = false;
    this._musicTimer = null;
    this._musicStep = 0;
    // AudioContext is only available in a real browser; headless tests skip it.
    this._Ctor = (typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext)) || null;
  }

  // Create/resume the AudioContext after a user gesture (autoplay policy).
  // Idempotent: safe to call on every click/keypress.
  unlock() {
    if (this._unlocked || !this._Ctor) return;
    try {
      this.ctx = new this._Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? this.musicVolume : 0;
      this.musicGain.connect(this.ctx.destination);
      this._unlocked = true;
      if (this.musicOn) this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMusicEnabled(on) {
    this.musicOn = !!on;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? this.musicVolume : 0;
    if (this.ctx) { if (this.musicOn) this.startMusic(); else this.stopMusic(); }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? this.musicVolume : 0;
  }

  // Slow procedural desert ambient: soft pad notes from a low pentatonic set,
  // one every few seconds. No asset files; scheduled on a timer.
  startMusic() {
    if (!this.ctx || !this.musicOn || this._musicTimer) return;
    const notes = [130.81, 146.83, 174.61, 196.00, 220.00]; // C3 D3 F3 G3 A3
    const step = () => {
      if (!this.ctx || !this.musicOn) return;
      const f = notes[this._musicStep % notes.length];
      this._pad(f);
      if (this._musicStep % 4 === 2) this._pad(f * 1.5); // occasional fifth
      this._musicStep++;
    };
    step();
    this._musicTimer = setInterval(step, 2600);
  }

  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  }

  _pad(freq) {
    if (!this.ctx || !this.musicGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.8);   // slow swell
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    g.connect(this.musicGain);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    o.connect(g);
    const o2 = ctx.createOscillator(); // detuned layer for warmth
    o2.type = 'triangle';
    o2.frequency.value = freq * 1.006;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    o2.connect(g2); g2.connect(g);
    try { o.start(now); o.stop(now + 2.5); o2.start(now); o2.stop(now + 2.5); } catch (e) {}
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.master) this.master.gain.value = this.enabled ? this.volume : 0;
  }

  // Turn one tick's events into sound. Coalesces noisy categories so a 3x-speed
  // volley of dozens of hits is at most one blip/boom, not a wall of clicks.
  ingestEvents(events) {
    if (!this.enabled || !this.ctx || !events || events.length === 0) return;
    if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    let shot = false, explosion = false, chain = false, kill = false, leak = false;
    for (const ev of events) {
      switch (ev.type) {
        case 'shot': shot = true; break;
        case 'explosion': explosion = true; break;
        case 'chainHit': chain = true; break;
        case 'kill': kill = true; break;
        case 'leak': leak = true; break;
        case 'waveStart': this._wave(true); break;
        case 'waveEnd': this._wave(false); break;
        case 'victory': this._jingle(true); break;
        case 'defeat': this._jingle(false); break;
      }
    }
    if (explosion) this._boom();
    else if (shot) this._blip();   // skip the plain blip when a boom already plays
    if (chain) this._zap();
    if (kill) this._coin();
    if (leak) this._alarm();
  }

  // Short, subtle UI click — menu navigation shouldn't feel silent.
  // Separate from ingestEvents() since it's driven by DOM clicks, not sim ticks.
  click() {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
    this._play({ type: 'triangle', freq: 720, to: 900, dur: 0.045, vol: 0.09 });
  }

  // ---------------------------------------------------------- synth helpers

  _noiseBuf() {
    if (this._nb) return this._nb;
    const len = Math.floor(this.ctx.sampleRate * 0.3);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = buf;
    return buf;
  }

  // One synthesized voice. opts: {freq,to,type,vol,dur,delay,noise,filter,filterType}
  _play(opts) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime + (opts.delay || 0);
    const dur = opts.dur || 0.12;
    const g = ctx.createGain();
    const peak = opts.vol != null ? opts.vol : 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(this.master);

    let src;
    if (opts.noise) {
      src = ctx.createBufferSource();
      src.buffer = this._noiseBuf();
      if (opts.filter) {
        const f = ctx.createBiquadFilter();
        f.type = opts.filterType || 'lowpass';
        f.frequency.value = opts.filter;
        src.connect(f); f.connect(g);
      } else {
        src.connect(g);
      }
    } else {
      src = ctx.createOscillator();
      src.type = opts.type || 'sine';
      src.frequency.setValueAtTime(opts.freq || 440, start);
      if (opts.to) src.frequency.exponentialRampToValueAtTime(opts.to, start + dur);
      src.connect(g);
    }
    try { src.start(start); src.stop(start + dur + 0.03); } catch (e) {}
  }

  // ------------------------------------------------------------- sound bank

  _blip() {
    const base = 560 + Math.random() * 120; // small pitch variation per shot
    this._play({ type: 'square', freq: base, to: base * 1.5, dur: 0.06, vol: 0.1 });
  }

  _boom() {
    this._play({ noise: true, filter: 420, dur: 0.24, vol: 0.32 });
    this._play({ type: 'sine', freq: 95, to: 48, dur: 0.22, vol: 0.28 });
  }

  _zap() {
    this._play({ type: 'sawtooth', freq: 1300, to: 380, dur: 0.12, vol: 0.16 });
  }

  _coin() {
    this._play({ type: 'triangle', freq: 1050, dur: 0.07, vol: 0.1 });
  }

  _alarm() {
    this._play({ type: 'sawtooth', freq: 230, to: 150, dur: 0.26, vol: 0.22 });
  }

  _wave(start) {
    if (start) {
      this._play({ type: 'square', freq: 300, to: 600, dur: 0.16, vol: 0.14 });
    } else {
      this._play({ type: 'triangle', freq: 659, dur: 0.11, vol: 0.14 });
      this._play({ type: 'triangle', freq: 988, dur: 0.13, vol: 0.14, delay: 0.1 });
    }
  }

  _jingle(win) {
    const notes = win ? [523, 659, 784] : [392, 330, 262];
    const type = win ? 'triangle' : 'sawtooth';
    notes.forEach((f, i) => {
      this._play({ type, freq: f, dur: win ? 0.18 : 0.22, vol: 0.18, delay: i * (win ? 0.12 : 0.14) });
    });
  }
}

if (typeof window !== 'undefined') window.SoundEngine = SoundEngine;
