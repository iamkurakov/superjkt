// Короткие синтезированные игровые звуки на WebAudio (без внешних файлов).
export class GameAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }
  setEnabled(on) { this.enabled = on; }
  _tone(freq, dur, { type = 'sine', vol = 1, slideTo = null, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) { /* игнорируем */ }
  }
  _noise(dur, vol = 0.5) {
    if (!this.enabled || !this.ctx) return;
    try {
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    } catch (e) { /* игнорируем */ }
  }
  pickup() { this._tone(620, 0.12, { type: 'triangle', slideTo: 980 }); this._tone(1240, 0.1, { type: 'sine', vol: .5, delay: .08 }); }
  water() { this._tone(420, 0.18, { type: 'sine', slideTo: 840, vol: .8 }); }
  shoot() { this._tone(880, 0.09, { type: 'square', slideTo: 220, vol: .35 }); }
  hit() { this._noise(0.18, 0.6); this._tone(300, 0.2, { type: 'sawtooth', slideTo: 60, vol: .5 }); }
  damage() { this._noise(0.25, 0.8); this._tone(110, 0.3, { type: 'sawtooth', slideTo: 50, vol: .7 }); }
  miss() { this._tone(200, 0.1, { type: 'square', slideTo: 120, vol: .25 }); }
  wrong() { this._tone(260, 0.15, { type: 'square', vol: .4 }); this._tone(180, 0.2, { type: 'square', vol: .4, delay: .14 }); }
  gate() { [523, 659, 784].forEach((f, i) => this._tone(f, 0.18, { type: 'triangle', delay: i * 0.09, vol: .7 })); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, { type: 'triangle', delay: i * 0.1, vol: .8 })); }
  fail() { this._tone(330, 0.2, { type: 'triangle', slideTo: 165, vol: .5 }); }
  emergency() { for (let i = 0; i < 3; i++) this._tone(440, 0.12, { type: 'square', delay: i * 0.18, vol: .4 }); }
  count() { this._tone(660, 0.12, { type: 'square', vol: .35 }); }
  go() { this._tone(880, 0.25, { type: 'square', vol: .4 }); this._tone(1320, 0.4, { type: 'triangle', vol: .5, delay: .12 }); }
  section() { this._tone(392, 0.25, { type: 'sine', vol: .6 }); this._tone(587, 0.3, { type: 'sine', vol: .6, delay: .2 }); }
  finish() { [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone(f, 0.3, { type: 'triangle', delay: i * 0.12, vol: .8 })); }
}
