/**
 * Stage 109.3 / 116.0 — wizard step gate (SSOT for canProceed).
 */

import { computeWizardStorefrontPricePreview } from '@/lib/pricing/fx-display-client.js'
import {
  LISTING_QUALITY_MIN_DESCRIPTION,
  LISTING_QUALITY_MIN_PHOTOS,
  LISTING_QUALITY_MIN_TITLE,
  listingProfileRequiresGeoCoordinates,
  validateListingPublishQuality,
  validateListingMetadataForProfile,
} from '@/lib/partner/listing-quality-gates.js'

function metadataRequiredForStep1(formData, categorySlug, wizardProfile, categoryName) {
  return validateListingMetadataForProfile(
    formData.metadata,
    categorySlug,
    categoryName,
    wizardProfile,
  )
}

function coordsRequiredAndValid(formData, categorySlug, wizardProfile, categoryName, coordsValid) {
  if (!listingProfileRequiresGeoCoordinates(wizardProfile, categorySlug, categoryName)) {
    return coordsValid
  }
  const lat = formData.latitude
  const lng = formData.longitude
  if (lat == null || lng == null || lat === '' || lng === '') return false
  return coordsValid
}

/** Step validation: 1 general+specs; 2 location; 3 photos; 4 pricing; 5 preview. */
export function computeWizardCanProceed(currentStep, formData, coordsValid, ctx = {}) {
  const categorySlug = String(ctx.categorySlug || '')
  const categoryName = String(ctx.categoryName || '')
  const wizardProfile = ctx.wizardProfile ?? null

  const generalOk =
    Boolean(formData.listingServiceType) &&
    formData.categoryId &&
    formData.title.length >= LISTING_QUALITY_MIN_TITLE &&
    formData.description.length >= LISTING_QUALITY_MIN_DESCRIPTION &&
    metadataRequiredForStep1(formData, categorySlug, wizardProfile, categoryName)

  const locOk =
    Boolean(formData.district) &&
    coordsRequiredAndValid(formData, categorySlug, wizardProfile, categoryName, coordsValid)

  const photosOk = (formData.images || []).length >= LISTING_QUALITY_MIN_PHOTOS
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
