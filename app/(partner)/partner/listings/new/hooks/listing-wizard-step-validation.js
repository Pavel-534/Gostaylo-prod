/**
 * Stage 109.3 / 116.0 — wizard step gate (SSOT for canProceed).
 */

import { computeWizardStorefrontPricePreview } from '@/lib/pricing/fx-display-client.js'
import {
  LISTING_SOFT_MIN_DESCRIPTION,
  LISTING_SOFT_MIN_PHOTOS,
  LISTING_QUALITY_MIN_TITLE,
  validateListingPublishQuality,
} from '@/lib/partner/listing-quality-gates.js'

/**
 * Step validation: 1 general+specs; 2 location; 3 photos; 4 pricing; 5 preview.
 * Stage 200.23 — step Next uses soft minima so partners can reach soft publish;
 * full quality still gates the primary Publish CTA via publishQualityChecklist.
 */
export function computeWizardCanProceed(currentStep, formData, coordsValid, ctx = {}) {
  void coordsValid
  void ctx

  const generalOk =
    Boolean(formData.listingServiceType) &&
    formData.categoryId &&
    formData.title.length >= LISTING_QUALITY_MIN_TITLE &&
    String(formData.description || '').trim().length >= LISTING_SOFT_MIN_DESCRIPTION

  // Soft path: district enough to continue; coords remain in full publish checklist.
  const locOk = Boolean(String(formData.district || '').trim())

  const photosOk = (formData.images || []).length >= LISTING_SOFT_MIN_PHOTOS
  const priceOk = parseFloat(String(formData.basePriceThb).replace(',', '.')) > 0

  switch (currentStep) {
    case 1:
      return generalOk
    case 2:
      return locOk
    case 3:
      return photosOk
    case 4:
      return priceOk
    case 5:
      return generalOk && locOk && photosOk && priceOk
    default:
      return false
  }
}

/**
 * Витрина: guest fee в THB + retail FX в `listingBaseCurrency` (если ≠ THB и есть rateMap).
 * @param {number | string} basePriceThb
 * @param {object} pricingPolicy
 * @param {{ listingBaseCurrency?: string, exchangeRates?: Record<string, number> | null }} [ctx]
 */
export function computeWizardPricingPreview(basePriceThb, pricingPolicy, ctx = {}) {
  return computeWizardStorefrontPricePreview(basePriceThb, pricingPolicy, {
    listingBaseCurrency: ctx.listingBaseCurrency,
    exchangeRates: ctx.exchangeRates,
  })
}

export { validateListingPublishQuality }
