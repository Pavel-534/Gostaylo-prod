/**
 * PricingEngine — Financial Model v2.0 (ADR-097, Stage 97.0.2)
 *
 * SSOT for fee percentages: `pricing_profiles` + `pricing_profile_assignments`
 * + `system_settings.general.default_pricing_profile_id`.
 *
 * NOT wired to live booking creation until Stage 97.0.3 (feature flag).
 * @see lib/pricing-engine/ARCHITECTURE.md
 */

export { resolvePricingProfile } from './resolve-profile.js'
export { computeFinalBreakdown } from './compute-breakdown.js'
export {
  toPricingSnapshotV2,
  toPartnerVisibleBreakdown,
  stripInternalFromPricingSnapshot,
  toFiscalKassaPayload,
} from './snapshot-adapter.js'
export { isPricingEngineV2Enabled, isPricingEngineV2EnabledFromEnv } from './feature-flag.js'
export { logPricingEngineV2ShadowCompare } from './shadow-compare.js'
export { roundGuestPayableToIntegerThb } from './rounding.js'

import { resolvePricingProfile } from './resolve-profile.js'
import { computeFinalBreakdown } from './compute-breakdown.js'
import { toPricingSnapshotV2, toPartnerVisibleBreakdown } from './snapshot-adapter.js'

export class PricingEngine {
  static resolvePricingProfile = resolvePricingProfile
  static computeFinalBreakdown = computeFinalBreakdown
  static toPricingSnapshotV2 = toPricingSnapshotV2
  static toPartnerVisibleBreakdown = toPartnerVisibleBreakdown

  /**
   * End-to-end: resolve profile → breakdown → snapshot v2.
   * @param {import('./types').ComputeFinalBreakdownInput & {
   *   listingId?: string,
   *   partnerId?: string,
   *   countryCode?: string,
   *   cityKey?: string,
   *   districtKey?: string,
   * }} params
   */
  static async buildSnapshotV2(params) {
    const { profile, resolution_trace } = await resolvePricingProfile({
      listingId: params.listingId,
      partnerId: params.partnerId,
      countryCode: params.countryCode,
      cityKey: params.cityKey,
      districtKey: params.districtKey,
    })

    const breakdown = computeFinalBreakdown({
      subtotal_thb: params.subtotal_thb,
      profile,
      resolution_trace: resolution_trace,
      payment_currency: params.payment_currency,
      listing_base_currency: params.listing_base_currency,
      raw_fx_rate_map: params.raw_fx_rate_map,
    })

    const snapshot = toPricingSnapshotV2(
      breakdown,
      params.priceCalc ?? null,
      params.listingBasePriceThb ?? 0,
    )

    return { profile, breakdown, snapshot }
  }
}

export default PricingEngine
