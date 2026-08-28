/**
 * Stage 138.2 / 202.12 — terminal payment-intent + booking statuses after acquirer return (checkout UI).
 * SSOT intent codes: `lib/services/payment-adapters/constants.js` → INTERNAL_INTENT_STATUSES
 */

const CHECKOUT_INTENT_FAILED_STATUSES = new Set(['FAILED', 'CANCELLED', 'EXPIRED'])

/** Escrow / post-capture pipeline — safe to celebrate payment success. */
const CHECKOUT_BOOKING_SETTLED_STATUSES = new Set([
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
])

/** @param {unknown} status */
export function isCheckoutIntentPaymentFailed(status) {
  return CHECKOUT_INTENT_FAILED_STATUSES.has(String(status ?? '').trim().toUpperCase())
}

/** @param {unknown} status */
export function isCheckoutIntentPaymentPaid(status) {
  return String(status ?? '').trim().toUpperCase() === 'PAID'
}

/**
 * Stage 202.12 — guest UI success only after escrow (or further pipeline), not bare intent PAID.
 * @param {unknown} status
 */
export function isCheckoutBookingPaymentSettled(status) {
  return CHECKOUT_BOOKING_SETTLED_STATUSES.has(String(status ?? '').trim().toUpperCase())
}

/**
 * Money captured at gateway but escrow RPC may still be in flight.
 * @param {unknown} status
 */
export function isCheckoutBookingPaymentCapturedPendingEscrow(status) {
  return String(status ?? '').trim().toUpperCase() === 'PAID'
}
