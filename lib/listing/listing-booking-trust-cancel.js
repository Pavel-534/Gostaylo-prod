/**
 * Stage 200.122 — PDP booking trust cancel label (display-only, no PricingEngine).
 */

import { listingsPublicUi } from '@/lib/translations/listings-public.js'
import { normalizeCancellationPolicy } from '@/lib/cancellation-refund-rules'

/**
 * Strict/moderate → neutral “cancellation rules”. Flexible → soft free-cancel wording.
 * @param {string | null | undefined} policyRaw
 * @param {string} [language]
 */
export function resolveListingBookingTrustCancelLabel(policyRaw, language = 'ru') {
  const lang = ['ru', 'en', 'zh', 'th'].includes(String(language || ''))
    ? String(language)
    : 'en'
  const slice = listingsPublicUi[lang] || listingsPublicUi.en
  const p = normalizeCancellationPolicy(policyRaw)
  if (p === 'flexible') {
    return String(slice.listingBookingTrust_cancelFlexible || slice.listingBookingTrust_cancel || '')
  }
  return String(slice.listingBookingTrust_cancel || '')
}
