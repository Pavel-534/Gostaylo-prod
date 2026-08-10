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
import { detectPinCountryConflict } from '@/lib/geo/wizard-pin-country-conflict'

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
    case 2: {
      if (!String(formData?.country || '').trim()) {
        blockers.push({ i18nKey: 'wizardBlocker_country', field: 'country' })
      }
      const lat = formData?.latitude
      const lng = formData?.longitude
      const hasCoords =
        lat != null &&
        lng != null &&
        lat !== '' &&
        lng !== '' &&
        Number.isFinite(Number(lat)) &&
        Number.isFinite(Number(lng))
      if (!hasCoords) {
        blockers.push({ i18nKey: 'wizardBlocker_coordinates', field: 'coordinates' })
      }
      const hasCity =
        String(formData?.city || '').trim() ||
        String(formData?.metadata?.city_label || formData?.metadata?.city || '').trim()
      if (!hasCity) {
        blockers.push({ i18nKey: 'wizardBlocker_city', field: 'city' })
      }
      // Stage 200.83 — district is optional micro-label (auto from pin / free text)
      // Stage 200.46 — pin vs country conflict blocks Next until resolved/dismissed
      const conflict = detectPinCountryConflict({
        country: formData?.country,
        lat: formData?.latitude,
        lon: formData?.longitude,
        pinCountryCode: formData?.metadata?.geo_pin_country,
        dismissed: formData?.metadata?.geo_pin_country_conflict_dismissed === true,
      })
      if (conflict.blocked) {
        blockers.push({
          i18nKey: 'wizardBlocker_pinCountryConflict',
          field: 'pinCountryConflict',
        })
      }
      break
    }
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
      if (!String(formData?.country || '').trim()) {
        blockers.push({ i18nKey: 'wizardBlocker_country', field: 'country' })
      }
      {
        const lat = formData?.latitude
        const lng = formData?.longitude
        const hasCoords =
          lat != null &&
          lng != null &&
          lat !== '' &&
          lng !== '' &&
          Number.isFinite(Number(lat)) &&
          Number.isFinite(Number(lng))
        if (!hasCoords) {
          blockers.push({ i18nKey: 'wizardBlocker_coordinates', field: 'coordinates' })
        }
      }
      if (
        !String(formData?.city || '').trim() &&
        !String(formData?.metadata?.city_label || formData?.metadata?.city || '').trim()
      ) {
        blockers.push({ i18nKey: 'wizardBlocker_city', field: 'city' })
      }
      // Stage 200.83 — district optional on preview gate (city + pin suffice)
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
 * Витрина preview: L1 asset → THB (mid) → guest fee; optional retail map for listing-currency strip.
 * Stage 200.49 — form field `basePriceThb` holds asset amount in `listingBaseCurrency`.
 * @param {number | string} assetAmount
 * @param {object} pricingPolicy
 * @param {{
 *   listingBaseCurrency?: string,
 *   exchangeRates?: Record<string, number> | null,
 *   midExchangeRates?: Record<string, number> | null,
 *   retailExchangeRates?: Record<string, number> | null,
 * }} [ctx]
 */
export function computeWizardPricingPreview(assetAmount, pricingPolicy, ctx = {}) {
  return computeWizardStorefrontPricePreview(assetAmount, pricingPolicy, {
    listingBaseCurrency: ctx.listingBaseCurrency,
    exchangeRates: ctx.exchangeRates,
    midExchangeRates: ctx.midExchangeRates,
    retailExchangeRates: ctx.retailExchangeRates,
  })
}

export { validateListingPublishQuality }
