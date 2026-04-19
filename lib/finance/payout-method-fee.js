/**
 * Отображение и нормализация комиссии методов выплаты (payout_methods.fee_type).
 * PostgREST/клиенты могут отдавать feeType или другой регистр — всё сводим к канону.
 */

const CANON = ['percentage', 'fixed']

export function normalizePayoutFeeType(value) {
  let s = String(value ?? 'fixed').toLowerCase().trim()
  // PostgREST / прокси иногда отдают лишние кавычки или zero-width
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).toLowerCase().trim()
  }
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '')
  return CANON.includes(s) ? s : 'fixed'
}

/**
 * Итоговый тип комиссии для строки payout_methods: смотрим и fee_type, и feeType.
 * Если в одном из полей явно percentage — это процент (страховка от рассинхрона ключей/прокси).
 */
export function resolvePayoutFeeTypeFromMethodRow(row) {
  if (!row || typeof row !== 'object') return 'fixed'
  for (const c of [row.feeType, row.fee_type]) {
    if (normalizePayoutFeeType(c) === 'percentage') return 'percentage'
  }
  return normalizePayoutFeeType(row.feeType ?? row.fee_type)
}

export function isPayoutFeePercentage(method) {
  return resolvePayoutFeeTypeFromMethodRow(method) === 'percentage'
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
