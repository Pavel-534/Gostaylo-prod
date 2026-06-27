/**
 * Checkout payment method UI groups — presentation SSOT (Stage 171.24).
 *
 * Server contract: `MIR` | `CARD` | `CRYPTO` on payment_intents / initiate.
 * Display groups must NOT filter by geo, IP, or listing country — only by `allowedMethods`.
 *
 * @typedef {'MIR' | 'CARD' | 'CRYPTO'} CheckoutPaymentMethod
 */

/** Russia-facing rail (YooKassa / RUB). */
export const CHECKOUT_PAYMENT_METHODS_RU = Object.freeze(['MIR'])

/** International cards + crypto. */
export const CHECKOUT_PAYMENT_METHODS_INTL = Object.freeze(['CARD', 'CRYPTO'])

export const RU_PAYMENT_METHODS = new Set(CHECKOUT_PAYMENT_METHODS_RU)

export const INTL_PAYMENT_METHODS = new Set(CHECKOUT_PAYMENT_METHODS_INTL)

/**
 * @param {string} method
 * @param {Set<string>} groupSet
 */
export function isCheckoutMethodInGroup(method, groupSet) {
  return groupSet.has(String(method || '').toUpperCase().trim())
}
