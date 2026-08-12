/**
 * Stage 200.121 — fail-closed payment initiate when checkout hold TTL elapsed.
 * Aligns initiate with CheckoutHoldTimer / cron hold policy (no PricingEngine reprice).
 */

import { isCheckoutHoldExpired } from '@/lib/booking/checkout-hold-policy.js'

/**
 * @param {{
 *   booking?: object | null
 *   invoice?: object | null
 *   intentRow?: { initiated_at?: string|null, created_at?: string|null, expires_at?: string|null } | null
 *   nowMs?: number
 * }} args
 * @returns {{ ok: true } | { ok: false, code: string, error: string, status: number }}
 */
export function assertCheckoutHoldAllowsPaymentInitiate({
  booking = null,
  invoice = null,
  intentRow = null,
  nowMs = Date.now(),
} = {}) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const intentStartedAt =
    intentRow?.initiated_at ||
    intentRow?.created_at ||
    meta.paymentInitiatedAt ||
    meta.payment_initiated_at ||
    null
  const intentExpiresAt = intentRow?.expires_at || null

  if (
    !isCheckoutHoldExpired({
      booking,
      invoice,
      intentStartedAt,
      intentExpiresAt,
      nowMs,
    })
  ) {
    return { ok: true }
  }

  return {
    ok: false,
    code: 'CHECKOUT_HOLD_EXPIRED',
    error:
      'Checkout payment window has expired — refresh the page or create a new booking to refresh pricing',
    status: 410,
  }
}
