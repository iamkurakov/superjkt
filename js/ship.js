// Корабль в камере преследования: вид строго сзади и чуть сверху.
// Ближе всего к зрителю — сопла двигателей и корма, фюзеляж уходит вдаль к маленькому носу.
// bank — крен (поворот), pitch — тангаж (нос вверх/вниз), glow — интенсивность факелов.
const C = {
  hullLight: '#FFFFFF', hull: '#E4ECF5', hullShade: '#9DB2CC', hullDark: '#5F7692',
  blue: '#0F5FAD', blueDark: '#0A3F73', red: '#DD2A1B', redDark: '#8F1109',
  metal: '#3A4A60', metalLight: '#7C8FA8', metalDark: '#1C2635',
  glass: '#0B2A55', glassLight: '#5FC8FF', cyan: '#45D6FF', white: '#FFFFFF',
};

function poly(ctx, pts, s) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
  ctx.closePath();
}
function mirror(pts) { return pts.map(([x, y]) => [-x, y]); }

export function drawShip(ctx, x, y, size, bank = 0, t = 0, { glow = 1, pitch = 0 } = {}) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  // Тангаж: нос вверх — силуэт вытягивается, нос вниз — сжимается
  ctx.scale(1, 1 + pitch * 0.45);
  const flick = 0.92 + 0.08 * Math.sin(t * 47) + 0.04 * Math.sin(t * 29 + 1);
  ctx.lineJoin = 'round';

  // ===== 1. Дальняя часть: нос =====
  const noseG = ctx.createLinearGradient(0, -1.0 * s, 0, -0.55 * s);
  noseG.addColorStop(0, C.hullShade); noseG.addColorStop(1, C.hull);
  poly(ctx, [[0, -1.02], [0.1, -0.86], [0.14, -0.62], [-0.14, -0.62], [-0.1, -0.86]], s);
  ctx.fillStyle = noseG; ctx.fill();
  ctx.strokeStyle = C.hullDark; ctx.lineWidth = s * 0.018; ctx.stroke();
  // Кончик носа красный
  poly(ctx, [[0, -1.02], [0.06, -0.92], [-0.06, -0.92]], s); ctx.fillStyle = C.red; ctx.fill();

  // ===== 2. Крылья (верхняя поверхность, видна сверху-сзади) =====
  const wingTop = [[0.36, -0.3], [1.45, -0.02], [1.52, 0.26], [0.48, 0.3]];
  for (const dir of [1, -1]) {
    const pts = dir > 0 ? wingTop : mirror(wingTop);
    const wg = ctx.createLinearGradient(0, -0.3 * s, dir * 1.5 * s, 0.3 * s);
    wg.addColorStop(0, C.hullLight); wg.addColorStop(0.5, C.hull); wg.addColorStop(1, C.hullShade);
    poly(ctx, pts, s); ctx.fillStyle = wg; ctx.fill();
    ctx.strokeStyle = C.hullDark; ctx.lineWidth = s * 0.02; ctx.stroke();
    // Толщина задней кромки (торец крыла, обращённый к камере)
    poly(ctx, [[dir * 0.48, 0.3], [dir * 1.52, 0.26], [dir * 1.52, 0.34], [dir * 0.48, 0.38]], s);
    ctx.fillStyle = C.hullDark; ctx.fill();
    // Закрылок: чуть темнее участок у задней кромки
    poly(ctx, [[dir * 0.6, 0.2], [dir * 1.25, 0.17], [dir * 1.27, 0.27], [dir * 0.6, 0.3]], s);
    ctx.fillStyle = 'rgba(95,118,146,0.35)'; ctx.fill();
    // Синяя полоса вдоль крыла
    poly(ctx, [[dir * 0.5, -0.12], [dir * 1.3, 0.08], [dir * 1.3, 0.15], [dir * 0.5, -0.03]], s);
    ctx.fillStyle = C.blue; ctx.fill();
    // Красная законцовка
    poly(ctx, [[dir * 1.3, 0.02], [dir * 1.45, -0.02], [dir * 1.52, 0.26], [dir * 1.3, 0.26]], s);
    ctx.fillStyle = C.red; ctx.fill();
    // Панельные линии
    ctx.strokeStyle = 'rgba(60,80,110,0.35)'; ctx.lineWidth = s * 0.012;
    for (const k of [0.75, 1.0]) { ctx.beginPath(); ctx.moveTo(dir * k * s, -0.26 * s + k * 0.2 * s); ctx.lineTo(dir * (k + 0.02) * s, 0.29 * s); ctx.stroke(); }
    // Заклёпки
    ctx.fillStyle = 'rgba(60,80,110,0.45)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(dir * (0.6 + i * 0.15) * s, (0.06 + i * 0.03) * s, s * 0.012, 0, Math.PI * 2); ctx.fill(); }
    // Маневровый двигатель на законцовке
    ctx.fillStyle = C.metal;
    ctx.beginPath(); ctx.ellipse(dir * 1.43 * s, 0.3 * s, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(69,214,255,${0.5 * flick})`;
    ctx.beginPath(); ctx.ellipse(dir * 1.43 * s, 0.3 * s, s * 0.028, s * 0.02, 0, 0, Math.PI * 2); ctx.fill();
    // Навигационный огонь: слева красный, справа зелёный
    ctx.fillStyle = dir < 0 ? '#FF3B3B' : '#3BFF6E';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = s * 0.12;
    ctx.beginPath(); ctx.arc(dir * 1.49 * s, 0.1 * s, s * 0.028, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ===== 3. Фюзеляж: верхняя поверхность, сужается к носу =====
  const hullG = ctx.createLinearGradient(-0.5 * s, 0, 0.5 * s, 0);
  hullG.addColorStop(0, C.hullShade); hullG.addColorStop(0.3, C.hull); hullG.addColorStop(0.5, C.hullLight); hullG.addColorStop(0.7, C.hull); hullG.addColorStop(1, C.hullShade);
  poly(ctx, [[-0.14, -0.64], [0.14, -0.64], [0.4, -0.3], [0.5, 0.18], [-0.5, 0.18], [-0.4, -0.3]], s);
  ctx.fillStyle = hullG; ctx.fill();
  ctx.strokeStyle = C.hullDark; ctx.lineWidth = s * 0.02; ctx.stroke();
  // Хребет: синяя полоса по центру, сужается к носу
  poly(ctx, [[-0.03, -0.62], [0.03, -0.62], [0.09, 0.18], [-0.09, 0.18]], s);
  ctx.fillStyle = C.blue; ctx.fill();
  // Воздухозаборники по бокам фюзеляжа
  for (const dir of [1, -1]) {
    ctx.fillStyle = C.metalDark;
    ctx.beginPath(); ctx.ellipse(dir * 0.34 * s, -0.22 * s, s * 0.07, s * 0.045, dir * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.metalLight; ctx.lineWidth = s * 0.015; ctx.stroke();
  }
  // Панельные линии фюзеляжа
  ctx.strokeStyle = 'rgba(60,80,110,0.35)'; ctx.lineWidth = s * 0.012;
  for (const yy of [-0.45, -0.2, 0.0]) { ctx.beginPath(); ctx.moveTo(-0.3 * s * (1 + yy * 0.6), yy * s); ctx.lineTo(0.3 * s * (1 + yy * 0.6), yy * s); ctx.stroke(); }
  // Заклёпки вдоль хребта
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, (-0.55 + i * 0.13) * s, s * 0.01, 0, Math.PI * 2); ctx.fill(); }

  // ===== 4. Фонарь кабины (вид сзади: купол, подголовник, рамка) =====
  const cx = 0, cy = -0.38 * s;
  const glassG = ctx.createRadialGradient(cx - 0.05 * s, cy - 0.12 * s, s * 0.02, cx, cy, s * 0.26);
  glassG.addColorStop(0, C.glassLight); glassG.addColorStop(0.45, '#1C8FD6'); glassG.addColorStop(1, C.glass);
  ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.17, s * 0.2, 0, Math.PI, Math.PI * 2); ctx.lineTo(cx + 0.17 * s, cy + 0.08 * s); ctx.lineTo(cx - 0.17 * s, cy + 0.08 * s); ctx.closePath();
  ctx.fillStyle = glassG; ctx.fill();
  ctx.strokeStyle = C.white; ctx.lineWidth = s * 0.025; ctx.stroke();
  // Переплёт фонаря
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = s * 0.015;
  ctx.beginPath(); ctx.moveTo(cx, cy - 0.2 * s); ctx.lineTo(cx, cy + 0.08 * s); ctx.stroke();
  // Подголовник пилота
  ctx.fillStyle = C.metalDark;
  ctx.beginPath(); ctx.ellipse(cx, cy + 0.02 * s, s * 0.06, s * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  // Блик на стекле
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(cx - 0.07 * s, cy - 0.11 * s, s * 0.035, s * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
  // Антенна
  ctx.strokeStyle = C.metalLight; ctx.lineWidth = s * 0.012;
  ctx.beginPath(); ctx.moveTo(0.12 * s, cy + 0.06 * s); ctx.lineTo(0.16 * s, cy - 0.16 * s); ctx.stroke();
  ctx.fillStyle = '#FF3B3B'; ctx.beginPath(); ctx.arc(0.16 * s, cy - 0.17 * s, s * 0.015, 0, Math.PI * 2); ctx.fill();

  // ===== 5. Кили (вертикальное оперение, развал наружу) =====
  for (const dir of [1, -1]) {
    poly(ctx, [[dir * 0.42, 0.2], [dir * 0.5, -0.42], [dir * 0.62, -0.36], [dir * 0.6, 0.2]], s);
    const fg = ctx.createLinearGradient(0, -0.4 * s, 0, 0.2 * s);
    fg.addColorStop(0, '#FF6B5E'); fg.addColorStop(1, C.redDark);
    ctx.fillStyle = fg; ctx.fill();
    ctx.strokeStyle = C.redDark; ctx.lineWidth = s * 0.015; ctx.stroke();
    // Синяя полоса на киле и белая кромка
    poly(ctx, [[dir * 0.47, -0.05], [dir * 0.6, -0.1], [dir * 0.6, 0.0], [dir * 0.46, 0.05]], s); ctx.fillStyle = C.blue; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.moveTo(dir * 0.5 * s, -0.42 * s); ctx.lineTo(dir * 0.42 * s, 0.2 * s); ctx.stroke();
    // Огонь на вершине киля
    ctx.fillStyle = C.white; ctx.shadowColor = C.white; ctx.shadowBlur = s * 0.08;
    ctx.beginPath(); ctx.arc(dir * 0.56 * s, -0.4 * s, s * 0.02, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }

  // ===== 6. Корма: задняя переборка, обращённая к камере =====
  const sternG = ctx.createLinearGradient(0, 0.18 * s, 0, 0.6 * s);
  sternG.addColorStop(0, C.metalLight); sternG.addColorStop(0.3, C.metal); sternG.addColorStop(1, C.metalDark);
  poly(ctx, [[-0.5, 0.18], [0.5, 0.18], [0.46, 0.6], [-0.46, 0.6]], s);
  ctx.fillStyle = sternG; ctx.fill();
  ctx.strokeStyle = C.metalDark; ctx.lineWidth = s * 0.02; ctx.stroke();
  // Вентиляционные щели
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 3; i++) { ctx.fillRect(-0.16 * s, (0.26 + i * 0.08) * s, 0.32 * s, 0.035 * s); }
  // Красная кромка кормы и габаритный огонь
  ctx.fillStyle = C.red; ctx.fillRect(-0.5 * s, 0.18 * s, 1.0 * s, 0.035 * s);
  ctx.fillStyle = '#FF3B3B'; ctx.shadowColor = '#FF3B3B'; ctx.shadowBlur = s * 0.1;
  ctx.beginPath(); ctx.arc(0, 0.54 * s, s * 0.025, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

  // ===== 7. Гондолы двигателей с соплами (самое близкое к камере) =====
  for (const dir of [1, -1]) {
    const nx = dir * 0.56 * s, ny = 0.5 * s;
    // Тело гондолы над соплом (верх цилиндра)
    const bodyG = ctx.createLinearGradient(nx - 0.28 * s, 0, nx + 0.28 * s, 0);
    bodyG.addColorStop(0, C.hullShade); bodyG.addColorStop(0.5, C.hullLight); bodyG.addColorStop(1, C.hullShade);
    ctx.beginPath(); ctx.ellipse(nx, 0.2 * s, s * 0.27, s * 0.12, 0, Math.PI, Math.PI * 2); ctx.lineTo(nx + 0.27 * s, ny); ctx.lineTo(nx - 0.27 * s, ny); ctx.closePath();
    ctx.fillStyle = bodyG; ctx.fill(); ctx.strokeStyle = C.hullDark; ctx.lineWidth = s * 0.018; ctx.stroke();
    ctx.fillStyle = C.red; ctx.fillRect(nx - 0.27 * s, 0.3 * s, 0.54 * s, 0.04 * s);
    ctx.fillStyle = C.blue; ctx.fillRect(nx - 0.27 * s, 0.36 * s, 0.54 * s, 0.03 * s);
    // Сопло: внешнее кольцо
    const ringG = ctx.createRadialGradient(nx - 0.08 * s, ny - 0.08 * s, s * 0.05, nx, ny, s * 0.3);
    ringG.addColorStop(0, C.metalLight); ringG.addColorStop(0.7, C.metal); ringG.addColorStop(1, C.metalDark);
    ctx.beginPath(); ctx.ellipse(nx, ny, s * 0.28, s * 0.24, 0, 0, Math.PI * 2); ctx.fillStyle = ringG; ctx.fill();
    ctx.strokeStyle = C.metalLight; ctx.lineWidth = s * 0.02; ctx.stroke();
    // Рёбра сопла
    ctx.strokeStyle = C.metalDark; ctx.lineWidth = s * 0.015;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(nx + Math.cos(a) * 0.2 * s, ny + Math.sin(a) * 0.17 * s); ctx.lineTo(nx + Math.cos(a) * 0.27 * s, ny + Math.sin(a) * 0.23 * s); ctx.stroke(); }
    // Внутренняя камера
    const innerG = ctx.createRadialGradient(nx, ny, 0, nx, ny, s * 0.19);
    innerG.addColorStop(0, C.white); innerG.addColorStop(0.35, '#BFF4FF'); innerG.addColorStop(0.7, C.cyan); innerG.addColorStop(1, '#0B4C8A');
    ctx.beginPath(); ctx.ellipse(nx, ny, s * 0.19 * flick, s * 0.16 * flick, 0, 0, Math.PI * 2); ctx.fillStyle = innerG; ctx.fill();
    ctx.strokeStyle = C.cyan; ctx.lineWidth = s * 0.02; ctx.stroke();
  }

  // ===== 8. Факелы двигателей (к камере, с ударными ромбами) =====
  for (const dir of [1, -1]) {
    const nx = dir * 0.56 * s, ny = 0.5 * s;
    const len = s * (0.9 + 0.5 * (glow - 1)) * flick;
    const fl = ctx.createLinearGradient(0, ny, 0, ny + len);
    fl.addColorStop(0, 'rgba(235,252,255,0.95)'); fl.addColorStop(0.3, 'rgba(120,230,255,0.7)'); fl.addColorStop(0.7, 'rgba(69,180,255,0.3)'); fl.addColorStop(1, 'rgba(69,140,255,0)');
    ctx.beginPath();
    ctx.moveTo(nx - 0.17 * s, ny); ctx.quadraticCurveTo(nx - 0.2 * s, ny + len * 0.5, nx, ny + len); ctx.quadraticCurveTo(nx + 0.2 * s, ny + len * 0.5, nx + 0.17 * s, ny); ctx.closePath();
    ctx.fillStyle = fl; ctx.fill();
    // Ударные ромбы
    for (let i = 0; i < 3; i++) {
      const yy = ny + len * (0.18 + i * 0.2), rr = s * (0.09 - i * 0.02) * flick;
      ctx.fillStyle = `rgba(255,255,255,${0.85 - i * 0.22})`;
      ctx.beginPath(); ctx.moveTo(nx, yy - rr); ctx.lineTo(nx + rr * 0.6, yy); ctx.lineTo(nx, yy + rr); ctx.lineTo(nx - rr * 0.6, yy); ctx.closePath(); ctx.fill();
    }
    // Ореол
    const halo = ctx.createRadialGradient(nx, ny + 0.1 * s, 0, nx, ny + 0.1 * s, s * 0.55 * glow);
    halo.addColorStop(0, 'rgba(120,230,255,0.45)'); halo.addColorStop(1, 'rgba(69,214,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(nx, ny + 0.1 * s, s * 0.55 * glow, s * 0.7 * glow, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
