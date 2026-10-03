// Интро: отсчёт 3-2-1, корабль залетает в открытый рот (крупный план), затем переход в тоннель.
import { drawShip } from './ship.js?v=2026.10.03-4';

export const INTRO_DURATION = 4.2;
const COUNT_END = 3.0;
const ease = (t) => t * t * (3 - 2 * t);

export function drawIntro(ctx, w, h, time, texts, logoImg) {
  const p = Math.min(1, time / INTRO_DURATION);
  const minD = Math.min(w, h);

  // Камера приближается к глотке
  const zoomT = ease(Math.min(1, Math.max(0, (time - 1.0) / (INTRO_DURATION - 1.0))));
  const zoom = 1 + zoomT * 6.5;
  const mouthX = w * 0.5, mouthY = h * 0.55;

  ctx.save();
  ctx.translate(mouthX, mouthY);
  ctx.scale(zoom, zoom);
  ctx.translate(-mouthX, -mouthY);
  drawMouth(ctx, w, h, mouthX, mouthY, time);
  ctx.restore();

  // Корабль летит снизу-слева в рот, уменьшаясь к глотке
  const sp = Math.min(1, time / (INTRO_DURATION - 0.35));
  const se = ease(sp);
  const sx = w * 0.1 + (mouthX - w * 0.1) * se;
  const sy = h * 0.95 + (mouthY + h * 0.02 - h * 0.95) * se - Math.sin(se * Math.PI) * h * 0.1;
  const shipSize = minD * (0.17 - 0.155 * se);
  if (sp < 0.985) {
    ctx.save();
    ctx.globalAlpha = sp > 0.9 ? 1 - (sp - 0.9) / 0.085 : 1;
    drawShip(ctx, sx, sy, shipSize, -0.35 + 0.35 * se, time, { glow: 1.4, pitch: 0.15 * (1 - se) });
    ctx.restore();
  }

  // Затемнение в глотке в самом конце
  if (p > 0.84) {
    ctx.fillStyle = `rgba(18,3,6,${(p - 0.84) / 0.16})`;
    ctx.fillRect(0, 0, w, h);
  }

  // Логотип в углу
  if (logoImg && logoImg.complete && logoImg.naturalWidth) {
    const lh = Math.min(54, h * 0.09), lw = lh * logoImg.naturalWidth / logoImg.naturalHeight;
    ctx.fillStyle = '#fff';
    roundRect(ctx, 14, 14, lw + 20, lh + 14, 12); ctx.fill();
    ctx.drawImage(logoImg, 24, 21, lw, lh);
  }

  // Отсчёт
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (time < COUNT_END) {
    const n = 3 - Math.floor(time);
    const f = time - Math.floor(time);
    const scale = 1.5 - 0.5 * Math.min(1, f * 4);
    const alpha = f < 0.85 ? 1 : 1 - (f - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h * 0.17);
    ctx.scale(scale, scale);
    ctx.font = `900 ${Math.round(minD * 0.26)}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.lineWidth = minD * 0.02; ctx.strokeStyle = '#055FAA';
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  } else if (time < INTRO_DURATION - 0.3) {
    const f = Math.min(1, (time - COUNT_END) / 0.25);
    ctx.save();
    ctx.translate(w / 2, h * 0.17);
    ctx.scale(0.7 + 0.3 * f, 0.7 + 0.3 * f);
    ctx.font = `900 italic ${Math.round(minD * 0.12)}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.lineWidth = minD * 0.012; ctx.strokeStyle = '#DD2A1B';
    ctx.strokeText(texts.hud.go || 'Полетели!', 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(texts.hud.go || 'Полетели!', 0, 0);
    ctx.restore();
  }
}

// Крупный план открытого рта: кожа вокруг, губы, верхние и нижние зубы, язык, тёмная глотка
function drawMouth(ctx, w, h, mx, my, time) {
  const minD = Math.min(w, h);
  const mw = minD * 0.36;          // полуширина рта
  const open = minD * 0.2 * (0.9 + 0.1 * Math.sin(time * 1.5)); // раскрытие (половина высоты)

  // Кожа
  const skin = ctx.createRadialGradient(mx, my - minD * 0.3, minD * 0.1, mx, my, Math.max(w, h));
  skin.addColorStop(0, '#FFD9BF'); skin.addColorStop(0.6, '#F3BC98'); skin.addColorStop(1, '#D99A76');
  ctx.fillStyle = skin; ctx.fillRect(-w, -h, w * 3, h * 3);
  // Тень под носом и складки у уголков
  ctx.fillStyle = 'rgba(150,80,50,0.18)';
  ctx.beginPath(); ctx.ellipse(mx, my - open - minD * 0.2, minD * 0.08, minD * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(150,80,50,0.25)'; ctx.lineWidth = minD * 0.012; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx - mw * 1.05, my - open * 0.9); ctx.quadraticCurveTo(mx - mw * 1.25, my, mx - mw * 1.08, my + open * 1.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx + mw * 1.05, my - open * 0.9); ctx.quadraticCurveTo(mx + mw * 1.25, my, mx + mw * 1.08, my + open * 1.1); ctx.stroke();

  // Полость рта (между губами)
  const cavity = () => {
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    ctx.bezierCurveTo(mx - mw * 0.6, my - open * 1.15, mx + mw * 0.6, my - open * 1.15, mx + mw, my);
    ctx.bezierCurveTo(mx + mw * 0.6, my + open * 1.25, mx - mw * 0.6, my + open * 1.25, mx - mw, my);
    ctx.closePath();
  };
  const throat = ctx.createRadialGradient(mx, my + open * 0.1, open * 0.15, mx, my, mw);
  throat.addColorStop(0, '#1A0407'); throat.addColorStop(0.35, '#5E1418'); throat.addColorStop(0.75, '#9A2A2E'); throat.addColorStop(1, '#B8403F');
  cavity(); ctx.fillStyle = throat; ctx.fill();
  // Нёбо
  ctx.save(); cavity(); ctx.clip();
  const palate = ctx.createLinearGradient(0, my - open, 0, my - open * 0.3);
  palate.addColorStop(0, 'rgba(230,120,120,0.9)'); palate.addColorStop(1, 'rgba(230,120,120,0)');
  ctx.fillStyle = palate; ctx.fillRect(mx - mw, my - open * 1.2, mw * 2, open);
  // Язык
  const tongue = ctx.createRadialGradient(mx, my + open * 0.9, open * 0.1, mx, my + open * 0.8, mw * 0.8);
  tongue.addColorStop(0, '#F08A96'); tongue.addColorStop(0.7, '#D55C6C'); tongue.addColorStop(1, '#B0404E');
  ctx.fillStyle = tongue;
  ctx.beginPath(); ctx.ellipse(mx, my + open * 1.05, mw * 0.62, open * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,30,40,0.35)'; ctx.lineWidth = minD * 0.006;
  ctx.beginPath(); ctx.moveTo(mx, my + open * 0.6); ctx.lineTo(mx, my + open * 1.3); ctx.stroke();

  // Зубы: верхние свисают от верхней губы, нижние поднимаются от нижней
  const teeth = (count, y0, dir, scale) => {
    const span = mw * 1.5;
    const tw = span / count;
    for (let i = 0; i < count; i++) {
      const cx = mx - span / 2 + tw * (i + 0.5);
      const edge = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2); // 0 центр, 1 край
      const th = open * scale * (1 - 0.35 * edge);
      const tg = ctx.createLinearGradient(0, y0, 0, y0 + dir * th);
      tg.addColorStop(0, '#FFFFFF'); tg.addColorStop(1, '#E6E2D6');
      ctx.fillStyle = tg;
      ctx.beginPath();
      const half = tw * 0.46;
      ctx.moveTo(cx - half, y0);
      ctx.lineTo(cx + half, y0);
      ctx.lineTo(cx + half, y0 + dir * th * 0.75);
      ctx.quadraticCurveTo(cx, y0 + dir * th * 1.15, cx - half, y0 + dir * th * 0.75);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,90,0.3)'; ctx.lineWidth = minD * 0.004; ctx.stroke();
    }
  };
  teeth(8, my - open * 1.02, 1, 0.5);   // верхний ряд
  teeth(9, my + open * 1.12, -1, 0.32); // нижний ряд
  ctx.restore();

  // Губы
  const lipTop = ctx.createLinearGradient(0, my - open * 1.5, 0, my - open * 0.9);
  lipTop.addColorStop(0, '#D97B7B'); lipTop.addColorStop(1, '#B9565C');
  ctx.fillStyle = lipTop;
  ctx.beginPath();
  ctx.moveTo(mx - mw * 1.05, my);
  ctx.bezierCurveTo(mx - mw * 0.7, my - open * 1.55, mx - mw * 0.15, my - open * 1.45, mx, my - open * 1.35);
  ctx.bezierCurveTo(mx + mw * 0.15, my - open * 1.45, mx + mw * 0.7, my - open * 1.55, mx + mw * 1.05, my);
  ctx.bezierCurveTo(mx + mw * 0.6, my - open * 1.15, mx - mw * 0.6, my - open * 1.15, mx - mw * 1.05, my);
  ctx.closePath(); ctx.fill();
  const lipBot = ctx.createLinearGradient(0, my + open * 1.1, 0, my + open * 1.7);
  lipBot.addColorStop(0, '#C9646A'); lipBot.addColorStop(0.5, '#E08C8C'); lipBot.addColorStop(1, '#C06A6A');
  ctx.fillStyle = lipBot;
  ctx.beginPath();
  ctx.moveTo(mx - mw * 1.05, my);
  ctx.bezierCurveTo(mx - mw * 0.6, my + open * 1.25, mx + mw * 0.6, my + open * 1.25, mx + mw * 1.05, my);
  ctx.bezierCurveTo(mx + mw * 0.7, my + open * 1.75, mx - mw * 0.7, my + open * 1.75, mx - mw * 1.05, my);
  ctx.closePath(); ctx.fill();
  // Блики на губах
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(mx - mw * 0.25, my + open * 1.42, mw * 0.18, open * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(mx + mw * 0.3, my + open * 1.42, mw * 0.14, open * 0.07, 0, 0, Math.PI * 2); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
