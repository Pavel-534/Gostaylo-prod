/**
 * Stage 100.7 — display-only helpers for server payout preview (no client FX).
 * Stage 186.0 — amount formatting SSOT: `@/lib/partner/partner-money-display`.
 */

export {
  formatAbsoluteAmountInCurrency,
  formatPayoutRailAmount,
  formatServerPayoutAmount,
} from '@/lib/partner/partner-money-display'

import { formatAbsoluteAmountInCurrency } from '@/lib/partner/partner-money-display'

export function interpolateTemplate(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''))
}

export function buildPayoutReceiveRateLine(t, preview, language) {
  if (preview?.amountInPayoutCurrency == null) return null
  const payoutCurrency = preview.payoutCurrency || 'THB'
  const receiveApprox = formatAbsoluteAmountInCurrency(
    preview.amountInPayoutCurrency,
    payoutCurrency,
    language,
  )
  return interpolateTemplate(t('partnerFinances_withdrawReceiveApprox'), {
    amount: receiveApprox,
  })
}
