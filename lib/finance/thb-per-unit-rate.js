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

/** Smoke/e2e default RUB/THB (see SMOKE_MIR_RUB_PER_THB). */
export const SMOKE_DEFAULT_RUB_PER_THB = 2.8

/** THB per 1 RUB at smoke default — must not persist on production storefront. */
export function smokeDefaultThbPerRub() {
  return 1 / SMOKE_DEFAULT_RUB_PER_THB
}

/**
 * Detect legacy smoke row (1/2.8) that passed DB constraint (< 1) but overprices RUB.
 * @param {number} thbPerRub — normalized rate_to_thb for RUB
 */
export function isLikelySmokeDefaultRubThbPerUnit(thbPerRub) {
  const r = Number(thbPerRub)
  if (!Number.isFinite(r) || r <= 0) return false
  return Math.abs(r - smokeDefaultThbPerRub()) < 1e-5
}

/**
 * RUB/USD implied from THB legs; smoke RUB (~2.8 ₽/฿) inflates cross above ~84.
 * @param {number} usdThbPerUnit
 * @param {number} rubThbPerUnit
 */
export function isRubUsdCrossRateAnomaly(usdThbPerUnit, rubThbPerUnit) {
  const u = Number(usdThbPerUnit)
  const r = Number(rubThbPerUnit)
  if (!Number.isFinite(u) || !Number.isFinite(r) || u <= 0 || r <= 0) return false
  return u / r > 84
}

export default {
  normalizeThbPerUnitRate,
  thbPerRubFromRubPerThb,
  rubPerThbFromThbPerRub,
  SMOKE_DEFAULT_RUB_PER_THB,
  smokeDefaultThbPerRub,
  isLikelySmokeDefaultRubThbPerUnit,
  isRubUsdCrossRateAnomaly,
}
