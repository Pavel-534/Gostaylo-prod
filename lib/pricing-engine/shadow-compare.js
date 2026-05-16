import { logStructured } from '@/lib/critical-telemetry.js'

/**
 * Log legacy vs PricingEngine v2 totals (Stage 97.0.3 shadow observability).
 * Does not change API responses.
 *
 * @param {{
 *   listingId: string,
 *   legacy: object,
 *   v2: object,
 * }} payload
 */
export function logPricingEngineV2ShadowCompare(payload) {
  const legacy = payload.legacy || {}
  const v2 = payload.v2 || {}
  const deltas = {
    guest_total_thb: (v2.roundedGuestTotalThb ?? 0) - (legacy.roundedGuestTotalThb ?? 0),
    partner_netto_thb: (v2.partnerNettoThb ?? 0) - (legacy.partnerNettoThb ?? 0),
    guest_fee_thb: (v2.guestServiceFeeThb ?? 0) - (legacy.guestServiceFeeThb ?? 0),
    rounding_pot_thb: (v2.roundingPotThb ?? 0) - (legacy.roundingPotThb ?? 0),
    ru_fee_thb: v2.ruFeeThb ?? null,
    kr_fee_thb: v2.krFeeThb ?? null,
    fx_markup_thb: v2.fxMarkupThb ?? null,
  }

  logStructured({
    module: 'BookingCreation',
    stage: 'pricing_engine_v2_shadow_compare',
    listingId: payload.listingId,
    legacy: {
      roundedGuestTotalThb: legacy.roundedGuestTotalThb,
      guestServiceFeeThb: legacy.guestServiceFeeThb,
      hostCommissionThb: legacy.hostCommissionThb,
      partnerNettoThb: legacy.partnerNettoThb,
      roundingPotThb: legacy.roundingPotThb,
      hostCommissionRate: legacy.hostCommissionRate,
    },
    v2: {
      pricingProfileId: v2.pricingProfileId,
      resolutionTrace: v2.resolutionTrace,
      roundedGuestTotalThb: v2.roundedGuestTotalThb,
      guestServiceFeeThb: v2.guestServiceFeeThb,
      partnerNettoThb: v2.partnerNettoThb,
      roundingPotThb: v2.roundingPotThb,
      snapshotVersion: 2,
    },
    deltas,
  })

  console.info('[PricingEngineV2][shadow]', JSON.stringify({ listingId: payload.listingId, deltas }))
}
