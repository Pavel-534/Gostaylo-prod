/** Shared UI helpers for referral campaign admin (Stage 122.3). */

export function computeDaysUntilExpiry(expiresAtIso) {
  if (!expiresAtIso) return null;
  const end = new Date(expiresAtIso);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

export function formatDaysUntilExpiry(expiresAtIso) {
  const days = computeDaysUntilExpiry(expiresAtIso);
  if (days == null) return '—';
  if (days < 0) return 'истекла';
  if (days === 0) return 'сегодня';
  if (days === 1) return '1 день';
  return `${days} дн.`;
}

/**
 * @returns {'ok'|'warning'|'critical'|null} null = no max budget
 */
export function computeBudgetAlertLevel(maxBudgetThb, spentThb) {
  const max = Number(maxBudgetThb);
  const spent = Number(spentThb) || 0;
  if (!Number.isFinite(max) || max <= 0) return null;
  const pct = (spent / max) * 100;
  if (pct >= 100) return 'critical';
  if (pct >= 90) return 'warning';
  return 'ok';
}

export function computeBudgetUsagePct(maxBudgetThb, spentThb) {
  const max = Number(maxBudgetThb);
  const spent = Number(spentThb) || 0;
  if (!Number.isFinite(max) || max <= 0) return null;
  return Math.min(100, Math.round((spent / max) * 1000) / 10);
}
