/**
 * Stage 109.3 — wizard step gate (SSOT for canProceed).
 */

import { computeWizardStorefrontPricePreview } from '@/lib/pricing/fx-display-client.js'

/** Step validation: 1 general+specs; 2 location; 3 photos; 4 pricing; 5 preview. */
export function computeWizardCanProceed(currentStep, formData, coordsValid) {
  const generalOk =
    Boolean(formData.listingServiceType) &&
    formData.categoryId &&
    formData.title.length >= 1 &&
    formData.description.length >= 20
  const locOk = Boolean(formData.district) && coordsValid
  const photosOk = (formData.images || []).length >= 1
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
