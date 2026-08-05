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
  return computeWizardStepBlockers(currentStep, formData, coordsValid, ctx).length === 0
}

/**
 * Human-readable blockers for the current step (why Next is disabled).
 * Stage 200.28 — tips; Stage 200.29 — `field` for red highlight / scroll.
 * @returns {Array<{ i18nKey: string, field?: string, params?: Record<string, string|number> }>}
 */
export function computeWizardStepBlockers(currentStep, formData, coordsValid, ctx = {}) {
  void coordsValid
  void ctx
  const blockers = []
  const titleLen = String(formData?.title || '').trim().length
  const descLen = String(formData?.description || '').trim().length
  const photos = Array.isArray(formData?.images) ? formData.images.filter(Boolean).length : 0
  const price = parseFloat(String(formData?.basePriceThb ?? '').replace(',', '.'))

  const pushGeneral = () => {
    if (!formData?.listingServiceType) {
      blockers.push({ i18nKey: 'wizardBlocker_serviceType', field: 'listingServiceType' })
    }
    if (!formData?.categoryId) {
      blockers.push({ i18nKey: 'wizardBlocker_category', field: 'categoryId' })
    }
    if (titleLen < LISTING_QUALITY_MIN_TITLE) {
      blockers.push({
        i18nKey: 'wizardBlocker_title',
        field: 'title',
        params: { min: LISTING_QUALITY_MIN_TITLE, current: titleLen },
      })
    }
    if (descLen < LISTING_SOFT_MIN_DESCRIPTION) {
      blockers.push({
        i18nKey: 'wizardBlocker_description',
        field: 'description',
        params: { min: LISTING_SOFT_MIN_DESCRIPTION, current: descLen },
      })
    }
  }

  switch (currentStep) {
    case 1:
      pushGeneral()
      break
    case 2:
      if (!String(formData?.district || '').trim()) {
        blockers.push({ i18nKey: 'wizardBlocker_district', field: 'district' })
      }
      break
    case 3:
      if (photos < LISTING_SOFT_MIN_PHOTOS) {
        blockers.push({
          i18nKey: 'wizardBlocker_photos',
          field: 'images',
          params: { min: LISTING_SOFT_MIN_PHOTOS, current: photos },
        })
      }
      break
    case 4:
      if (!Number.isFinite(price) || price <= 0) {
        blockers.push({ i18nKey: 'wizardBlocker_price', field: 'basePriceThb' })
      }
      break
    case 5:
      pushGeneral()
      if (!String(formData?.district || '').trim()) {
        blockers.push({ i18nKey: 'wizardBlocker_district', field: 'district' })
      }
      if (photos < LISTING_SOFT_MIN_PHOTOS) {
        blockers.push({
          i18nKey: 'wizardBlocker_photos',
          field: 'images',
          params: { min: LISTING_SOFT_MIN_PHOTOS, current: photos },
        })
      }
      if (!Number.isFinite(price) || price <= 0) {
        blockers.push({ i18nKey: 'wizardBlocker_price', field: 'basePriceThb' })
      }
      break
    default:
      blockers.push({ i18nKey: 'wizardBlocker_unknownStep' })
  }

  return blockers
}

/**
 * @param {Array<{ field?: string }>} blockers
 * @returns {Record<string, boolean>}
 */
export function wizardStepFieldErrorsFromBlockers(blockers) {
  /** @type {Record<string, boolean>} */
  const out = {}
  for (const b of blockers || []) {
    if (b?.field) out[b.field] = true
  }
  return out
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
