/**
 * Stage 134 — display-only conversion for ambassador wallet balances (ledger stays THB).
 */
import { convertReferralPayoutThbToCurrency } from '@/lib/services/marketing/referral-payout-fx.service.js'
import { normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency.js'

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {{
 *   totalBalanceThb?: number,
 *   withdrawableBalanceThb?: number,
 *   internalCreditsThb?: number,
 *   heldReferralBalanceThb?: number,
 *   securityHeldReferralBalanceThb?: number,
 * }} balancesThb
 * @param {string} [displayCurrencyRaw]
 */
export async function buildReferralDisplayBalances(balancesThb, displayCurrencyRaw = 'THB') {
  const currency = normalizeReferralDisplayCurrency(displayCurrencyRaw)
  const thb = {
    total: round2(balancesThb?.totalBalanceThb ?? 0),
    withdrawable: round2(balancesThb?.withdrawableBalanceThb ?? 0),
    internalCredits: round2(balancesThb?.internalCreditsThb ?? 0),
    heldReferral: round2(balancesThb?.heldReferralBalanceThb ?? 0),
    securityHeldReferral: round2(balancesThb?.securityHeldReferralBalanceThb ?? 0),
  }

  if (currency === 'THB') {
    return {
      currency: 'THB',
      ledgerBaseCurrency: 'THB',
      midRateToThb: 1,
      ...thb,
    }
  }

  const convert = async (amountThb) => {
    const fx = await convertReferralPayoutThbToCurrency(amountThb, currency)
    return fx.amountInPayoutCurrency
  }

  const [total, withdrawable, internalCredits, heldReferral, securityHeldReferral, rateFx] =
    await Promise.all([
      convert(thb.total),
      convert(thb.withdrawable),
      convert(thb.internalCredits),
      convert(thb.heldReferral),
      convert(thb.securityHeldReferral),
      convertReferralPayoutThbToCurrency(1, currency),
    ])

  return {
    currency,
    ledgerBaseCurrency: 'THB',
    midRateToThb: rateFx.midRateToThb,
    total,
    withdrawable,
    internalCredits,
    heldReferral,
    securityHeldReferral,
  }
}

export default { buildReferralDisplayBalances }
