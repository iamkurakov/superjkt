// Фоновая музыка: мягкий генеративный луп на WebAudio (пад + лёгкий арпеджио), без внешних файлов.
// Громкость задаётся отдельно от эффектов и по умолчанию держится около 11% от максимума.
const CHORDS = [
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [48, 52, 55, 59], // Cmaj7
  [55, 59, 62, 65], // G7
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(ctxGetter, { volume = 0.11, bpm = 84 } = {}) {
    this.getCtx = ctxGetter;
    this.volume = volume;
    this.bpm = bpm;
    this.playing = false;
    this.gain = null;
    this.timer = 0;
    this.nextBeat = 0;
    this.beat = 0;
    this.muted = false;
  }
  _ensure() {
    const ctx = this.getCtx();
    if (!ctx) return null;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      this.gain.connect(lp); lp.connect(ctx.destination);
      this.out = this.gain;
    }
    return ctx;
  }
  start() {
    const ctx = this._ensure();
    if (!ctx || this.playing) return;
    this.playing = true;
    this.beat = 0;
    this.nextBeat = ctx.currentTime + 0.1;
    this._fade(this.muted ? 0 : this.volume, 1.5);
    this.timer = setInterval(() => this._schedule(), 120);
  }
  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this._fade(0, 0.8);
  }
  setMuted(m) { this.muted = m; if (this.playing) this._fade(m ? 0 : this.volume, 0.4); }
  setVolume(v) { this.volume = v; if (this.playing && !this.muted) this._fade(v, 0.3); }
  _fade(v, dur) {
    const ctx = this.getCtx();
    if (!ctx || !this.gain) return;
    const g = this.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(v, ctx.currentTime + dur);
  }
  _schedule() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const spb = 60 / this.bpm;
    while (this.nextBeat < ctx.currentTime + 0.4) {
      this._playBeat(this.beat, this.nextBeat, spb);
      this.beat++;
      this.nextBeat += spb / 2; // восьмые
    }
  }
  _playBeat(i, t, spb) {
    const ctx = this.getCtx();
    const bar = Math.floor(i / 16) % CHORDS.length; // 2 такта по 4/4 на аккорд
    const chord = CHORDS[bar];
    // Пад: на первую восьмую каждого аккорда
    if (i % 16 === 0) {
      for (const n of chord) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(n - 12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.8);
        g.gain.setValueAtTime(0.12, t + spb * 7);
        g.gain.linearRampToValueAtTime(0.0001, t + spb * 8);
        o.connect(g); g.connect(this.out);
        o.start(t); o.stop(t + spb * 8 + 0.05);
      }
    }
    // Арпеджио: мягкие колокольчики по нотам аккорда, с паузами
    const pattern = [0, 2, 1, 3, 2, 0, 3, 1];
    if (i % 2 === 0 || (i % 8 === 3)) {
      const n = chord[pattern[(i / 2 | 0) % pattern.length]] + (i % 16 >= 8 ? 12 : 0);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(n + 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.9);
      o.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + spb + 0.05);
    }
    // Мягкий бас на 1 и 3 доли
    if (i % 8 === 0 || i % 8 === 4) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(chord[0] - 24);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 1.6);
      o.connect(g); g.connect(this.out);
      o.start(t); o.stop(t + spb * 1.7);
    }
  }
}
