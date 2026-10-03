// События аналитики. Подключение конкретного сервиса согласуется перед публикацией.
// Ошибка аналитики никогда не влияет на полёт.
export function track(event, params = {}) {
  try {
    const payload = { event: 'superjkt_' + event, ...params, ts: Date.now() };
    if (typeof window.superjktAnalytics === 'function') window.superjktAnalytics(payload);
    if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
    if (window.ym && window.YM_COUNTER_ID) window.ym(window.YM_COUNTER_ID, 'reachGoal', payload.event, params);
  } catch (e) { /* игнорируем */ }
}
