/**
 * Stage 175.4 / 200.124 — guest system copy for host invoice payment window.
 * Kept out of `payment-window-policy.js` so hold/TTL helpers stay browser-safe
 * (no `node:module` / createRequire in the checkout client graph).
 */

import { isTransportListingCategory } from '../listing-category-slug.js'
import { getUIText } from '../translations/index.js'

/**
 * Guest-facing system copy when host sends a payable invoice (Stage 175.4 i18n).
 * @param {string | null | undefined} categorySlug
 * @param {string} [lang]
 * @returns {string}
 */
export function buildInvoicePaymentWindowSystemMessage(categorySlug, lang = 'ru') {
  const key = isTransportListingCategory(categorySlug)
    ? 'invoicePaymentWindow_notice_transport'
    : 'invoicePaymentWindow_notice_default'
  return getUIText(key, lang)
}

export default { buildInvoicePaymentWindowSystemMessage }
