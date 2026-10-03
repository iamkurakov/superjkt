// Отрисовка сцены: перспективный тоннель, объекты в капсулах, шлюзы, импульсы, частицы, прицел.
import { Z_FAR } from './game.js?v=2026.10.03-4';
import { drawShip } from './ship.js?v=2026.10.03-4';
import { drawIntro } from './intro.js?v=2026.10.03-4';

const RING_STEP = 6;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgba(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function hash(i, k) { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); }

export class Renderer {
  constructor(canvas, game, texts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.texts = texts;
    this.w = 1; this.h = 1; this.dpr = 1;
    this.colors = null;
    this.targetColors = null;
    this.particles = [];
    this.pulses = [];
    this.floaters = [];
    this.shake = 0;
    this.lastDamage = -10;
    this.lowPerf = false;
    this._frameTimes = [];
    this.fadeIn = 0; // затемнение после интро
    this.cracks = []; // трещины на стекле кабины после удара
    this.shockwaves = [];
    this.streaks = Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2 + Math.random(), d: Math.random(), sp: 0.6 + Math.random() * 0.8 }));
    this.trail = [];
    this.logoImg = null;
    this.resize();
  }

  drawIntro(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawIntro(ctx, this.w, this.h, time, this.texts, this.logoImg);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowPerf ? 1 : 2);
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  setSection(section) {
    const c = section.colors;
    this.targetColors = { wall: hexToRgb(c.wall), deep: hexToRgb(c.deep), glow: hexToRgb(c.glow), accent: hexToRgb(c.accent) };
    if (!this.colors) this.colors = { wall: [...this.targetColors.wall], deep: [...this.targetColors.deep], glow: [...this.targetColors.glow], accent: [...this.targetColors.accent] };
  }

  burst(x, y, color, n = 18, speed = 220) {
    if (this.lowPerf) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.4, age: 0, color, size: 3 + Math.random() * 5 });
    }
  }
  pulse(tx, ty) { this.pulses.push({ x1: tx, y1: ty, age: 0 }); }
  floater(x, y, text, color = '#FFD23F') { this.floaters.push({ x, y, text, color, age: 0 }); }
  damageFlash() {
    this.lastDamage = this.game.t; this.shake = 1.6;
    // Трещины на стекле (вид из кабины)
    const w = this.w, h = this.h;
    const cx = w / 2 + (Math.random() - 0.5) * w * 0.6, cy = h / 2 + (Math.random() - 0.5) * h * 0.5;
    const lines = [];
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
      const len = Math.min(w, h) * (0.12 + Math.random() * 0.25);
      const pts = [[cx, cy]];
      let px = cx, py = cy, aa = a;
      for (let k = 0; k < 4; k++) { aa += (Math.random() - 0.5) * 0.7; px += Math.cos(aa) * len / 4; py += Math.sin(aa) * len / 4; pts.push([px, py]); }
      lines.push(pts);
    }
    this.cracks.push({ lines, born: this.game.t });
    if (this.cracks.length > 3) this.cracks.shift();
  }
  shockwave(x, y, color = '#FFFFFF') { this.shockwaves.push({ x, y, age: 0, color }); }

  // Текст значка над объектом
  _badge(o) {
    const d = o.def, hud = this.texts.hud;
    switch (o.kind) {
      case 'resource': return `+${d.shield} 🛡`;
      case 'food': return `+${d.energy} ⚡ ${this.game.categories[d.category].name}`;
      case 'special': return hud.badgeCapsule || 'В шлюз';
      case 'target': return hud.badgeTarget || 'ЦЕЛЬ';
      case 'resident': return hud.badgeResident || 'НЕ ЦЕЛЬ';
      case 'obstacle': return hud.badgeObstacle || 'ПРЕПЯТСТВИЕ';
      default: return '';
    }
  }

  draw(dt) {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    // Адаптация производительности: при стабильно низком FPS снижаем DPR
    this._frameTimes.push(dt);
    if (this._frameTimes.length > 90) {
      const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
      this._frameTimes.length = 0;
      if (!this.lowPerf && avg > 1 / 28) { this.lowPerf = true; this.resize(); }
    }
    if (!this.colors) return;
    // Плавная смена палитры участка
    const k = 1 - Math.exp(-dt * 1.2);
    for (const key of Object.keys(this.colors)) this.colors[key] = lerpRgb(this.colors[key], this.targetColors[key], k);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3.2);
      const amp = 18 * this.shake;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      ctx.rotate((Math.random() - 0.5) * 0.02 * this.shake);
    }

    this._drawTunnel();
    this._drawStreaks(dt);
    this._drawGuide();
    this._drawObjects();
    this._drawThreats();
    if (g.view === 'third') { this._drawTrail(dt); this._drawShip(); }
    this._drawPulses(dt);
    this._drawShockwaves(dt);
    this._drawParticles(dt);
    this._drawFloaters(dt);
    this._drawCrosshair();
    this._drawEffects();
    if (g.view === 'first') this._drawCracks();
    if (this.fadeIn > 0) {
      this.fadeIn = Math.max(0, this.fadeIn - dt * 1.2);
      ctx.fillStyle = `rgba(20,4,8,${this.fadeIn})`;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
  }

  _drawShip() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const p = g.shipScreen(w, h);
    const size = Math.min(w, h) * 0.09;
    const bank = Math.max(-0.55, Math.min(0.55, g.vx * 0.45));
    // Тень корабля на «полу» тоннеля
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy + size * 1.4, size * 1.1, size * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (g.isInvulnerable() && Math.sin(g.t * 24) > 0) ctx.globalAlpha = 0.55;
    drawShip(ctx, p.sx, p.sy, size, bank, g.t, { glow: 1 + Math.hypot(g.vx, g.vy) * 0.25, pitch: g.pitch });
    ctx.globalAlpha = 1;
    if (g.isEmergency()) {
      ctx.strokeStyle = `rgba(69,214,255,${0.5 + 0.3 * Math.sin(g.t * 12)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(p.sx, p.sy, size * 1.5, size * 1.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  _drawTunnel() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h, c = this.colors;
    ctx.fillStyle = rgba(c.deep);
    ctx.fillRect(-20, -20, w + 40, h + 40);
    const offset = g.dist % RING_STEP;
    const base = Math.floor(g.dist / RING_STEP);
    const count = Math.ceil(Z_FAR / RING_STEP) + 2;
    // От ближних к дальним: каждое следующее кольцо темнее и меньше
    for (let i = 0; i < count; i++) {
      const z = i * RING_STEP - offset;
      const p = g.project(0, 0, z, w, h);
      const r = p.R * p.scale;
      if (r < 2) continue;
      const depth = Math.min(1, Math.max(0, z / Z_FAR));
      const col = lerpRgb(c.wall, c.deep, Math.pow(depth, 0.75));
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(col);
      ctx.fill();
      // Кромка кольца
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.strokeStyle = rgba(lerpRgb(col, c.deep, 0.35), 0.9);
      ctx.stroke();
      // Ворсинки и блики на стенках
      const gi = base + i;
      const dots = this.lowPerf ? 4 : 7;
      for (let k = 0; k < dots; k++) {
        const a = hash(gi, k) * Math.PI * 2 + z * 0.002;
        const rr = r * (0.86 + hash(gi, k + 50) * 0.1);
        const s = Math.max(1, r * (0.018 + hash(gi, k + 90) * 0.025));
        ctx.beginPath();
        ctx.ellipse(p.sx + Math.cos(a) * rr, p.sy + Math.sin(a) * rr * 0.92, s * 1.6, s, a, 0, Math.PI * 2);
        ctx.fillStyle = rgba(lerpRgb(c.accent, c.deep, depth), 0.55 * (1 - depth));
        ctx.fill();
      }
    }
    // Боковое освещение стенок
    const lg = ctx.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = lg; ctx.fillRect(-20, -20, w + 40, h + 40);
    // Свечение в глубине
    const far = g.project(0, 0, Z_FAR, w, h);
    const grd = ctx.createRadialGradient(far.sx, far.sy, 0, far.sx, far.sy, Math.max(w, h) * 0.5);
    grd.addColorStop(0, rgba(c.glow, 0.45));
    grd.addColorStop(0.25, rgba(c.glow, 0.08));
    grd.addColorStop(1, rgba(c.glow, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(-20, -20, w + 40, h + 40);
  }

  _drawGuide() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const o = g.nextMissionObject();
    if (!o) return;
    const p = g.project(o.x, o.y, o.z, w, h);
    ctx.save();
    ctx.setLineDash([10, 12]);
    ctx.lineDashOffset = -(g.t * 80) % 22;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(69,214,255,0.45)';
    const from = g.view === 'third' ? (() => { const sp = g.shipScreen(w, h); return { x: sp.sx, y: sp.sy }; })() : { x: w / 2, y: h * 0.86 };
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(from.x, (from.y + p.sy) / 2, p.sx, p.sy);
    ctx.stroke();
    ctx.restore();
  }

  _drawObjects() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const list = g.objects.slice().sort((a, b) => b.z - a.z);
    for (const o of list) {
      if (o.z < -2) continue;
      if (o.type === 'gate') { this._drawGate(o); continue; }
      if (o.resolved) continue;
      const p = g.project(o.x, o.y, o.z, w, h);
      const size = o.size * p.R * p.scale;
      if (size < 2) continue;
      const alpha = Math.min(1, (Z_FAR - o.z) / 10);
      ctx.save();
      ctx.globalAlpha = alpha;
      const bob = Math.sin(o.spin * 2) * size * 0.08;
      const x = p.sx, y = p.sy + bob;

      if (o.kind === 'obstacle') {
        // Сгусток: мягкая бесформенная помеха без капсулы
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rr = size * (0.85 + 0.2 * Math.sin(o.spin * 3 + i * 2.1));
          const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const gr = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, size * 0.1, x, y, size);
        gr.addColorStop(0, '#FFD6C8'); gr.addColorStop(1, '#C9634E');
        ctx.fillStyle = gr; ctx.fill();
        ctx.strokeStyle = 'rgba(120,40,30,0.6)'; ctx.lineWidth = Math.max(1, size * 0.08); ctx.stroke();
      } else {
        // Прозрачная капсула
        const bubble = o.def.bubble || '#CFEFFF';
        const gr = ctx.createRadialGradient(x - size * 0.35, y - size * 0.35, size * 0.1, x, y, size);
        gr.addColorStop(0, 'rgba(255,255,255,0.75)');
        gr.addColorStop(0.5, bubble + '66');
        gr.addColorStop(1, bubble + 'AA');
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = gr; ctx.fill();
        ctx.lineWidth = Math.max(1.5, size * 0.07);
        ctx.strokeStyle = o.kind === 'target' ? '#FF4A3D' : o.kind === 'resident' ? '#5CF0A8' : o.mission ? '#45D6FF' : 'rgba(255,255,255,0.85)';
        ctx.stroke();
        // Блик
        ctx.beginPath(); ctx.ellipse(x - size * 0.4, y - size * 0.45, size * 0.22, size * 0.12, -0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
        // Иконка
        ctx.font = `${Math.round(size * 1.15)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (o.kind === 'target') ctx.save(), ctx.translate(x, y), ctx.rotate(Math.sin(o.spin * 4) * 0.25), ctx.fillText(o.def.icon, 0, size * 0.05), ctx.restore();
        else ctx.fillText(o.def.icon, x, y + size * 0.05);
        if (o.kind === 'target') {
          // Маркер цели: красное кольцо с засечками
          ctx.save();
          ctx.translate(x, y); ctx.rotate(o.spin);
          ctx.strokeStyle = '#FF4A3D'; ctx.lineWidth = Math.max(2, size * 0.1);
          for (let i = 0; i < 4; i++) {
            ctx.beginPath(); ctx.arc(0, 0, size * 1.25, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + Math.PI / 2 - 0.25); ctx.stroke();
          }
          ctx.restore();
        }
        if (o.kind === 'resident') {
          ctx.save();
          ctx.strokeStyle = '#5CF0A8'; ctx.lineWidth = Math.max(2, size * 0.08);
          ctx.setLineDash([size * 0.3, size * 0.25]);
          ctx.beginPath(); ctx.arc(x, y, size * 1.25, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
          if (o.hitFlash && g.t - o.hitFlash < 0.35) {
            ctx.fillStyle = `rgba(255,80,60,${0.6 * (1 - (g.t - o.hitFlash) / 0.35)})`;
            ctx.beginPath(); ctx.arc(x, y, size * 1.3, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      // Значок с эффектом объекта (виден заранее, не менее 2 секунд до встречи)
      if (p.scale > 0.17 && p.scale < 0.95) {
        const label = (o.mission ? '! ' : '') + this._badge(o);
        const fs = Math.max(11, Math.min(16, size * 0.42));
        ctx.font = `700 ${fs}px "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label).width + 14;
        const by = y - size * 1.5 - fs;
        ctx.fillStyle = o.kind === 'target' ? 'rgba(120,20,10,0.85)' : o.kind === 'resident' ? 'rgba(10,80,50,0.85)' : 'rgba(8,30,70,0.85)';
        this._roundRect(x - tw / 2, by - fs * 0.8, tw, fs * 1.6, fs * 0.5);
        ctx.fill();
        if (o.mission) { ctx.strokeStyle = '#45D6FF'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x, by + 1);
      }
      ctx.restore();
    }
  }

  _drawGate(o) {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const p = g.project(0, 0, o.z, w, h);
    const r = p.R * p.scale * 0.98;
    if (r < 4 || o.z < -1) return;
    const alpha = Math.min(1, (Z_FAR - o.z) / 12) * (o.z < 2 ? Math.max(0, (o.z + 1) / 3) : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.sx, p.sy);
    // Прозрачная мембрана
    const gr = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
    gr.addColorStop(0, 'rgba(69,214,255,0.05)');
    gr.addColorStop(1, 'rgba(69,214,255,0.35)');
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fillStyle = gr; ctx.fill();
    // Кольцо с сегментами
    ctx.lineWidth = Math.max(3, r * 0.06);
    ctx.strokeStyle = '#45D6FF';
    ctx.stroke();
    ctx.rotate(g.t * 0.8);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2, r * 0.035);
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.9 * 0.92, 0, i * Math.PI / 4, i * Math.PI / 4 + 0.35); ctx.stroke();
    }
    ctx.rotate(-g.t * 0.8);
    if (p.scale > 0.12 && p.scale < 0.8) {
      const fs = Math.max(13, Math.min(30, r * 0.12));
      ctx.font = `900 ${fs}px "Segoe UI", Roboto, Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = this.texts.hud.gateLabel || 'ШЛЮЗ';
      const tw = ctx.measureText(label).width + fs;
      ctx.fillStyle = 'rgba(8,30,70,0.9)';
      this._roundRect(-tw / 2, -r * 0.92 * 0.8 - fs, tw, fs * 1.6, fs * 0.5); ctx.fill();
      ctx.strokeStyle = '#45D6FF'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(label, 0, -r * 0.92 * 0.8 - fs * 0.2);
    }
    ctx.restore();
  }

  // Линии скорости у стенок тоннеля
  _drawStreaks(dt) {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const c0 = g.project(0, 0, 0, w, h), cf = g.project(0, 0, 40, w, h);
    ctx.save();
    ctx.lineCap = 'round';
    for (const st of this.streaks) {
      st.d += dt * st.sp * (g.t < g.slowUntil ? 0.4 : 1);
      if (st.d > 1) { st.d -= 1; st.a = Math.random() * Math.PI * 2; }
      const z1 = (1 - st.d) * 40, z2 = Math.min(40, z1 + 6);
      const p1 = g.project(0, 0, z1, w, h), p2 = g.project(0, 0, z2, w, h);
      const r1 = p1.R * p1.scale * 0.93, r2 = p2.R * p2.scale * 0.93;
      const x1 = p1.sx + Math.cos(st.a) * r1, y1 = p1.sy + Math.sin(st.a) * r1 * 0.92;
      const x2 = p2.sx + Math.cos(st.a) * r2, y2 = p2.sy + Math.sin(st.a) * r2 * 0.92;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * st.d * (1 - st.d) * 4 * 0.5})`;
      ctx.lineWidth = Math.max(1, 3 * p1.scale);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
    void c0; void cf;
  }

  // Предупреждающие маркеры над опасностями на курсе
  _drawThreats() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const list = g.threats();
    if (!list.length) return;
    const pulse = 0.6 + 0.4 * Math.sin(g.t * 14);
    for (const o of list) {
      const p = g.project(o.x, o.y, o.z, w, h);
      const size = o.size * p.R * p.scale;
      ctx.save();
      ctx.translate(p.sx, p.sy - size * 1.9 - 12);
      ctx.fillStyle = `rgba(221,42,27,${pulse})`;
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(13, 10); ctx.lineTo(-13, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '900 14px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.restore();
      // Красное кольцо вокруг опасности
      ctx.strokeStyle = `rgba(255,74,61,${0.5 * pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, size * 1.6, 0, Math.PI * 2); ctx.stroke();
    }
    // Краевое свечение, когда опасность совсем близко
    const near = list.filter((o) => o.z < 12).length;
    if (near) {
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      gr.addColorStop(0, 'rgba(221,42,27,0)'); gr.addColorStop(1, `rgba(221,42,27,${0.25 * pulse})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
  }

  _drawTrail(dt) {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const p = g.shipScreen(w, h);
    const size = Math.min(w, h) * 0.105;
    for (const ex of [-0.46, 0.46]) {
      this.trail.push({ x: p.sx + Math.cos(g.bank) * ex * size - Math.sin(g.bank) * 0.5 * size, y: p.sy + Math.sin(g.bank) * ex * size + Math.cos(g.bank) * 0.5 * size, age: 0 });
    }
    if (this.trail.length > 70) this.trail.splice(0, this.trail.length - 70);
    for (const t of this.trail) {
      t.age += dt; t.y += dt * 140; // уходит назад (вниз-к камере)
      const k = Math.max(0, 1 - t.age / 0.45);
      ctx.fillStyle = `rgba(69,214,255,${0.35 * k})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, size * 0.16 * (1 + t.age * 2), 0, Math.PI * 2); ctx.fill();
    }
    this.trail = this.trail.filter((t) => t.age < 0.45);
  }

  _drawShockwaves(dt) {
    const ctx = this.ctx;
    this.shockwaves = this.shockwaves.filter((s) => (s.age += dt) < 0.5);
    for (const s of this.shockwaves) {
      const k = s.age / 0.5;
      ctx.strokeStyle = s.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10 + k * 120, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawCracks() {
    const g = this.game, ctx = this.ctx;
    if (!this.cracks.length) return;
    this.cracks = this.cracks.filter((c) => g.t - c.born < 2.6);
    for (const c of this.cracks) {
      const k = 1 - (g.t - c.born) / 2.6;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.lineCap = 'round';
      for (const pts of c.lines) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        ctx.strokeStyle = 'rgba(20,40,70,0.55)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(pts[0][0] + 1, pts[0][1] + 1); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + 1, pts[i][1] + 1); ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawPulses(dt) {
    const ctx = this.ctx, w = this.w, h = this.h;
    let x0 = w / 2, y0 = h * 0.98, spread = 40;
    if (this.game.view === 'third') { const p = this.game.shipScreen(w, h); x0 = p.sx; y0 = p.sy - 10; spread = Math.min(w, h) * 0.03; }
    this.pulses = this.pulses.filter((p) => (p.age += dt) < 0.22);
    for (const p of this.pulses) {
      const k = p.age / 0.22;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#DD2A1B'; ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.moveTo(x0 - spread, y0); ctx.lineTo(p.x1, p.y1); ctx.moveTo(x0 + spread, y0); ctx.lineTo(p.x1, p.y1); ctx.stroke();
      ctx.strokeStyle = '#FFE2DD'; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.moveTo(x0 - spread, y0); ctx.lineTo(p.x1, p.y1); ctx.moveTo(x0 + spread, y0); ctx.lineTo(p.x1, p.y1); ctx.stroke();
      ctx.fillStyle = '#FFE2DD';
      ctx.beginPath(); ctx.arc(p.x1, p.y1, 8 * (1 - k) + 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _drawParticles(dt) {
    const ctx = this.ctx;
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life);
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
      const k = 1 - p.age / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawFloaters(dt) {
    const ctx = this.ctx;
    this.floaters = this.floaters.filter((f) => (f.age += dt) < 0.9);
    for (const f of this.floaters) {
      const k = f.age / 0.9;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.font = `900 ${18 + k * 6}px "Segoe UI", Roboto, Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(f.text, f.x, f.y - k * 50);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - k * 50);
      ctx.restore();
    }
  }

  _drawCrosshair() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    // Есть ли цель под прицелом
    const aim = g.aimPoint(w, h);
    let onTarget = false, onResident = false;
    for (const o of g.objects) {
      if (o.resolved || o.z < 0.8 || (o.kind !== 'target' && o.kind !== 'resident')) continue;
      const p = g.project(o.x, o.y, o.z, w, h);
      const rad = Math.max(22, o.size * p.R * p.scale * 1.05);
      if (Math.hypot(p.sx - aim.x, p.sy - aim.y) < rad) { if (o.kind === 'target') onTarget = true; else onResident = true; }
    }
    const col = onTarget ? '#FF4A3D' : onResident ? '#5CF0A8' : '#45D6FF';
    const r = onTarget ? 24 : 20;
    ctx.save();
    ctx.translate(aim.x, aim.y);
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 4), Math.sin(a) * (r + 4)); ctx.lineTo(Math.cos(a) * (r + 14), Math.sin(a) * (r + 14)); ctx.stroke();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (g.view !== 'first') return;
    // Нос корабля
    ctx.save();
    ctx.translate(w / 2, h);
    const nw = Math.min(w, h) * 0.12;
    const grd = ctx.createLinearGradient(0, -nw * 1.2, 0, 0);
    grd.addColorStop(0, '#F5F8FF'); grd.addColorStop(1, '#9DB8D8');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.moveTo(-nw, 0); ctx.quadraticCurveTo(0, -nw * 1.5, nw, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#DD2A1B';
    ctx.beginPath(); ctx.moveTo(-nw * 0.12, 0); ctx.lineTo(0, -nw * 0.85); ctx.lineTo(nw * 0.12, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawEffects() {
    const g = this.game, ctx = this.ctx, w = this.w, h = this.h;
    const sinceDmg = g.t - this.lastDamage;
    if (sinceDmg < 0.7) {
      const a = 0.8 * (1 - sinceDmg / 0.7);
      const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, `rgba(221,42,27,${a * 0.25})`); gr.addColorStop(1, `rgba(160,10,10,${a})`);
      ctx.fillStyle = gr; ctx.fillRect(-20, -20, w + 40, h + 40);
      // Радиальные полосы удара
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#FF6B5E'; ctx.lineWidth = 3;
      for (let i = 0; i < 14; i++) { const an = i * Math.PI * 2 / 14 + sinceDmg * 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * Math.min(w, h) * 0.3, Math.sin(an) * Math.min(w, h) * 0.3); ctx.lineTo(Math.cos(an) * Math.max(w, h), Math.sin(an) * Math.max(w, h)); ctx.stroke(); }
      ctx.restore();
    }
    if (g.isEmergency()) {
      const a = 0.25 + 0.2 * Math.sin(g.t * 12);
      ctx.strokeStyle = `rgba(69,214,255,${a})`; ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, w, h);
    } else if (g.isInvulnerable() && Math.sin(g.t * 20) > 0) {
      ctx.strokeStyle = 'rgba(69,214,255,0.25)'; ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, w, h);
    }
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
}
