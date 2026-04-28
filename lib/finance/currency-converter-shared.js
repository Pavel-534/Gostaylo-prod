/**
 * Client-safe helpers: same math as `CurrencyService.convertAmountThbToCurrency`.
 * `rateMap[currency]` = THB за 1 единицу валюты (из GET /api/v2/exchange-rates).
 */

/**
 * @param {number} amountThb
 * @param {string} currencyCode
 * @param {Record<string, number>} thbPerUnitMap
 */
export function convertAmountThbWithMap(amountThb, currencyCode, thbPerUnitMap) {
  const thb = Number(amountThb)
  if (!Number.isFinite(thb)) return null
  const code = String(currencyCode || 'THB').toUpperCase().trim()
  if (code === 'THB') return thb
  const rate = thbPerUnitMap?.[code]
  if (!Number.isFinite(rate) || rate <= 0) return null
  return thb / rate
}
