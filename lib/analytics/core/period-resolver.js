/**
 * Stage 124.4 — SSOT периодов для Financial Intelligence (UTC).
 */

const MS_DAY = 24 * 60 * 60 * 1000;

/** @typedef {'today' | '7d' | '30d'} AnalyticsPeriodPreset */

export const ANALYTICS_PERIOD_PRESETS = Object.freeze([
  { id: 'today', label: 'Сегодня', days: 1 },
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
]);

/**
 * @param {AnalyticsPeriodPreset | string} presetId
 * @returns {{ preset: AnalyticsPeriodPreset, current: { fromIso: string, toIso: string }, previous: { fromIso: string, toIso: string } }}
 */
export function resolveAnalyticsPeriod(presetId = '30d') {
  const preset = ANALYTICS_PERIOD_PRESETS.find((p) => p.id === presetId)?.id || '30d';
  const def = ANALYTICS_PERIOD_PRESETS.find((p) => p.id === preset) || ANALYTICS_PERIOD_PRESETS[2];
  const now = new Date();
  const toIso = now.toISOString();

  if (preset === 'today') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime());
    prevStart.setUTCHours(0, 0, 0, 0);
    return {
      preset,
      current: { fromIso: start.toISOString(), toIso },
      previous: { fromIso: prevStart.toISOString(), toIso: prevEnd.toISOString() },
    };
  }

  const days = def.days || 30;
  const currentFrom = new Date(now.getTime() - days * MS_DAY);
  const prevTo = new Date(currentFrom.getTime() - 1);
  const prevFrom = new Date(currentFrom.getTime() - days * MS_DAY);

  return {
    preset,
    current: { fromIso: currentFrom.toISOString(), toIso },
    previous: { fromIso: prevFrom.toISOString(), toIso: prevTo.toISOString() },
  };
}

/**
 * @param {number | null | undefined} current
 * @param {number | null | undefined} previous
 */
export function calcPeriodDeltaPct(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  if (p === 0) return c === 0 ? 0 : null;
  return Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
}
