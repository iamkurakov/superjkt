// Интро: отсчёт 3-2-1, корабль залетает в открытый рот, затем переход в тоннель.
import { drawShip } from './ship.js';

export const INTRO_DURATION = 4.2;
const COUNT_END = 3.0;

const ease = (t) => t * t * (3 - 2 * t);

export function drawIntro(ctx, w, h, time, texts, logoImg) {
  const p = Math.min(1, time / INTRO_DURATION);
  const minD = Math.min(w, h);
  // Фон: мягкое небо клиники
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#9FD3FF'); bg.addColorStop(1, '#E8F2FB');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  // Пузырьки
  for (let i = 0; i < 18; i++) {
    const bx = ((i * 97) % 100) / 100 * w, by = (((i * 61) % 100) / 100 * h - time * 25 * (1 + i % 3) + h * 3) % h;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 4) * 3, 0, Math.PI * 2); ctx.fill();
  }

  // Камера приближается ко рту: масштаб растёт
  const zoomT = ease(Math.min(1, Math.max(0, (time - 1.2) / (INTRO_DURATION - 1.2))));
  const zoom = 1 + zoomT * 7;
  const mouthX = w * 0.5, mouthY = h * 0.56;
  const faceR = minD * 0.36;

  ctx.save();
  ctx.translate(mouthX, mouthY);
  ctx.scale(zoom, zoom);
  ctx.translate(-mouthX, -mouthY);
  drawFace(ctx, w * 0.5, h * 0.42, faceR, mouthX, mouthY, time);
  ctx.restore();

  // Корабль летит снизу-слева в рот
  const sp = Math.min(1, time / (INTRO_DURATION - 0.4));
  const se = ease(sp);
  const sx = w * 0.12 + (mouthX - w * 0.12) * se;
  const sy = h * 0.92 + (mouthY - h * 0.92) * se - Math.sin(se * Math.PI) * h * 0.12;
  const shipSize = minD * (0.16 - 0.14 * se);
  if (sp < 0.985) {
    ctx.save();
    ctx.globalAlpha = sp > 0.9 ? 1 - (sp - 0.9) / 0.085 : 1;
    drawShip(ctx, sx, sy, shipSize, -0.5 + 0.5 * se, time, { glow: 1.3 });
    ctx.restore();
  }

  // Затемнение в глотке в самом конце
  if (p > 0.82) {
    ctx.fillStyle = `rgba(20,4,8,${(p - 0.82) / 0.18})`;
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
    const scale = 1.6 - 0.6 * Math.min(1, f * 4);
    const alpha = f < 0.85 ? 1 : 1 - (f - 0.85) / 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h * 0.2);
    ctx.scale(scale, scale);
    ctx.font = `900 ${Math.round(minD * 0.3)}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.lineWidth = minD * 0.02; ctx.strokeStyle = '#055FAA';
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  } else if (time < INTRO_DURATION - 0.3) {
    const f = Math.min(1, (time - COUNT_END) / 0.25);
    ctx.save();
    ctx.translate(w / 2, h * 0.2);
    ctx.scale(0.7 + 0.3 * f, 0.7 + 0.3 * f);
    ctx.font = `900 italic ${Math.round(minD * 0.13)}px "Segoe UI", Roboto, Arial, sans-serif`;
    ctx.lineWidth = minD * 0.012; ctx.strokeStyle = '#DD2A1B';
    ctx.strokeText(texts.hud.go || 'Полетели!', 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(texts.hud.go || 'Полетели!', 0, 0);
    ctx.restore();
  }
}

function drawFace(ctx, cx, cy, r, mouthX, mouthY, time) {
  // Шея и плечи
  ctx.fillStyle = '#055FAA';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.75, r * 1.6, r * 0.7, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#F2BE9A';
  ctx.beginPath(); ctx.rect(cx - r * 0.32, cy + r * 0.7, r * 0.64, r * 0.5); ctx.fill();
  // Уши
  ctx.fillStyle = '#F2BE9A';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.98, cy, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.98, cy, r * 0.14, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  // Голова
  const skin = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r * 1.1);
  skin.addColorStop(0, '#FFD9BF'); skin.addColorStop(1, '#F0B48E');
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.95, r, 0, 0, Math.PI * 2); ctx.fill();
  // Волосы
  ctx.fillStyle = '#4A2E1E';
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.55, r * 0.97, r * 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - r * 0.5, cy - r * 0.45, r * 0.4, r * 0.35, 0.3, 0, Math.PI * 2); ctx.fill();
  // Глаза смотрят на корабль (чуть вниз-влево), моргание
  const blink = (Math.sin(time * 2.1) > 0.97) ? 0.15 : 1;
  for (const ex of [-0.36, 0.36]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx + ex * r, cy - r * 0.12, r * 0.16, r * 0.17 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2B6CB0';
    ctx.beginPath(); ctx.ellipse(cx + ex * r - r * 0.03, cy - r * 0.08, r * 0.08, r * 0.09 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0B2A55';
    ctx.beginPath(); ctx.ellipse(cx + ex * r - r * 0.03, cy - r * 0.08, r * 0.04, r * 0.045 * blink, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx + ex * r - r * 0.06, cy - r * 0.12, r * 0.02, 0, Math.PI * 2); ctx.fill();
    // Брови (приподняты — удивление)
    ctx.strokeStyle = '#4A2E1E'; ctx.lineWidth = r * 0.04; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + ex * r - r * 0.16, cy - r * 0.4); ctx.quadraticCurveTo(cx + ex * r, cy - r * 0.5, cx + ex * r + r * 0.16, cy - r * 0.4); ctx.stroke();
  }
  // Нос
  ctx.strokeStyle = '#D9926B'; ctx.lineWidth = r * 0.035;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + r * 0.08, cy + r * 0.18, cx - r * 0.02, cy + r * 0.2); ctx.stroke();
  // Щёки
  ctx.fillStyle = 'rgba(255,120,110,0.25)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.55, cy + r * 0.22, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.55, cy + r * 0.22, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  // Открытый рот
  const mw = r * 0.36, mh = r * 0.3;
  ctx.fillStyle = '#B8362C';
  ctx.beginPath(); ctx.ellipse(mouthX, mouthY, mw * 1.08, mh * 1.08, 0, 0, Math.PI * 2); ctx.fill();
  const throat = ctx.createRadialGradient(mouthX, mouthY + mh * 0.1, mh * 0.1, mouthX, mouthY, mw);
  throat.addColorStop(0, '#2A0608'); throat.addColorStop(0.55, '#6E1A1C'); throat.addColorStop(1, '#A8302A');
  ctx.fillStyle = throat;
  ctx.beginPath(); ctx.ellipse(mouthX, mouthY, mw, mh, 0, 0, Math.PI * 2); ctx.fill();
  // Зубы
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(mouthX, mouthY - mh * 0.82, mw * 0.8, mh * 0.22, 0, 0, Math.PI); ctx.fill();
  // Язык
  ctx.fillStyle = '#E86A7A';
  ctx.beginPath(); ctx.ellipse(mouthX, mouthY + mh * 0.75, mw * 0.55, mh * 0.3, 0, Math.PI, Math.PI * 2); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
