import { normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'

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
  const rate = normalizeThbPerUnitRate(code, thbPerUnitMap?.[code])
  if (rate == null || rate <= 0) return null
  return thb / rate
}
