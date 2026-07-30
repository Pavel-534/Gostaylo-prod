/**
 * Stage 199.1 — checkout resume deep-link helpers (pure).
 */

export const CHECKOUT_STICKY_PAY_ANCHOR_ID = 'checkout-sticky-pay'

/**
 * @param {string | number | null | undefined} bookingId
 * @returns {string}
 */
export function unpaidCheckoutDeepLink(bookingId) {
  if (bookingId == null || bookingId === '') return '/checkout'
  return `/checkout/${encodeURIComponent(String(bookingId))}?resume=1#${CHECKOUT_STICKY_PAY_ANCHOR_ID}`
}

/**
 * @param {string | null | undefined} search
 * @param {string | null | undefined} hash
 */
export function shouldFocusCheckoutStickyPay(search, hash) {
  const h = String(hash || '')
  if (h === `#${CHECKOUT_STICKY_PAY_ANCHOR_ID}` || h.includes(CHECKOUT_STICKY_PAY_ANCHOR_ID)) {
    return true
  }
  try {
    const q = new URLSearchParams(String(search || '').replace(/^\?/, ''))
    return q.get('resume') === '1' || q.get('focus') === 'pay'
  } catch {
    return false
  }
}
