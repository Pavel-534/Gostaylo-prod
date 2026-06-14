/**
 * SSOT: `exchange_rates.rate_to_thb` = THB per 1 unit of foreign currency.
 * Convert to display: amountInCurrency = amountThb / rate_to_thb.
 * Retail margin: divide rate_to_thb by chatInvoiceRateMultiplier (see currency.service).
 */

/**
 * @param {string} currencyCode
 * @param {number} rawRate — value from DB/env/API before normalization
 * @returns {number | null}
 */
export function normalizeThbPerUnitRate(currencyCode, rawRate) {
  const code = String(currencyCode || '').toUpperCase().trim()
  const n = Number(rawRate)
  if (!Number.isFinite(n) || n <= 0) return null

  // 1 RUB is always weaker than 1 THB → THB per RUB ∈ (0, 1).
  // Legacy smoke/e2e wrote RUB/THB (~2.2–2.8) into rate_to_thb by mistake.
  if (code === 'RUB' && n > 1) {
    return 1 / n
  }

  return n
}

/** @param {number} rubPerThb — how many RUB for 1 THB */
export function thbPerRubFromRubPerThb(rubPerThb) {
  const r = Number(rubPerThb)
  if (!Number.isFinite(r) || r <= 0) return null
  return 1 / r
}

/** @param {number} thbPerRub — THB per 1 RUB (column semantics) */
export function rubPerThbFromThbPerRub(thbPerRub) {
  const r = Number(thbPerRub)
  if (!Number.isFinite(r) || r <= 0) return null
  return 1 / r
}

export default {
  normalizeThbPerUnitRate,
  thbPerRubFromRubPerThb,
  rubPerThbFromThbPerRub,
}
