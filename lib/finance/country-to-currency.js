/**
 * Map ISO 3166-1 alpha-2 → suggested display currency for landing copy (illustrative).
 */

const EU_EUR = new Set([
  'AT',
  'BE',
  'CY',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SK',
  'SI',
  'ES',
])

/** @param {string | null | undefined} iso2 */
export function countryCodeToSuggestedCurrency(iso2) {
  const c = String(iso2 || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  if (!c || c.length !== 2) return null
  if (c === 'TH') return 'THB'
  if (c === 'US') return 'USD'
  if (c === 'GB') return 'GBP'
  if (c === 'RU') return 'RUB'
  if (c === 'CN' || c === 'HK') return 'CNY'
  if (EU_EUR.has(c)) return 'EUR'
  /** Display FX SSOT совпадает с referral-дропдауном (нет отдельных USD/JPY в exchange_rates без строки в БД). */
  if (['JP', 'KR', 'AU', 'SG', 'IN'].includes(c)) return 'USD'
  return 'USD'
}
