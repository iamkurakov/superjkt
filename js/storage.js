// Локальное сохранение: лучший результат и настройки. Недоступность хранилища не прерывает игру.
const PREFIX = 'superjkt.';

function safeGet(key) {
  try { return window.localStorage.getItem(PREFIX + key); } catch (e) { return null; }
}
function safeSet(key, value) {
  try { window.localStorage.setItem(PREFIX + key, String(value)); return true; } catch (e) { return false; }
}

export const storage = {
  getBest() { const v = parseInt(safeGet('best'), 10); return Number.isFinite(v) ? v : 0; },
  setBest(v) { safeSet('best', v); },
  getSound() { const v = safeGet('sound'); return v === null ? true : v === '1'; },
  setSound(on) { safeSet('sound', on ? '1' : '0'); },
  getTilt() { return safeGet('tilt') === '1'; },
  setTilt(on) { safeSet('tilt', on ? '1' : '0'); },
  getView() { return safeGet('view') === 'third' ? 'third' : 'first'; },
  setView(v) { safeSet('view', v); },
};
