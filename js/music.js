// Фоновая музыка: бодрый генеративный луп на WebAudio (ударные, бас, арпеджио, пад), без внешних файлов.
// Громкость задаётся отдельно от эффектов и по умолчанию держится около 11% от максимума.
const CHORDS = [
  [60, 64, 67, 71], // Cmaj7
  [55, 59, 62, 66], // G (с 7-й)
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
];
const ARP = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 2, 0, 3, 1, 2, 3];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(ctxGetter, { volume = 0.11, bpm = 128 } = {}) {
    this.getCtx = ctxGetter;
    this.volume = volume;
    this.bpm = bpm;
    this.playing = false;
    this.gain = null;
    this.timer = 0;
    this.nextStep = 0;
    this.step = 0;
    this.muted = false;
    this.noise = null;
  }
  _ensure() {
    const ctx = this.getCtx();
    if (!ctx) return null;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      this.gain.connect(comp); comp.connect(ctx.destination);
      this.out = this.gain;
      // Буфер шума для ударных
      const n = Math.floor(ctx.sampleRate * 0.3);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return ctx;
  }
  start() {
    const ctx = this._ensure();
    if (!ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextStep = ctx.currentTime + 0.1;
    this._fade(this.muted ? 0 : this.volume, 1.0);
    this.timer = setInterval(() => this._schedule(), 100);
  }
  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this._fade(0, 0.6);
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
    const sps = 60 / this.bpm / 4; // шестнадцатые
    while (this.nextStep < ctx.currentTime + 0.35) {
      this._playStep(this.step, this.nextStep, sps);
      this.step++;
      this.nextStep += sps;
    }
  }
  _osc(type, freq, t, dur, peak, { filter = null, slideTo = null } = {}) {
    const ctx = this.getCtx();
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); f.connect(g); }
    else o.connect(g);
    g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _hit(t, dur, peak, hp) {
    const ctx = this.getCtx();
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t); s.stop(t + dur + 0.02);
  }
  _playStep(i, t, sps) {
    const bar = Math.floor(i / 32) % CHORDS.length; // 2 такта на аккорд
    const chord = CHORDS[bar];
    const s = i % 16;
    const phrase = Math.floor(i / 128) % 2; // каждые 8 тактов чуть меняем рисунок
    // Бочка на каждую четверть, в конце фразы — сбивка
    if (s % 4 === 0 || (phrase === 1 && s === 14)) this._osc('sine', 150, t, 0.16, 0.9, { slideTo: 45 });
    // Хэт на восьмые, акцент на слабые
    if (s % 2 === 0) this._hit(t, s % 4 === 2 ? 0.07 : 0.04, s % 4 === 2 ? 0.25 : 0.14, 6000);
    // Снейр на 2 и 4
    if (s === 4 || s === 12) { this._hit(t, 0.14, 0.35, 1500); this._osc('triangle', 220, t, 0.1, 0.25, { slideTo: 120 }); }
    // Бас: восьмые, скачки на октаву
    if (s % 2 === 0) {
      const oct = (s === 6 || s === 14) ? 12 : 0;
      this._osc('sawtooth', mtof(chord[0] - 24 + oct), t, sps * 1.7, 0.4, { filter: 500 });
    }
    // Арпеджио шестнадцатыми
    const n = chord[ARP[(i + phrase * 5) % 16]] + (s >= 8 ? 12 : 0);
    this._osc('square', mtof(n), t, sps * 1.2, 0.07, { filter: 2600 });
    // Пад на начало аккорда
    if (i % 32 === 0) {
      for (const c of chord) this._osc('triangle', mtof(c - 12), t, sps * 32, 0.08, { filter: 1800 });
    }
    // Короткий «ответ» лида в конце аккорда
    if (i % 32 >= 24 && s % 4 === 0) this._osc('triangle', mtof(chord[(s / 4) % 4] + 12), t, sps * 3, 0.12);
  }
}
