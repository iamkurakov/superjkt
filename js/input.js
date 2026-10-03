// Ввод: мышь, клавиатура, виртуальный джойстик, кнопка импульса и наклоны устройства.
// Выход: target {x, y} в диапазоне [-1, 1] (абсолютная цель положения корабля) либо velocity для клавиатуры,
// и события выстрела через onFire.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Input {
  constructor({ canvas, joystickEl, knobEl, fireBtn }) {
    this.canvas = canvas;
    this.joystickEl = joystickEl;
    this.knobEl = knobEl;
    this.fireBtn = fireBtn;
    this.onFire = () => {};
    this.enabled = false;

    this.mode = 'mouse'; // mouse | keys | joystick | tilt — последний активный источник
    this.mouse = { x: 0, y: 0, active: false };
    this.keys = { x: 0, y: 0 };
    this.keyState = {};
    this.joy = { x: 0, y: 0, active: false, id: null, cx: 0, cy: 0, radius: 50 };
    this.tilt = { enabled: false, granted: false, x: 0, y: 0, beta: 0, gamma: 0, beta0: null, gamma0: null, hasData: false, lastData: 0, sensitivity: 16, source: null };
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    this._bind();
  }

  _bind() {
    const c = this.canvas;
    // Мышь
    c.addEventListener('mousemove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = c.getBoundingClientRect();
      const s = Math.min(r.width, r.height) * 0.42;
      this.mouse.x = clamp((e.clientX - r.left - r.width / 2) / s, -1, 1);
      this.mouse.y = clamp((e.clientY - r.top - r.height / 2) / s, -1, 1);
      this.mouse.active = true;
      this.mode = 'mouse';
    });
    c.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.enabled && !this.isTouch) { e.preventDefault(); this.onFire(); }
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // Клавиатура
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = e.code;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space'].includes(k)) e.preventDefault();
      if (k === 'Space') { if (!e.repeat) this.onFire(); return; }
      this.keyState[k] = true;
      this._updateKeys();
    });
    window.addEventListener('keyup', (e) => { this.keyState[e.code] = false; this._updateKeys(); });
    window.addEventListener('blur', () => { this.keyState = {}; this._updateKeys(); });

    // Касания по канвасу: при наклонах — тап = выстрел
    c.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      if (this.tilt.enabled) { e.preventDefault(); this.onFire(); }
    }, { passive: false });

    // Виртуальный джойстик
    const j = this.joystickEl;
    const startJoy = (e) => {
      const t = e.changedTouches[0];
      const r = j.getBoundingClientRect();
      this.joy.active = true; this.joy.id = t.identifier;
      this.joy.cx = r.left + r.width / 2; this.joy.cy = r.top + r.height / 2; this.joy.radius = r.width * 0.36;
      moveJoy(e);
      e.preventDefault();
    };
    const moveJoy = (e) => {
      if (!this.joy.active) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joy.id) continue;
        const dx = (t.clientX - this.joy.cx) / this.joy.radius;
        const dy = (t.clientY - this.joy.cy) / this.joy.radius;
        const len = Math.hypot(dx, dy);
        const k = len > 1 ? 1 / len : 1;
        this.joy.x = dx * k; this.joy.y = dy * k;
        this.knobEl.style.transform = `translate(${this.joy.x * this.joy.radius}px, ${this.joy.y * this.joy.radius}px)`;
        this.mode = 'joystick';
      }
      e.preventDefault();
    };
    const endJoy = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.joy.id) continue;
        this.joy.active = false; this.joy.id = null;
        this.knobEl.style.transform = '';
      }
    };
    j.addEventListener('touchstart', startJoy, { passive: false });
    j.addEventListener('touchmove', moveJoy, { passive: false });
    j.addEventListener('touchend', endJoy);
    j.addEventListener('touchcancel', endJoy);

    // Кнопка импульса
    const fire = (e) => { e.preventDefault(); if (this.enabled) this.onFire(); };
    this.fireBtn.addEventListener('touchstart', fire, { passive: false });
    this.fireBtn.addEventListener('mousedown', (e) => { if (!this.isTouch) fire(e); });

    // Наклоны
    this._onOrientation = (e) => {
      if (e.beta === null || e.gamma === null || e.beta === undefined) return;
      this.tilt.hasData = true; this.tilt.lastData = performance.now(); this.tilt.source = 'orientation';
      this.tilt.beta = e.beta; this.tilt.gamma = e.gamma;
    };
    // Запасной источник: гравитация из devicemotion → углы наклона (если deviceorientation молчит)
    this._onMotion = (e) => {
      if (this.tilt.source === 'orientation' && performance.now() - this.tilt.lastData < 1000) return;
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.x === undefined) return;
      // iOS отдаёт вектор гравитации, Android — противодействие ей: приводим к одному знаку
      const sign = this._isIOS ? -1 : 1;
      const gx = a.x * sign, gy = a.y * sign, gz = a.z * sign;
      const beta = Math.atan2(gy, gz) * 180 / Math.PI;                    // наклон вперёд-назад
      const gamma = Math.atan2(-gx, Math.hypot(gy, gz)) * 180 / Math.PI;  // наклон влево-вправо
      this.tilt.hasData = true; this.tilt.lastData = performance.now(); this.tilt.source = 'motion';
      this.tilt.beta = beta; this.tilt.gamma = gamma;
    };
  }

  _updateKeys() {
    const s = this.keyState;
    this.keys.x = (s.ArrowRight || s.KeyD ? 1 : 0) - (s.ArrowLeft || s.KeyA ? 1 : 0);
    this.keys.y = (s.ArrowDown || s.KeyS ? 1 : 0) - (s.ArrowUp || s.KeyW ? 1 : 0);
    if (this.keys.x || this.keys.y) this.mode = 'keys';
  }

  // ---- Наклоны устройства ----
  tiltSupported() {
    return this.isTouch && (typeof window.DeviceOrientationEvent !== 'undefined' || typeof window.DeviceMotionEvent !== 'undefined');
  }

  // Вызывать из обработчика жеста пользователя (требование iOS 13+).
  async requestTilt() {
    if (!this.tiltSupported()) return { ok: false, reason: 'unsupported' };
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return { ok: false, reason: 'denied' };
      }
    } catch (e) { return { ok: false, reason: 'denied' }; }
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission();
      }
    } catch (e) { /* motion — только запасной источник */ }
    this._listen();
    this.tilt.granted = true;
    this.tilt.enabled = true;
    this.tilt.beta0 = null;
    // Ждём первые данные недолго; отсутствие данных не считаем ошибкой — проверим в полёте
    await new Promise((resolve) => {
      if (this.tilt.hasData) return resolve();
      const t = setTimeout(resolve, 1200);
      const once = () => { clearTimeout(t); resolve(); };
      window.addEventListener('deviceorientation', once, { once: true });
      window.addEventListener('devicemotion', once, { once: true });
    });
    return { ok: true, hasData: this.tilt.hasData };
  }
  _listen() {
    window.removeEventListener('deviceorientation', this._onOrientation);
    window.removeEventListener('devicemotion', this._onMotion);
    window.addEventListener('deviceorientation', this._onOrientation, true);
    window.addEventListener('devicemotion', this._onMotion, true);
  }
  disableTilt() {
    this.tilt.enabled = false;
    if (this.mode === 'tilt') this.mode = 'joystick';
  }
  // Данные приходили за последние 2 секунды?
  tiltAlive() { return this.tilt.hasData && performance.now() - this.tilt.lastData < 2000; }
  // Запоминаем текущее положение телефона как нейтральное
  calibrateTilt() {
    this.tilt.beta0 = this.tilt.beta;
    this.tilt.gamma0 = this.tilt.gamma;
  }
  _tiltVector() {
    const t = this.tilt;
    if (!t.enabled || !t.hasData) return null;
    if (t.beta0 === null) this.calibrateTilt();
    const db = t.beta - t.beta0, dg = t.gamma - t.gamma0;
    const angle = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    let x, y;
    if (angle === 90) { x = db; y = -dg; }
    else if (angle === 270 || angle === -90) { x = -db; y = dg; }
    else if (angle === 180) { x = -dg; y = -db; }
    else { x = dg; y = db; }
    const s = t.sensitivity;
    const dead = 1.0;
    const f = (v) => { const a = Math.abs(v); if (a < dead) return 0; return clamp(Math.sign(v) * (a - dead) / s, -1, 1); };
    return { x: f(x), y: f(y) };
  }

  // Возвращает { absolute: {x,y} | null, velocity: {x,y} }
  read() {
    const tv = this._tiltVector();
    if (tv && (Math.abs(tv.x) > 0.02 || Math.abs(tv.y) > 0.02 || this.mode === 'tilt')) {
      if (!this.joy.active && !this.keys.x && !this.keys.y) this.mode = 'tilt';
    }
    if (this.joy.active) this.mode = 'joystick';
    switch (this.mode) {
      case 'joystick': return { absolute: this.joy.active ? { x: this.joy.x, y: this.joy.y } : null, velocity: { x: 0, y: 0 } };
      case 'tilt': return { absolute: tv || { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };
      case 'keys': return { absolute: null, velocity: { x: this.keys.x, y: this.keys.y } };
      default: return { absolute: this.mouse.active ? { x: this.mouse.x, y: this.mouse.y } : null, velocity: { x: 0, y: 0 } };
    }
  }

  reset() {
    this.keyState = {}; this._updateKeys();
    this.joy.active = false; this.knobEl.style.transform = '';
    this.mouse.active = false;
    this.mode = this.tilt.enabled ? 'tilt' : (this.isTouch ? 'joystick' : 'mouse');
  }
}
