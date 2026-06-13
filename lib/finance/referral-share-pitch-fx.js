/**
 * Stage 132.2 / 134 — RUB teaser for share pitches (mid rate, 0% referral spread).
 */
import { convertReferralPayoutThbToCurrency } from '@/lib/services/marketing/referral-payout-fx.service.js'

/**
 * @param {number} welcomeBonusThb
 * @returns {Promise<{ welcomeBonusRub: number | null, midRateRubToThb: number | null }>}
 */
export async function buildReferralSharePitchFx(welcomeBonusThb) {
  const thb = Number(welcomeBonusThb)
  if (!Number.isFinite(thb) || thb <= 0) {
    return { welcomeBonusRub: null, midRateRubToThb: null }
  }
  try {
    const fx = await convertReferralPayoutThbToCurrency(thb, 'RUB')
    return {
      welcomeBonusRub: fx.amountInPayoutCurrency,
      midRateRubToThb: fx.midRateToThb,
    }
  } catch {
    return { welcomeBonusRub: null, midRateRubToThb: null }
  }
}

export default { buildReferralSharePitchFx }
