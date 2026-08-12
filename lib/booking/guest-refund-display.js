/**
 * Stage 200.121 — guest-facing refund estimate in locked payment currency.
 * Ledger still posts THB; UI shows a proportional share of locked guest brutto.
 */

import {
  formatGuestPaymentDisplayAmount,
  readGuestPaymentDisplay,
} from '@/lib/booking/guest-payment-display.js'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {{
 *   booking?: object | null
 *   refundGuestThb?: number
 *   guestTotalThb?: number
 *   language?: string
 * }} args
 * @returns {{
 *   currency: string
 *   amount: number
 *   displayAmount: string
 *   refundGuestThb: number
 *   source: string
 * }}
 */
export function estimateRefundInGuestPaymentCurrency({
  booking = null,
  refundGuestThb = 0,
  guestTotalThb = 0,
  language = 'ru',
} = {}) {
  const refundThb = round2(refundGuestThb)
  const totalThb = round2(guestTotalThb)
  const paid = readGuestPaymentDisplay(booking, { language })

  if (!paid || !(paid.amount > 0)) {
    return {
      currency: 'THB',
      amount: refundThb,
      displayAmount: formatGuestPaymentDisplayAmount(refundThb, 'THB', language),
      refundGuestThb: refundThb,
      source: 'thb_fallback',
    }
  }

  let amount
  if (String(paid.currency).toUpperCase() === 'THB') {
    amount = refundThb
  } else if (totalThb > 0) {
    amount = round2((paid.amount * refundThb) / totalThb)
  } else {
    amount = 0
  }

  return {
    currency: paid.currency,
    amount,
    displayAmount: formatGuestPaymentDisplayAmount(amount, paid.currency, language),
    refundGuestThb: refundThb,
    source: paid.source,
  }
}
