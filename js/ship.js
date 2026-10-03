// Спрайт корабля: вид сзади-сверху в три четверти, как в камере преследования авиасимулятора.
// Крен (bank) поворачивает корабль, тангаж (pitch) вытягивает или укорачивает силуэт, скорость усиливает выхлоп.
export function drawShip(ctx, x, y, size, bank = 0, t = 0, { glow = 1, pitch = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  ctx.scale(1, 1 + pitch * 0.35);
  const s = size;
  const noseY = -1.35 * s - pitch * 0.3 * s;

  // ---- Выхлоп двигателей (к камере) ----
  const flick = 0.9 + 0.1 * Math.sin(t * 50) + 0.05 * Math.sin(t * 23);
  for (const ex of [-0.46, 0.46]) {
    const r = s * 0.62 * glow * flick;
    const g = ctx.createRadialGradient(ex * s, 0.52 * s, 0, ex * s, 0.52 * s, r);
    g.addColorStop(0, 'rgba(230,252,255,0.95)');
    g.addColorStop(0.25, 'rgba(120,230,255,0.75)');
    g.addColorStop(0.6, 'rgba(69,214,255,0.25)');
    g.addColorStop(1, 'rgba(69,214,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ex * s, 0.52 * s, r, r * 1.35, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---- Крылья (стреловидные, подсвечены сверху) ----
  const wing = (dir) => {
    ctx.beginPath();
    ctx.moveTo(dir * 0.22 * s, -0.05 * s);
    ctx.lineTo(dir * 1.38 * s, 0.42 * s);
    ctx.lineTo(dir * 1.3 * s, 0.6 * s);
    ctx.lineTo(dir * 0.3 * s, 0.5 * s);
    ctx.closePath();
  };
  for (const dir of [-1, 1]) {
    const wg = ctx.createLinearGradient(0, 0, dir * 1.3 * s, 0.5 * s);
    wg.addColorStop(0, '#F3F7FC'); wg.addColorStop(0.55, '#C7D8EA'); wg.addColorStop(1, '#8EA9C8');
    wing(dir); ctx.fillStyle = wg; ctx.fill();
    ctx.strokeStyle = 'rgba(15,50,100,0.55)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
    // Синяя полоса вдоль крыла
    ctx.beginPath();
    ctx.moveTo(dir * 0.3 * s, 0.08 * s); ctx.lineTo(dir * 1.2 * s, 0.44 * s); ctx.lineTo(dir * 1.17 * s, 0.5 * s); ctx.lineTo(dir * 0.3 * s, 0.17 * s); ctx.closePath();
    ctx.fillStyle = '#1C5FA8'; ctx.fill();
    // Красная законцовка
    ctx.beginPath();
    ctx.moveTo(dir * 1.38 * s, 0.42 * s); ctx.lineTo(dir * 1.3 * s, 0.6 * s); ctx.lineTo(dir * 1.05 * s, 0.56 * s); ctx.lineTo(dir * 1.1 * s, 0.37 * s); ctx.closePath();
    ctx.fillStyle = '#DD2A1B'; ctx.fill();
  }

  // ---- Пилоны и гондолы двигателей ----
  for (const ex of [-0.46, 0.46]) {
    ctx.fillStyle = '#5B6F8C';
    ctx.beginPath(); ctx.rect(ex * s - 0.07 * s, 0.1 * s, 0.14 * s, 0.4 * s); ctx.fill();
    // Гондола (вид сзади): тёмное металлическое кольцо
    const ng = ctx.createRadialGradient(ex * s - 0.06 * s, 0.44 * s, 0.02 * s, ex * s, 0.5 * s, 0.3 * s);
    ng.addColorStop(0, '#6E7F99'); ng.addColorStop(0.6, '#2B3A52'); ng.addColorStop(1, '#141E2E');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.ellipse(ex * s, 0.5 * s, 0.28 * s, 0.25 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8FA3BF'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
    // Сопло с кольцами
    ctx.strokeStyle = '#45D6FF'; ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath(); ctx.ellipse(ex * s, 0.5 * s, 0.19 * s, 0.17 * s, 0, 0, Math.PI * 2); ctx.stroke();
    const cg = ctx.createRadialGradient(ex * s, 0.5 * s, 0, ex * s, 0.5 * s, 0.17 * s);
    cg.addColorStop(0, '#FFFFFF'); cg.addColorStop(0.4, '#9FEBFF'); cg.addColorStop(1, '#1C8FD6');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(ex * s, 0.5 * s, 0.15 * s * flick, 0.13 * s * flick, 0, 0, Math.PI * 2); ctx.fill();
    // Красная полоска на гондоле
    ctx.fillStyle = '#DD2A1B';
    ctx.beginPath(); ctx.rect(ex * s - 0.2 * s, 0.18 * s, 0.4 * s, 0.05 * s); ctx.fill();
  }

  // ---- Фюзеляж ----
  const fg = ctx.createLinearGradient(-0.4 * s, 0, 0.4 * s, 0);
  fg.addColorStop(0, '#9DB4CF'); fg.addColorStop(0.35, '#F7FAFD'); fg.addColorStop(0.65, '#FFFFFF'); fg.addColorStop(1, '#A9BED6');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, noseY);
  ctx.bezierCurveTo(0.3 * s, noseY + 0.5 * s, 0.42 * s, 0.1 * s, 0.36 * s, 0.62 * s);
  ctx.lineTo(-0.36 * s, 0.62 * s);
  ctx.bezierCurveTo(-0.42 * s, 0.1 * s, -0.3 * s, noseY + 0.5 * s, 0, noseY);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(15,50,100,0.45)'; ctx.lineWidth = Math.max(1, s * 0.025); ctx.stroke();
  // Центральная синяя полоса
  ctx.fillStyle = '#055FAA';
  ctx.beginPath();
  ctx.moveTo(0, noseY + 0.25 * s); ctx.lineTo(0.09 * s, 0.6 * s); ctx.lineTo(-0.09 * s, 0.6 * s); ctx.closePath(); ctx.fill();
  // Красные полосы у хвоста
  ctx.fillStyle = '#DD2A1B';
  ctx.beginPath(); ctx.rect(-0.34 * s, 0.3 * s, 0.68 * s, 0.05 * s); ctx.fill();
  ctx.fillStyle = '#1C5FA8';
  ctx.beginPath(); ctx.rect(-0.35 * s, 0.4 * s, 0.7 * s, 0.07 * s); ctx.fill();
  // Хвостовой срез (тёмный)
  ctx.fillStyle = '#2B3A52';
  ctx.beginPath(); ctx.ellipse(0, 0.62 * s, 0.36 * s, 0.07 * s, 0, 0, Math.PI); ctx.fill();

  // ---- Кабина ----
  const cy = noseY + 0.75 * s;
  const cg = ctx.createRadialGradient(-0.06 * s, cy - 0.15 * s, 0.02 * s, 0, cy, 0.4 * s);
  cg.addColorStop(0, '#C8F1FF'); cg.addColorStop(0.35, '#2F9BE0'); cg.addColorStop(1, '#0B2A55');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(0, cy, 0.2 * s, 0.4 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-0.07 * s, cy - 0.18 * s, 0.05 * s, 0.12 * s, -0.3, 0, Math.PI * 2); ctx.fill();

  // ---- Кили ----
  for (const dir of [-1, 1]) {
    ctx.fillStyle = '#DD2A1B';
    ctx.beginPath();
    ctx.moveTo(dir * 0.3 * s, 0.6 * s); ctx.lineTo(dir * 0.33 * s, 0.12 * s); ctx.lineTo(dir * 0.42 * s, 0.6 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,10,5,0.5)'; ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke();
  }
  // Блик на фюзеляже
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-0.14 * s, 0.1 * s, 0.05 * s, 0.35 * s, 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
