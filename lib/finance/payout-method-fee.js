/**
 * Отображение и нормализация комиссии методов выплаты (payout_methods.fee_type).
 * PostgREST/клиенты могут отдавать feeType или другой регистр — всё сводим к канону.
 */

const CANON = ['percentage', 'fixed']

export function normalizePayoutFeeType(value) {
  const normalized = String(value ?? 'fixed').toLowerCase().trim()
  return CANON.includes(normalized) ? normalized : 'fixed'
}

export function isPayoutFeePercentage(method) {
  if (!method || typeof method !== 'object') return false
  return normalizePayoutFeeType(method.fee_type ?? method.feeType) === 'percentage'
}

/** Суффикс для option / списка: «3.5% · мин. 500 RUB» или фикс в валюте. */
export function formatPayoutMethodOptionSuffix(method) {
  const pct = isPayoutFeePercentage(method)
  const value = Number(method?.value) || 0
  const currency = String(method?.currency || 'THB').toUpperCase()
  const min = Number(method?.min_payout ?? method?.minPayout ?? 0) || 0
  if (pct) return `${value}% · мин. ${min} ${currency}`
  return `${value} ${currency} · мин. ${min} ${currency}`
}
