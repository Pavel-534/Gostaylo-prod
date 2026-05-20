/**
 * GoStayLo - Pricing Service facade (каталог / день / промо).
 * Не путать с `lib/services/booking/pricing.service.js` — settlement на брони.
 * Карта модулей: `lib/pricing/PRICING_SERVICES.md`
 */

import {
  getGeneralPricingSettings,
  getFeePolicy,
  getFeePolicyBatch,
  calculateFeeSplitWithPolicy,
  calculateNetProfitOrder,
  calculateFeeSplit,
  calculateCommission,
} from '@/lib/services/pricing/pricing-fee-policy.js'
import {
  getListingWithSeasonalPricing,
  getSeasonalPrice,
  calculateDailyPrice,
  calculateBookingPrice,
  calculateBookingPriceSync,
  calculatePrice,
} from '@/lib/services/pricing/pricing-calculation.js'
import { validatePromoCode } from '@/lib/services/pricing/pricing-promo-validator.js'
import {
  getExchangeRates,
  getRawRateMap,
  getCheckoutRateToThb,
  convertThbToCurrencyRaw,
  convertPrice,
} from '@/lib/services/pricing/pricing-fx-helpers.js'

export {
  parseDurationDiscountTiers,
  computeBestDurationDiscountPercent,
  getAppliedDurationDiscountTier,
  applyDurationDiscountToSubtotal,
} from '@/lib/listing/duration-discount-tiers.js'

export class PricingService {
  static getGeneralPricingSettings = getGeneralPricingSettings
  static getFeePolicy = getFeePolicy
  static getFeePolicyBatch = getFeePolicyBatch
  static calculateFeeSplitWithPolicy = calculateFeeSplitWithPolicy
  static calculateNetProfitOrder = calculateNetProfitOrder
  static calculateFeeSplit = calculateFeeSplit
  static calculateCommission = calculateCommission

  static getListingWithSeasonalPricing = getListingWithSeasonalPricing
  static getSeasonalPrice = getSeasonalPrice
  static calculateDailyPrice = calculateDailyPrice
  static calculateBookingPrice = calculateBookingPrice
  static calculateBookingPriceSync = calculateBookingPriceSync
  static calculatePrice = calculatePrice

  static validatePromoCode = validatePromoCode

  static getExchangeRates = getExchangeRates
  static getRawRateMap = getRawRateMap
  static getCheckoutRateToThb = getCheckoutRateToThb
  static convertThbToCurrencyRaw = convertThbToCurrencyRaw
  static convertPrice = convertPrice
}

/** P1-8: явный алиас — каталог / календарь / промо (не settlement на брони). */
export const PricingCatalogService = PricingService

export default PricingService
