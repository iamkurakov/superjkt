// Точка входа: загрузка конфигов, экраны, HUD, игровой цикл.
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Music } from './music.js';
import { storage } from './storage.js';
import { track } from './analytics.js';

const $ = (id) => document.getElementById(id);

async function loadJson(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

async function boot() {
  let cfg;
  try {
    const [route, objects, missions, brand, texts] = await Promise.all([
      loadJson('config/route.json'), loadJson('config/objects.json'), loadJson('config/missions.json'),
      loadJson('config/brand.json'), loadJson('config/texts.json'),
    ]);
    cfg = { route, objects, missions, brand, texts };
  } catch (e) {
    const l = $('loading'); l.classList.add('error'); l.querySelector('span').textContent = 'Не удалось загрузить игру. Обновите страницу.';
    console.error(e); return;
  }
  const { brand, texts } = cfg;

  // ---- Бренд и тексты ----
  document.title = brand.gameTitle;
  document.querySelectorAll('img[src="assets/logo.png"]').forEach((img) => { img.src = brand.logo; img.alt = brand.clinicName; });
  document.documentElement.style.setProperty('--primary', brand.colors.primary);
  document.documentElement.style.setProperty('--accent', brand.colors.accent);
  const site = $('btn-site'); site.href = brand.siteUrl; site.textContent = brand.siteButtonText;
  site.addEventListener('click', () => track('site_click'));
  document.querySelectorAll('[data-text]').forEach((el) => {
    const v = el.dataset.text.split('.').reduce((o, k) => (o ? o[k] : undefined), texts);
    if (typeof v === 'string') el.textContent = v;
  });
  const howto = $('howto-list');
  howto.innerHTML = texts.howTo.items.map((s) => `<li>${s}</li>`).join('');

  // ---- Объекты ----
  const canvas = $('game-canvas');
  const game = new Game(cfg);
  const renderer = new Renderer(canvas, game, texts);
  const audio = new GameAudio();
  const music = new Music(() => audio.ctx, { volume: 0.11 });
  const input = new Input({ canvas, joystickEl: $('joystick'), knobEl: $('joy-knob'), fireBtn: $('btn-fire') });
  const app = $('app');
  if (input.isTouch) app.classList.add('touch');

  // ---- Экраны ----
  const screens = {
    start: $('screen-start'), howto: $('screen-howto'), game: $('screen-game'),
    pause: $('screen-pause'), result: $('screen-result'),
  };
  let current = 'start';
  function show(name) {
    const base = name === 'start' || name === 'howto' ? 'start' : 'game';
    screens.start.classList.toggle('active', base === 'start');
    screens.game.classList.toggle('active', base === 'game');
    screens.howto.classList.toggle('active', name === 'howto');
    screens.pause.classList.toggle('active', name === 'pause');
    screens.result.classList.toggle('active', name === 'result');
    current = name;
    if (name === 'game') { renderer.resize(); input.enabled = true; } else input.enabled = false;
  }

  // ---- Настройки ----
  let soundOn = storage.getSound();
  audio.setEnabled(soundOn);
  music.setMuted(!soundOn);
  function renderSound() {
    for (const id of ['btn-sound', 'btn-sound-pause']) {
      const b = $(id); b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      b.querySelector('.chip-icon').textContent = soundOn ? '🔊' : '🔇';
    }
  }
  function toggleSound() { soundOn = !soundOn; audio.setEnabled(soundOn); music.setMuted(!soundOn); storage.setSound(soundOn); renderSound(); audio.unlock(); if (soundOn) audio.pickup(); }
  $('btn-sound').addEventListener('click', toggleSound);
  $('btn-sound-pause').addEventListener('click', toggleSound);
  renderSound();

  const best = storage.getBest();
  if (best > 0) { $('best-line').hidden = false; $('best-score').textContent = best; }

  // ---- Наклоны ----
  const tiltBtn = $('btn-tilt');
  function renderTilt() {
    const on = input.tilt.enabled;
    tiltBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    tiltBtn.querySelector('.chip-label').textContent = on ? texts.start.tiltOff : texts.start.tiltOn;
    app.classList.toggle('tilt', on);
    $('tilt-hint').hidden = !on;
    $('tilt-badge').hidden = !on;
  }
  if (input.tiltSupported()) {
    tiltBtn.hidden = false;
    tiltBtn.addEventListener('click', async () => {
      audio.unlock();
      if (input.tilt.enabled) { input.disableTilt(); storage.setTilt(false); renderTilt(); return; }
      tiltBtn.disabled = true;
      const res = await input.requestTilt();
      tiltBtn.disabled = false;
      if (res.ok) { storage.setTilt(true); track('tilt_enabled'); }
      else {
        storage.setTilt(false);
        tiltBtn.querySelector('.chip-label').textContent = texts.start.tiltUnavailable;
        toast(texts.tilt.denied, 'warn', 2600, true);
        setTimeout(renderTilt, 2600);
        return;
      }
      renderTilt();
    });
    // Android: если ранее включали наклоны и разрешение не требуется — включаем сразу при старте миссии
    if (storage.getTilt() && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      input.requestTilt().then((r) => { if (r.ok) renderTilt(); });
    }
  }

  // ---- HUD ----
  const hud = {
    time: $('hud-time'), round: $('hud-round'), strip: $('round-strip'), section: $('hud-section'), mission: $('hud-mission'), mTitle: $('mission-title'),
    mHint: $('mission-hint'), mProg: $('mission-progress'), mBar: $('mission-bar-fill'), mIcon: $('mission-icon'),
    shield: $('g-shield'), shieldFill: $('g-shield-fill'), energy: $('g-energy'), energyFill: $('g-energy-fill'),
    cargo: $('g-cargo'), cells: $('cargo-cells'), score: $('g-score'), combo: $('g-combo'),
  };
  const toastEl = $('toast');
  let toastTimer = 0;
  function toast(text, kind = '', ms = 1400, force = false) {
    if (!text) return;
    toastEl.textContent = text;
    toastEl.className = 'toast show ' + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  const scorePop = $('score-pop');
  function popScore(text) {
    scorePop.textContent = text;
    scorePop.classList.remove('show'); void scorePop.offsetWidth; scorePop.classList.add('show');
  }
  const missionIcons = { collectAny: '💧', shoot: '🎯', deliverCategories: '📦', shieldChoice: '🛡', deliverCapsule: '💊', final: '🏁' };
  // «Дальше» по пробелу/Enter на карточке раунда
  window.addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && !roundOverlay.hidden && current === 'game') { e.preventDefault(); advanceRound(); } });
  let lastHud = {};
  function updateHud() {
    const s = Math.round(game.shield), e = Math.round(game.energy);
    if (lastHud.s !== s) { hud.shield.textContent = s; hud.shieldFill.style.transform = `scaleX(${s / 100})`; hud.shield.parentElement.classList.toggle('low', s < 30); lastHud.s = s; }
    if (lastHud.e !== e) { hud.energy.textContent = e; hud.energyFill.style.transform = `scaleX(${e / 100})`; hud.energy.parentElement.classList.toggle('low', e < 10); lastHud.e = e; }
    const cargoKey = game.cargo.join(',');
    if (lastHud.c !== cargoKey) {
      hud.cargo.textContent = `${game.cargo.length}/${game.balance.cargoSlots}`;
      hud.cells.innerHTML = '';
      for (let i = 0; i < game.balance.cargoSlots; i++) {
        const d = document.createElement('div');
        d.className = 'cargo-cell' + (game.cargo[i] ? ' filled' : '');
        d.textContent = game.cargo[i] ? game.objDefs[game.cargo[i]].icon : '';
        hud.cells.appendChild(d);
      }
      lastHud.c = cargoKey;
    }
    if (lastHud.sc !== game.score) { hud.score.textContent = game.score; lastHud.sc = game.score; }
    const comboText = game.combo >= game.balance.comboThreshold ? `${texts.hud.combo} ×${game.balance.comboMultiplier} (${game.combo})` : game.combo > 1 ? `${texts.hud.combo} ${game.combo}` : '';
    if (lastHud.cb !== comboText) { hud.combo.textContent = comboText; lastHud.cb = comboText; }
    const tl = fmtTime(game.roundTimeLeft()).replace(/^0/, '');
    if (lastHud.t !== tl) { hud.time.textContent = tl; lastHud.t = tl; }
    const m = game.mission;
    if (m) {
      const total = game.missionTarget();
      const prog = total > 1 ? `${Math.min(m.progress, total)}/${total}` : '';
      if (lastHud.mp !== prog) { hud.mProg.textContent = prog; lastHud.mp = prog; }
      hud.mBar.style.transform = `scaleX(${Math.max(0, (m.def.duration - game.rt) / m.def.duration)})`;
    }
  }
  function setMissionPanel(m, state) {
    hud.mission.classList.remove('done', 'idle');
    if (!m) {
      hud.mTitle.textContent = texts.hud.noMission || 'Следуй маршруту';
      hud.mHint.textContent = ''; hud.mProg.textContent = ''; hud.mBar.style.transform = 'scaleX(0)';
      hud.mIcon.textContent = '🧭'; hud.mission.classList.add('idle'); return;
    }
    hud.mIcon.textContent = missionIcons[m.def.type] || '🎯';
    hud.mTitle.textContent = m.def.title;
    hud.mHint.textContent = m.def.hint;
    if (state === 'done') hud.mission.classList.add('done');
    lastHud.mp = null;
  }

  // ---- Раунды ----
  function renderStrip(el) {
    el.innerHTML = game.rounds.map((r, i) => `<i class="${r.result || (i === game.roundIndex && !game.finished ? 'current' : '')}"></i>`).join('');
  }
  const roundOverlay = $('round-overlay');
  let roundTimer = 0;
  function showRoundEnd({ index, total, round, won, last }) {
    $('round-label').textContent = `${texts.hud.round} ${index + 1} ${texts.hud.of || 'из'} ${total}`;
    const v = $('round-verdict'); v.textContent = won ? texts.hud.roundWin : texts.hud.roundLose; v.className = 'round-verdict ' + (won ? 'win' : 'lose');
    $('round-task').textContent = round.def.title + (won ? ` · +${round.def.reward}` : '');
    renderStrip($('round-dots'));
    $('btn-round-next').textContent = last ? texts.hud.roundLast : texts.hud.roundNext;
    roundOverlay.hidden = false;
    input.reset();
    clearTimeout(roundTimer);
    roundTimer = setTimeout(advanceRound, (cfg.route.betweenRounds || 2.8) * 1000 + (last ? 800 : 0));
  }
  function advanceRound() {
    clearTimeout(roundTimer);
    if (roundOverlay.hidden) return;
    roundOverlay.hidden = true;
    if (input.tilt.enabled) input.calibrateTilt();
    game.nextRound();
  }
  $('btn-round-next').addEventListener('click', advanceRound);
  roundOverlay.addEventListener('click', (e) => { if (e.target === roundOverlay) advanceRound(); });

  // ---- События игры ----
  const W = () => renderer.w, H = () => renderer.h;
  input.onFire = () => { if (current === 'game') game.fire(W(), H()); };
  game.on('section', ({ section, index }) => {
    renderer.setSection(section);
    hud.section.textContent = section.name;
    if (index > 0) audio.section();
    track('section_start', { section: section.id });
  });
  game.on('round', (ev) => {
    if (ev.state === 'start') {
      hud.round.textContent = `${texts.hud.round} ${ev.index + 1}/${ev.total}`;
      renderStrip(hud.strip);
      lastHud.t = null;
      track('round_start', { round: ev.round.def.id });
    } else if (ev.state === 'end') {
      renderStrip(hud.strip);
      if (ev.won) audio.mission(); else audio.fail();
      track(ev.won ? 'round_won' : 'round_lost', { round: ev.round.def.id });
      showRoundEnd(ev);
    }
  });
  game.on('pickup', ({ obj, text }) => {
    const p = game.project(obj.x, obj.y, Math.max(obj.z, 0.6), W(), H());
    renderer.burst(p.sx, p.sy, obj.def.bubble || '#CFEFFF', 14, 160);
    renderer.floater(p.sx, p.sy, text, obj.type === 'water' ? '#7FE8FF' : '#FFD23F');
    if (obj.type === 'water') audio.water(); else audio.pickup();
  });
  game.on('bump', ({ obj, soft }) => {
    const p = game.project(obj.x, obj.y, Math.max(obj.z, 0.6), W(), H());
    renderer.burst(p.sx, p.sy, '#FFB199', soft ? 6 : 12, 120);
    if (soft && obj.kind !== 'food' && obj.kind !== 'special') { renderer.shake = 0.4; }
  });
  game.on('damage', () => { renderer.damageFlash(); audio.damage(); });
  game.on('emergency', () => { audio.emergency(); track('emergency'); });
  game.on('shoot', ({ target }) => { renderer.pulse(target.x, target.y); audio.shoot(); });
  game.on('miss', () => audio.miss());
  game.on('hit', ({ obj, gained, mult, screen }) => {
    renderer.burst(screen.x, screen.y, '#C98BFF', 24, 260);
    renderer.burst(screen.x, screen.y, '#FFFFFF', 10, 180);
    renderer.floater(screen.x, screen.y, `+${gained}${mult > 1 ? ' ×' + mult : ''}`);
    audio.hit();
  });
  game.on('wrong', ({ obj }) => { audio.wrong(); const p = game.project(obj.x, obj.y, obj.z, W(), H()); renderer.floater(p.sx, p.sy, `−${game.balance.residentPenalty}`, '#FF6B5E'); });
  game.on('gate', ({ items, bonus, gained, text }) => {
    if (!game.between) toast(text, items.length ? 'good' : '', 1500);
    if (items.length) { audio.gate(); popScore(`+${gained}`); renderer.burst(W() / 2, H() / 2, '#45D6FF', 30, 300); }
  });
  game.on('toast', ({ text, kind, short }) => toast(text, kind, short ? 800 : 1400));
  game.on('mission', ({ state, mission }) => {
    if (state === 'start') { setMissionPanel(mission, 'start'); toast(`${mission.def.title}`, 'good', 1800); }
    else if (state === 'done') { setMissionPanel(mission, 'done'); audio.pickup(); popScore(`+${mission.def.reward}`); }
    else if (state === 'failed') { /* итог покажет карточка раунда */ }
  });
  game.on('finish', (result) => {
    audio.finish();
    const prevBest = storage.getBest();
    const isBest = result.score > prevBest;
    if (isBest) storage.setBest(result.score);
    $('result-stars').textContent = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    $('result-newbest').hidden = !isBest;
    $('r-score').textContent = result.score;
    $('r-rounds').textContent = `${result.roundsWon}/${result.roundsTotal}`;
    $('result-rounds').innerHTML = result.rounds.map((r) => `<i class="${r.result || ''}" title="${r.title}"></i>`).join('');
    music.stop();
    $('r-accuracy').textContent = `${result.accuracy}%`;
    $('r-categories').textContent = result.categories.length ? result.categories.join(', ') : '—';
    $('best-line').hidden = false; $('best-score').textContent = Math.max(prevBest, result.score);
    track('finish', { score: result.score, stars: result.stars, rounds: result.roundsWon });
    setTimeout(() => show('result'), 900);
  });

  // ---- Запуск миссии ----
  let rafId = 0, lastTs = 0;
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    if (current !== 'game' && current !== 'pause') return;
    if (!game.paused && !game.finished) game.update(dt, input.read());
    tiltWatchdog();
    renderer.draw(game.paused ? 0 : dt);
    updateHud();
  }

  let tiltStartedAt = 0;
  function tiltWatchdog() {
    if (!input.tilt.enabled || game.paused || !game.started) return;
    if (!tiltStartedAt) return;
    // Датчики молчат дольше 4 секунд после старта — возвращаем джойстик, полёт продолжается
    if (performance.now() - tiltStartedAt > 4000 && !input.tiltAlive()) {
      input.disableTilt(); renderTilt(); tiltStartedAt = 0;
      toast(texts.hud.tiltFallback, 'warn', 2600);
      track('tilt_fallback');
    }
  }

  async function startMission() {
    audio.unlock();
    game.reset();
    renderer.particles = []; renderer.pulses = []; renderer.floaters = []; renderer.colors = null;
    lastHud = {};
    input.reset();
    roundOverlay.hidden = true; clearTimeout(roundTimer);
    setMissionPanel(null);
    show('game');
    track('mission_start', { tilt: input.tilt.enabled });
    if (input.tilt.enabled) {
      // Короткая калибровка: текущее положение телефона — нейтральное. Показываем, что датчик отвечает.
      const ov = $('tilt-overlay'); ov.hidden = false;
      const sensor = $('tilt-sensor');
      const t0 = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const alive = input.tiltAlive();
          sensor.textContent = `${texts.tilt.sensor}: ${alive ? `${texts.tilt.ok} (β ${input.tilt.beta.toFixed(0)}° γ ${input.tilt.gamma.toFixed(0)}°)` : texts.tilt.nodata}`;
          if (performance.now() - t0 > 1800) resolve(); else requestAnimationFrame(tick);
        };
        tick();
      });
      input.calibrateTilt();
      ov.hidden = true;
      tiltStartedAt = performance.now();
    }
    game.start();
    music.start();
    toast(texts.hud.tutorialWelcome, 'good', 2000);
    if (!rafId) { lastTs = performance.now(); rafId = requestAnimationFrame(loop); }
  }

  function pause(fromSystem = false) {
    if (current !== 'game' || game.finished || !game.started) return;
    game.paused = true;
    clearTimeout(roundTimer);
    show('pause');
    input.reset();
    music.stop();
    track('pause', { system: fromSystem });
  }
  function resume() {
    if (current !== 'pause') return;
    game.paused = false;
    lastTs = performance.now();
    show('game');
    music.start();
    if (input.tilt.enabled) input.calibrateTilt();
    if (game.between && roundOverlay.hidden === false) roundTimer = setTimeout(advanceRound, 1500);
  }

  $('btn-play').addEventListener('click', startMission);
  $('btn-replay').addEventListener('click', () => { track('replay'); startMission(); });
  $('btn-restart').addEventListener('click', () => { track('replay'); startMission(); });
  $('btn-howto').addEventListener('click', () => { audio.unlock(); show('howto'); });
  $('btn-howto-close').addEventListener('click', () => show('start'));
  $('btn-pause').addEventListener('click', () => pause(false));
  $('btn-resume').addEventListener('click', resume);
  $('btn-quit').addEventListener('click', () => { game.paused = false; game.started = false; music.stop(); roundOverlay.hidden = true; clearTimeout(roundTimer); show('start'); });
  $('btn-menu').addEventListener('click', () => show('start'));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (current === 'game') pause(false); else if (current === 'pause') resume(); }
    if (e.code === 'Enter' && current === 'start') startMission();
  });

  // Пауза при уходе со вкладки — возвращение требует нажатия «Продолжить»
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => { if (input.isTouch) return; pause(true); });

  // Размер холста
  const onResize = () => { renderer.resize(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 150));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  window.__superjkt = { game, renderer, input };
  $('loading').hidden = true;
  show('start');
  track('launch');
}

boot();
