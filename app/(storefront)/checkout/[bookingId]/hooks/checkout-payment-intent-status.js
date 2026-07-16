/**
 * Stage 138.2 — terminal payment-intent statuses after acquirer return (checkout UI only).
 * SSOT intent codes: `lib/services/payment-adapters/constants.js` → INTERNAL_INTENT_STATUSES
 */

const CHECKOUT_INTENT_FAILED_STATUSES = new Set(['FAILED', 'CANCELLED', 'EXPIRED'])

/** @param {unknown} status */
export function isCheckoutIntentPaymentFailed(status) {
  return CHECKOUT_INTENT_FAILED_STATUSES.has(String(status ?? '').trim().toUpperCase())
}

/** @param {unknown} status */
export function isCheckoutIntentPaymentPaid(status) {
  return String(status ?? '').trim().toUpperCase() === 'PAID'
}
