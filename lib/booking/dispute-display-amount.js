/**
 * Stage 147 — SSOT: суммы для dispute UI и in-chat milestones.
 *
 * Гость — `readGuestPaymentDisplay` (snapshot currency).
 * Партнёр / ledger — partner net в THB (la-sys-dispute-hold).
 *
 * @see lib/booking/guest-payment-display.js
 * @see lib/services/dispute/dispute-payout-freeze.js
 */

import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'
import { extractSettlementSnapshot } from '@/lib/services/escrow/utils.js'
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
 * Partner payout hold (ledger / la-sys-dispute-hold).
 * @param {object | null | undefined} booking
 * @returns {number}
 */
export function resolveDisputePartnerHoldThb(booking) {
  const settlement = extractSettlementSnapshot(booking)
  const price = parseFloat(booking?.price_thb) || 0
  const comm = parseFloat(booking?.commission_thb) || 0
  const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
    ? parseFloat(settlement.partner_net.thb)
    : parseFloat(booking?.partner_earnings_thb) || price - comm
  return round2(net)
}

/**
 * Guest order total in payment currency (immutable snapshot).
 * @param {object | null | undefined} booking
 * @param {string} [language]
 * @returns {{ amount: number, currency: string, source: string } | null}
 */
export function resolveDisputeGuestDisplayAmount(booking, language = 'ru') {
  const row = readGuestPaymentDisplay(booking, { language })
  if (!row) return null
  return {
    amount: row.amount,
    currency: row.currency,
    source: row.source,
  }
}

/**
 * @param {number} amount
 * @param {string} currency
 * @param {string} [language]
 * @returns {string}
 * @deprecated Use formatGuestPaymentDisplayAmount
 */
export function formatDisputeDisplayAmount(amount, currency, language = 'ru') {
  return formatGuestPaymentDisplayAmount(amount, currency, language)
}

/**
 * @param {object | null | undefined} booking
 * @param {string} [language]
 * @returns {{ guestDisplayAmount: number | null, guestDisplayCurrency: string | null, guestDisplayLabel: string | null, partnerHoldThb: number, guestPayableThb: number }}
 */
export function resolveDisputeDisplayFields(booking, language = 'ru') {
  const guest = readGuestPaymentDisplay(booking, { language })
  const partnerHoldThb = resolveDisputePartnerHoldThb(booking)
  let guestPayableThb = 0
  try {
    guestPayableThb = round2(getGuestPayableRoundedThb(booking))
  } catch {
    guestPayableThb = round2(booking?.price_thb ?? 0)
  }

  return {
    guestDisplayAmount: guest?.amount ?? null,
    guestDisplayCurrency: guest?.currency ?? null,
    guestDisplayLabel: guest?.displayAmount ?? null,
    partnerHoldThb,
    guestPayableThb,
    guestDisplaySource: guest?.source ?? null,
  }
}
