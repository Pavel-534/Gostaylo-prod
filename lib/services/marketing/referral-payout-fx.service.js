/**
 * Stage 131.3 — ambassador referral payout FX (mid-only, 0% platform spread).
 * Separate from partner host payout (`lib/partner/partner-payout-fx.js`).
 */
import { getRawRateMap } from '@/lib/services/pricing/pricing-fx-helpers.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function roundRub(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

/**
 * Convert THB → payout currency at mid market rate (no spread).
 * @param {number} thbAmount
 * @param {'THB'|'RUB'|string} payoutCurrency
 */
export async function convertReferralPayoutThbToCurrency(thbAmount, payoutCurrency = 'THB', opts = {}) {
  const thb = round2(thbAmount)
  const currency = String(payoutCurrency || 'THB').trim().toUpperCase()
  const rawMap = opts.rawRateMap || (await getRawRateMap())

  if (currency === 'THB' || thb <= 0) {
    return {
      amountInPayoutCurrency: thb,
      payoutCurrency: 'THB',
      amountThb: thb,
      midRateToThb: 1,
      spreadPct: 0,
    }
  }

  const midRateToThb = Number(rawMap[currency])
  if (!Number.isFinite(midRateToThb) || midRateToThb <= 0) {
    throw new Error(`REFERRAL_PAYOUT_FX_MISSING_RATE:${currency}`)
  }

  const converted =
    currency === 'RUB'
      ? roundRub(thb / midRateToThb)
      : round2(thb / midRateToThb)

  return {
    amountInPayoutCurrency: converted,
    payoutCurrency: currency,
    amountThb: thb,
    midRateToThb,
    spreadPct: 0,
  }
}

export default { convertReferralPayoutThbToCurrency }
