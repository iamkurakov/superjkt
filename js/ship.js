// Спрайт корабля (вид сзади-сверху) для вида от третьего лица и интро. Рисуется фигурами Canvas.
export function drawShip(ctx, x, y, size, bank = 0, t = 0, { glow = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bank);
  const s = size;
  // Выхлоп двигателей
  const flick = 0.85 + 0.15 * Math.sin(t * 40);
  for (const ex of [-0.42, 0.42]) {
    const g = ctx.createRadialGradient(ex * s, s * 0.55, 0, ex * s, s * 0.55, s * 0.5 * glow * flick);
    g.addColorStop(0, 'rgba(180,245,255,0.95)');
    g.addColorStop(0.35, 'rgba(69,214,255,0.6)');
    g.addColorStop(1, 'rgba(69,214,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ex * s, s * 0.55, s * 0.5 * glow * flick, s * 0.9 * glow * flick, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Крылья
  ctx.fillStyle = '#1B4C8A';
  ctx.beginPath();
  ctx.moveTo(-0.18 * s, -0.1 * s); ctx.lineTo(-1.15 * s, 0.45 * s); ctx.lineTo(-1.0 * s, 0.6 * s); ctx.lineTo(-0.15 * s, 0.35 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.18 * s, -0.1 * s); ctx.lineTo(1.15 * s, 0.45 * s); ctx.lineTo(1.0 * s, 0.6 * s); ctx.lineTo(0.15 * s, 0.35 * s); ctx.closePath(); ctx.fill();
  // Красные кромки крыльев
  ctx.fillStyle = '#DD2A1B';
  ctx.beginPath(); ctx.moveTo(-1.15 * s, 0.45 * s); ctx.lineTo(-1.0 * s, 0.6 * s); ctx.lineTo(-0.7 * s, 0.5 * s); ctx.lineTo(-0.8 * s, 0.38 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(1.15 * s, 0.45 * s); ctx.lineTo(1.0 * s, 0.6 * s); ctx.lineTo(0.7 * s, 0.5 * s); ctx.lineTo(0.8 * s, 0.38 * s); ctx.closePath(); ctx.fill();
  // Двигатели
  for (const ex of [-0.42, 0.42]) {
    ctx.fillStyle = '#2B3A52';
    ctx.beginPath(); ctx.ellipse(ex * s, 0.42 * s, 0.2 * s, 0.26 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7FE8FF';
    ctx.beginPath(); ctx.ellipse(ex * s, 0.46 * s, 0.11 * s, 0.14 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Фюзеляж
  const fg = ctx.createLinearGradient(-0.3 * s, 0, 0.3 * s, 0);
  fg.addColorStop(0, '#C9D8EA'); fg.addColorStop(0.5, '#FFFFFF'); fg.addColorStop(1, '#AFC3DB');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -1.1 * s);
  ctx.bezierCurveTo(0.34 * s, -0.9 * s, 0.34 * s, 0.4 * s, 0.26 * s, 0.6 * s);
  ctx.lineTo(-0.26 * s, 0.6 * s);
  ctx.bezierCurveTo(-0.34 * s, 0.4 * s, -0.34 * s, -0.9 * s, 0, -1.1 * s);
  ctx.closePath(); ctx.fill();
  // Синие полосы
  ctx.fillStyle = '#055FAA';
  ctx.beginPath(); ctx.rect(-0.3 * s, 0.1 * s, 0.6 * s, 0.1 * s); ctx.fill();
  ctx.fillStyle = '#DD2A1B';
  ctx.beginPath(); ctx.rect(-0.28 * s, 0.24 * s, 0.56 * s, 0.06 * s); ctx.fill();
  // Кабина
  const cg = ctx.createRadialGradient(-0.05 * s, -0.5 * s, 0.02 * s, 0, -0.4 * s, 0.3 * s);
  cg.addColorStop(0, '#9FE3FF'); cg.addColorStop(0.6, '#1C8FD6'); cg.addColorStop(1, '#0B2A55');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(0, -0.42 * s, 0.17 * s, 0.34 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  // Киль
  ctx.fillStyle = '#DD2A1B';
  ctx.beginPath(); ctx.moveTo(0, 0.1 * s); ctx.lineTo(0.06 * s, 0.6 * s); ctx.lineTo(-0.06 * s, 0.6 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
}
