// Игровая симуляция «СУПЕР ЖКТ»: маршрут, объекты, подбор, стрельба, шлюзы, задания, очки.
// Рендер и интерфейс подписываются на события через on(event, handler).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

export const Z_FAR = 70;
export const NEAR = 8;

export class Game {
  constructor({ route, objects, missions, texts }) {
    this.route = route;
    this.objDefs = objects.objects;
    this.categories = objects.categories;
    this.balance = objects.balance;
    this.missionDefs = missions.missions.slice().sort((a, b) => a.start - b.start);
    this.texts = texts;
    this.listeners = {};
    this.reset();
  }

  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); return this; }
  emit(ev, data) { (this.listeners[ev] || []).forEach((fn) => fn(data)); }

  reset() {
    const b = this.balance;
    this.t = 0;
    this.dist = 0;
    this.paused = false;
    this.finished = false;
    this.started = false;
    this.px = 0; this.py = 0;
    this.shield = b.shieldStart;
    this.energy = b.energyStart;
    this.cargo = [];
    this.score = 0;
    this.combo = 0;
    this.objects = [];
    this.nextId = 1;
    this.sectionIndex = -1;
    this.section = this.route.sections[0];
    this.curveAmp = this.section.curve;
    this.spawnTimer = 1.5;
    this.lastShot = -10;
    this.invulnUntil = 0;
    this.emergencyUntil = 0;
    this.lastHitAt = -10;
    this.mission = null;
    this.missionDoneUntil = 0;
    this.missionIdx = 0;
    this.missionSpawns = [];
    this.gateTimes = this._buildGateTimes();
    this.cargoFullNoticeAt = -10;
    this.stats = {
      shots: 0, hits: 0, missionsDone: 0, missionsTotal: this.missionDefs.length,
      emergencies: 0, categories: new Set(), deliveries: 0, pickups: 0, collisions: 0,
    };
  }

  _buildGateTimes() {
    const times = [];
    const r = this.route;
    for (let t = r.tutorialDuration + r.gateInterval; t < r.missionDuration - 6; t += r.gateInterval) times.push(t);
    // Финальный шлюз перед финишем
    times.push(r.missionDuration - 5);
    return times;
  }

  start() { this.started = true; this.emit('start'); this._enterSection(0); }

  // ---------- Геометрия ----------
  curve(z) {
    const s = this.dist + z;
    return { x: this.curveAmp * Math.sin(s * 0.045), y: this.curveAmp * 0.55 * Math.cos(s * 0.031 + 1.3) };
  }
  // Проекция точки сечения (x,y) на глубине z в экранные координаты
  project(x, y, z, w, h) {
    const R = Math.max(w, h) * 0.95;
    const p = NEAR / (NEAR + Math.max(z, -NEAR * 0.9));
    const c = this.curve(z), c0 = this.curve(0);
    return {
      sx: w / 2 + (x - this.px + (c.x - c0.x) * 2.2) * R * p,
      sy: h / 2 + (y - this.py + (c.y - c0.y) * 2.2) * R * p,
      scale: p, R,
    };
  }

  // ---------- Основной цикл ----------
  update(dt, input) {
    if (!this.started || this.paused || this.finished) return;
    dt = Math.min(dt, 0.05);
    const b = this.balance;
    this.t += dt;
    const speed = this.route.forwardSpeed;
    this.dist += speed * dt;

    // Движение корабля
    const LIMIT = 0.72;
    if (input.absolute) {
      const tx = clamp(input.absolute.x, -1, 1) * LIMIT, ty = clamp(input.absolute.y, -1, 1) * LIMIT;
      const k = 1 - Math.exp(-dt * 11);
      this.px += (tx - this.px) * k; this.py += (ty - this.py) * k;
    } else {
      this.px += input.velocity.x * 2.4 * dt; this.py += input.velocity.y * 2.4 * dt;
    }
    const len = Math.hypot(this.px, this.py);
    if (len > LIMIT) { this.px *= LIMIT / len; this.py *= LIMIT / len; }

    // Энергия
    this.energy = clamp(this.energy + b.energyRegen * dt, 0, 100);

    // Участки
    const secIdx = this.route.sections.findIndex((s) => this.t >= s.start && this.t < s.end);
    if (secIdx >= 0 && secIdx !== this.sectionIndex) this._enterSection(secIdx);
    this.curveAmp += (this.section.curve - this.curveAmp) * (1 - Math.exp(-dt * 0.8));

    // Задания
    this._updateMissions();

    // Шлюзы
    while (this.gateTimes.length && this.t >= this.gateTimes[0]) { this.gateTimes.shift(); this._spawnGate(); }

    // Спавн объектов задания
    while (this.missionSpawns.length && this.t >= this.missionSpawns[0].time) {
      const s = this.missionSpawns.shift();
      this._spawn(s.type, { mission: true, missionId: s.missionId });
    }

    // Обычный спавн
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.section.spawnInterval * rand(0.8, 1.2);
      this._regularSpawn();
    }

    // Движение объектов и взаимодействие
    for (const o of this.objects) {
      o.z -= speed * dt;
      o.spin += dt;
      if (!o.passed && o.z <= 0.6) { o.passed = true; this._encounter(o); }
    }
    this.objects = this.objects.filter((o) => o.z > -6 && !(o.resolved && o.z <= 0.6 && o.type !== 'gate'));

    // Финиш
    if (this.t >= this.route.missionDuration) this._finish();
  }

  _enterSection(idx) {
    this.sectionIndex = idx;
    this.section = this.route.sections[idx];
    this.emit('section', { section: this.section, index: idx });
  }

  // ---------- Спавн ----------
  _freeSpot(z, preferRadius) {
    // Подбираем позицию в сечении, не перекрывающую соседние объекты по глубине
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0.12, preferRadius);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.85;
      const ok = this.objects.every((o) => o.type === 'gate' || Math.abs(o.z - z) > 7 || Math.hypot(o.x - x, o.y - y) > 0.42);
      if (ok) return { x, y };
    }
    return { x: rand(-0.4, 0.4), y: rand(-0.3, 0.3) };
  }
  _spawn(type, opts = {}) {
    const def = this.objDefs[type];
    if (!def) return null;
    // Небольшой разнос по глубине, чтобы объекты не сливались
    let z = Z_FAR;
    while (this.objects.some((o) => o.type !== 'gate' && Math.abs(o.z - z) < 5)) z += 5;
    const pos = this._freeSpot(z, def.kind === 'target' || def.kind === 'obstacle' ? 0.5 : 0.58);
    const o = {
      id: this.nextId++, type, def, kind: def.kind, x: pos.x, y: pos.y, z,
      spin: rand(0, 6), passed: false, resolved: false,
      mission: !!opts.mission, missionId: opts.missionId || null,
      size: def.kind === 'target' ? 0.17 : def.kind === 'obstacle' ? 0.2 : def.kind === 'resident' ? 0.15 : 0.15,
    };
    this.objects.push(o);
    return o;
  }
  _spawnGate() {
    this.objects.push({ id: this.nextId++, type: 'gate', kind: 'gate', x: 0, y: 0, z: Z_FAR + 2, spin: 0, passed: false, resolved: false, size: 1 });
  }
  _regularSpawn() {
    const s = this.section;
    const significant = this.objects.filter((o) => o.type !== 'gate' && !o.resolved && o.z < Z_FAR * 0.75).length;
    if (significant >= s.maxVisible) return;
    // Не спавним поверх объектов задания, которые только что появились
    if (this.objects.some((o) => o.mission && o.z > Z_FAR - 6)) return;
    const r = Math.random();
    let type;
    if (r < s.targetRate) type = 'microbe';
    else if (r < s.targetRate + s.residentRate) type = 'resident';
    else if (r < s.targetRate + s.residentRate + s.obstacleRate) type = 'obstacle';
    else {
      const pool = s.objectPool;
      // Вода чуть чаще, когда щит низкий
      if (this.shield < 50 && Math.random() < 0.4) type = 'water';
      else type = pool[Math.floor(Math.random() * pool.length)];
    }
    this._spawn(type);
  }

  // ---------- Взаимодействие при пролёте ----------
  _encounter(o) {
    if (o.resolved) return;
    const b = this.balance;
    if (o.type === 'gate') { this._gate(o); return; }
    const d = Math.hypot(o.x - this.px, o.y - this.py);
    const captureR = o.kind === 'target' || o.kind === 'obstacle' ? 0.27 : 0.32;
    if (d > captureR) return;
    switch (o.kind) {
      case 'resource': { // вода
        const before = this.shield;
        this.shield = clamp(this.shield + (o.def.shield || 0), 0, 100);
        this._addScore(o.def.score || b.pickupScore);
        this.stats.pickups++;
        o.resolved = true;
        this.emit('pickup', { obj: o, text: `+${o.def.shield} 🛡` });
        this._missionEvent('pickup', { obj: o, shieldBefore: before });
        break;
      }
      case 'food':
      case 'special': {
        if (this.cargo.length >= b.cargoSlots) {
          o.resolved = true;
          this.emit('toast', { text: this.texts.hud.cargoFull, kind: 'warn' });
          this.emit('bump', { obj: o, soft: true });
          return;
        }
        const before = this.shield;
        this.cargo.push(o.type);
        if (o.def.energy) this.energy = clamp(this.energy + o.def.energy, 0, 100);
        if (o.def.category) this.stats.categories.add(o.def.category);
        if (o.def.score) this._addScore(o.def.score);
        this.stats.pickups++;
        o.resolved = true;
        const cat = o.def.category ? this.categories[o.def.category].name : o.def.name;
        this.emit('pickup', { obj: o, text: o.def.energy ? `+${o.def.energy} ⚡ · ${cat}` : cat });
        this._missionEvent('pickup', { obj: o, shieldBefore: before });
        break;
      }
      case 'target':
      case 'obstacle': {
        o.resolved = true;
        this._collide(o);
        break;
      }
      case 'resident':
      default:
        break;
    }
  }

  _collide(o) {
    const b = this.balance;
    this.emit('bump', { obj: o, soft: !this.section.damage });
    if (!this.section.damage) return; // обучение: без урона
    if (this.t < this.invulnUntil) return;
    this.stats.collisions++;
    this.combo = 0;
    this.shield = clamp(this.shield - (o.def.damage || b.collisionDamage), 0, 100);
    this.invulnUntil = this.t + b.invulnerableAfterHit;
    this.lastHitAt = this.t;
    this.emit('damage', { obj: o });
    if (this.shield <= 0) this._emergency();
  }

  _emergency() {
    const b = this.balance;
    this.shield = b.emergencyShield;
    this.emergencyUntil = this.t + b.emergencyDuration;
    this.invulnUntil = Math.max(this.invulnUntil, this.emergencyUntil);
    this._addScore(-b.emergencyPenalty);
    this.combo = 0;
    this.stats.emergencies++;
    this.emit('emergency', {});
    this.emit('toast', { text: this.texts.hud.emergency, kind: 'warn' });
  }

  _gate(g) {
    g.resolved = true;
    const b = this.balance;
    const items = this.cargo.slice();
    this.cargo = [];
    if (!items.length) {
      this.emit('gate', { items, bonus: false, text: this.texts.hud.gateEmpty });
      this._missionEvent('gate', { items, categories: 0, capsule: false, food: 0 });
      return;
    }
    const cats = new Set(items.map((t) => this.objDefs[t].category).filter(Boolean));
    const food = items.filter((t) => this.objDefs[t].kind === 'food').length;
    const capsule = items.includes('capsule');
    let gained = b.deliveryScore * items.length;
    let bonus = false;
    if (cats.size >= 3) { gained += b.varietyBonus; bonus = true; }
    this._addScore(gained);
    this.stats.deliveries += items.length;
    this.emit('gate', { items, bonus, gained, text: this.texts.hud.gate + (bonus ? ' · ' + this.texts.hud.variety : '') });
    this._missionEvent('gate', { items, categories: cats.size, capsule, food });
  }

  // ---------- Стрельба ----------
  fire(w, h) {
    if (!this.started || this.paused || this.finished) return;
    const b = this.balance;
    if (this.t - this.lastShot < 1 / b.fireRate) return;
    if (this.energy < b.pulseEnergy) { this.emit('toast', { text: this.texts.hud.noEnergy, kind: 'warn', short: true }); return; }
    this.lastShot = this.t;
    this.energy -= b.pulseEnergy;
    this.stats.shots++;

    // Поиск цели под прицелом
    let best = null, bestZ = Infinity;
    for (const o of this.objects) {
      if (o.resolved || o.z < 0.8 || o.z > Z_FAR) continue;
      if (o.kind !== 'target' && o.kind !== 'resident') continue;
      const p = this.project(o.x, o.y, o.z, w, h);
      const rad = Math.max(22, o.size * p.R * p.scale * 1.05);
      const d = Math.hypot(p.sx - w / 2, p.sy - h / 2);
      if (d < rad && o.z < bestZ) { best = o; bestZ = o.z; }
    }
    const target = best ? this.project(best.x, best.y, best.z, w, h) : { sx: w / 2, sy: h / 2, scale: 0.08 };
    this.emit('shoot', { target: { x: target.sx, y: target.sy }, hit: !!best });

    if (!best) { this.combo = 0; this.emit('miss', {}); return; }
    if (best.kind === 'resident') {
      best.hitFlash = this.t;
      this.combo = 0;
      this._addScore(-b.residentPenalty);
      this.emit('wrong', { obj: best });
      this.emit('toast', { text: this.texts.hud.notTarget, kind: 'warn' });
      return;
    }
    best.resolved = true;
    this.stats.hits++;
    const mult = this.combo >= b.comboThreshold ? b.comboMultiplier : 1;
    this.combo++;
    const gained = (best.def.score || b.targetScore) * mult;
    this._addScore(gained);
    this.emit('hit', { obj: best, gained, mult, screen: { x: target.sx, y: target.sy, scale: target.scale } });
    if (this.combo === b.comboThreshold) this.emit('toast', { text: this.texts.hud.comboOn, kind: 'good' });
    this._missionEvent('hit', { obj: best });
  }

  _addScore(n) {
    this.score = Math.max(0, this.score + n);
    if (n) this.emit('score', { delta: n, score: this.score });
  }

  // ---------- Задания ----------
  _updateMissions() {
    if (this.mission) {
      const m = this.mission;
      if (!m.done && this.t >= m.deadline) this._missionFail();
      return;
    }
    if (this.missionIdx >= this.missionDefs.length) return;
    const def = this.missionDefs[this.missionIdx];
    if (this.t >= def.start) this._missionStart(def);
  }
  _missionStart(def) {
    this.missionIdx++;
    this.mission = { def, start: this.t, deadline: def.start + def.duration, progress: 0, done: false, shots: 0, delivered: 0 };
    // Расписание объектов задания: первая половина задания, чтобы объекты встретились до шлюза и дедлайна
    const list = def.spawn || [];
    const delay = def.spawnDelay != null ? def.spawnDelay : 1;
    const windowLen = Math.max(0, (def.type === 'shoot' || def.type === 'final' ? def.duration * 0.55 : def.duration * 0.42) - delay);
    const step = list.length > 1 ? windowLen / (list.length - 1) : 0;
    this.missionSpawns = list.map((type, i) => ({ time: this.t + delay + i * step, type, missionId: def.id }));
    // Шлюзы, нужные самому заданию (специальные доставки учитывают время до ближайшего шлюза)
    if (def.gates && def.gates.length) {
      for (const off of def.gates) {
        const gt = def.start + off;
        if (!this.gateTimes.some((t) => Math.abs(t - gt) < 8)) this.gateTimes.push(gt);
      }
      this.gateTimes.sort((a, b) => a - b);
    }
    this.emit('mission', { state: 'start', mission: this.mission });
  }
  _missionEvent(kind, data) {
    const m = this.mission;
    if (!m || m.done) return;
    const d = m.def;
    switch (d.type) {
      case 'collectAny':
        if (kind === 'pickup' && data.obj.mission) { m.progress++; if (m.progress >= (d.count || 1)) this._missionDone(); }
        break;
      case 'shieldChoice':
        if (kind === 'pickup' && data.obj.mission) {
          const isWater = data.obj.type === 'water';
          const ok = isWater ? data.shieldBefore < 100 : data.shieldBefore >= 60;
          if (ok) { m.progress = 1; this._missionDone(); }
        }
        break;
      case 'shoot':
        if (kind === 'hit') { m.progress++; if (m.progress >= d.count) this._missionDone(); }
        break;
      case 'deliverCategories':
        if (kind === 'gate' && data.categories >= d.count) { m.progress = d.count; this._missionDone(); }
        break;
      case 'deliverCapsule':
        if (kind === 'gate' && data.capsule) { m.progress = 1; this._missionDone(); }
        break;
      case 'final':
        if (kind === 'hit') m.shots++;
        if (kind === 'gate') m.delivered += data.food;
        m.progress = Math.min(m.shots, d.count) + Math.min(m.delivered, d.deliverCount || 1);
        if (m.shots >= d.count && m.delivered >= (d.deliverCount || 1)) this._missionDone();
        break;
    }
    this.emit('mission', { state: 'progress', mission: m });
  }
  _missionDone() {
    const m = this.mission;
    m.done = true;
    this.stats.missionsDone++;
    this._addScore(m.def.reward || this.balance.missionScore);
    this.emit('mission', { state: 'done', mission: m });
    this.emit('toast', { text: this.texts.hud.missionDone, kind: 'good' });
    this.missionDoneUntil = this.t + 3;
    this.mission = null;
    this.lastMission = m;
    // Объекты завершённого задания остаются, но больше не отмечаются
    this.missionSpawns = this.missionSpawns.filter((s) => s.missionId !== m.def.id);
  }
  _missionFail() {
    const m = this.mission;
    m.failed = true;
    this.combo = 0;
    this.emit('mission', { state: 'failed', mission: m });
    this.emit('toast', { text: this.texts.hud.missionFailed, kind: 'warn' });
    this.mission = null;
    this.lastMission = m;
    this.missionSpawns = [];
  }
  missionTarget() {
    const m = this.mission;
    if (!m) return 0;
    const d = m.def;
    if (d.type === 'final') return (d.count || 0) + (d.deliverCount || 1);
    return d.count || 1;
  }

  // ---------- Финиш ----------
  _finish() {
    this.finished = true;
    if (this.mission && !this.mission.done) this._missionFail();
    const s = this.stats;
    const ratio = s.missionsTotal ? s.missionsDone / s.missionsTotal : 0;
    let stars = 1;
    if (ratio >= 0.6) stars = 2;
    if (ratio >= 0.8 && s.emergencies <= 1) stars = 3;
    const result = {
      score: this.score, stars,
      missionsDone: s.missionsDone, missionsTotal: s.missionsTotal,
      accuracy: s.shots ? Math.round((s.hits / s.shots) * 100) : 0,
      categories: Array.from(s.categories).map((c) => this.categories[c].name),
      emergencies: s.emergencies,
    };
    this.emit('finish', result);
  }

  // ---------- Вспомогательное для интерфейса ----------
  timeLeft() { return Math.max(0, this.route.missionDuration - this.t); }
  isInvulnerable() { return this.t < this.invulnUntil; }
  isEmergency() { return this.t < this.emergencyUntil; }
  nextMissionObject() {
    let best = null;
    for (const o of this.objects) if (o.mission && !o.resolved && o.z > 1 && (!best || o.z < best.z)) best = o;
    return best;
  }
}
