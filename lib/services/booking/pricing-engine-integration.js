/**
 * PricingEngine v2 integration for booking creation (Stage 97.0.5).
 */

import PricingEngine, {
  isPricingEngineV2Enabled,
  logPricingEngineV2ShadowCompare,
} from '@/lib/pricing-engine/index.js'
import { PricingService } from '../pricing.service'
import { computeRoundedGuestTotal, ROUNDING_MODE_POT10 } from '@/lib/booking-price-integrity'
import { buildBookingPricingSnapshot } from '@/lib/booking-pricing-snapshot'
import { logStructured } from '@/lib/critical-telemetry.js'
import { normalizeListingCurrency } from './pricing.service'

export function pickListingGeoForPricingProfile(listing) {
  const meta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const countryRaw =
    meta.country_code ?? meta.countryCode ?? meta.country ?? listing?.country ?? 'TH'
  const countryCode = String(countryRaw).trim().slice(0, 2).toUpperCase() || 'TH'
  const cityRaw = meta.city_key ?? meta.cityKey ?? listing?.city ?? meta.city ?? null
  const districtRaw =
    meta.district_key ?? meta.districtKey ?? listing?.district ?? meta.district ?? null
  return {
    countryCode,
    cityKey: cityRaw != null && String(cityRaw).trim() ? String(cityRaw).trim() : undefined,
    districtKey:
      districtRaw != null && String(districtRaw).trim() ? String(districtRaw).trim() : undefined,
  }
}

/**
 * @param {{
 *   listing: object,
 *   listingId: string,
 *   priceThb: number,
 *   priceCalc: object,
 *   currency?: string,
 *   promoCodeUsed?: string | null,
 *   promoExtraDiscountThb?: number,
 *   promoFlashSale?: boolean,
 * }} params
 */
export async function resolveBookingPricingWithEngine(params) {
  const { listing, listingId, priceThb, priceCalc, currency = 'THB' } = params
  const feeSplit = await PricingService.calculateFeeSplit(priceThb, listing.owner_id)
  const guestPayableThb = Math.round(Number(feeSplit.guestPayableThb) || 0)

  const legacyRounded = computeRoundedGuestTotal(guestPayableThb, ROUNDING_MODE_POT10)
  if (!legacyRounded) {
    return { error: 'Failed to round guest payable amount', code: 'PRICE_MISMATCH' }
  }

  const listingCurrencyForEngine = normalizeListingCurrency(
    listing.base_currency || listing.metadata?.base_currency || listing.metadata?.currency || 'THB',
  )
  const geo = pickListingGeoForPricingProfile(listing)
  const v2Enabled = await isPricingEngineV2Enabled()
  const roundingMode = v2Enabled ? 'integer' : ROUNDING_MODE_POT10

  let activeFeeSplit = feeSplit
  let roundedGuestTotalThb = legacyRounded.roundedGuestTotalThb
  let roundingDiffPotThb = legacyRounded.roundingPotThb
  let pricingSnapshot = null
  let pricingEngineV2Active = false
  let v2Breakdown = null

  try {
    const rawFxMap = await PricingService.getRawRateMap()
    const v2Result = await PricingEngine.buildSnapshotV2({
      listingId,
      partnerId: listing.owner_id,
      countryCode: geo.countryCode,
      cityKey: geo.cityKey,
      districtKey: geo.districtKey,
      subtotal_thb: Math.round(Number(priceThb)),
      payment_currency: String(currency || 'THB').toUpperCase(),
      listing_base_currency: listingCurrencyForEngine,
      raw_fx_rate_map: rawFxMap,
      priceCalc,
      listingBasePriceThb: parseFloat(listing.base_price_thb),
    })
    v2Breakdown = v2Result.breakdown

    logPricingEngineV2ShadowCompare({
      listingId,
      legacy: {
        roundedGuestTotalThb: legacyRounded.roundedGuestTotalThb,
        guestServiceFeeThb: feeSplit.guestServiceFeeThb,
        hostCommissionThb: feeSplit.hostCommissionThb,
        partnerNettoThb: feeSplit.partnerEarningsThb,
        roundingPotThb: legacyRounded.roundingPotThb,
        hostCommissionRate: feeSplit.hostCommissionRate,
      },
      v2: {
        pricingProfileId: v2Result.profile?.id,
        resolutionTrace: v2Breakdown.resolution_trace,
        roundedGuestTotalThb: v2Breakdown.total_guest_payable_rounded_thb,
        guestServiceFeeThb: v2Breakdown.guest_service_fee_thb,
        partnerNettoThb: v2Breakdown.total_partner_netto_thb,
        roundingPotThb: v2Breakdown.rounding_pot_thb ?? v2Breakdown.rounding_diff_pot_thb,
        ruFeeThb: v2Breakdown.ru_fee_thb,
        krFeeThb: v2Breakdown.kr_fee_thb,
        fxMarkupThb: v2Breakdown.fx_markup_thb,
      },
    })

    if (v2Enabled) {
      pricingEngineV2Active = true
      roundedGuestTotalThb = v2Breakdown.total_guest_payable_rounded_thb
      roundingDiffPotThb = v2Breakdown.rounding_pot_thb ?? v2Breakdown.rounding_diff_pot_thb ?? 0
      activeFeeSplit = {
        ...feeSplit,
        guestServiceFeeThb: v2Breakdown.guest_service_fee_thb,
        hostCommissionThb: v2Breakdown.host_commission_thb,
        hostCommissionRate: v2Result.profile.host_fee_pct,
        guestServiceFeePercent: v2Result.profile.guest_fee_pct,
        partnerEarningsThb: v2Breakdown.total_partner_netto_thb,
        guestPayableThb: v2Breakdown.total_guest_payable_thb,
        platformGrossRevenueThb:
          (v2Breakdown.guest_service_fee_thb || 0) + (v2Breakdown.host_commission_thb || 0),
        insuranceReserveThb: v2Breakdown.insurance_reserve_thb,
        taxRatePercent: v2Result.profile.tax_rate_pct,
        taxAmountThb: v2Breakdown.tax_amount_thb,
      }
      pricingSnapshot = {
        ...v2Result.snapshot,
        fiscal_kassa_preview: PricingEngine.toFiscalKassaPayload(v2Breakdown),
        ...(params.promoCodeUsed
          ? {
              promoCodeUsed: params.promoCodeUsed,
              promoExtraDiscountThb: params.promoExtraDiscountThb,
              promoFlashSale: params.promoFlashSale,
            }
          : {}),
      }
    }
  } catch (v2Err) {
    logStructured({
      module: 'BookingCreation',
      stage: 'pricing_engine_v2_shadow_error',
      listingId,
      message: v2Err?.message || String(v2Err),
    })
    if (v2Enabled) {
      return { error: 'Pricing engine v2 failed', code: 'PRICING_ENGINE_V2_ERROR' }
    }
  }

  if (!pricingSnapshot) {
    pricingSnapshot = buildBookingPricingSnapshot(priceCalc, parseFloat(listing.base_price_thb), {
      ...(params.promoCodeUsed
        ? {
            promoCodeUsed: params.promoCodeUsed,
            promoExtraDiscountThb: params.promoExtraDiscountThb,
            promoFlashSale: params.promoFlashSale,
          }
        : {}),
      taxRate: activeFeeSplit.taxRatePercent ?? 0,
      taxAmountThb: activeFeeSplit.taxAmountThb ?? 0,
    })
    pricingSnapshot.fee_split_v2 = {
      immutable: true,
      guest_service_fee_percent: activeFeeSplit.guestServiceFeePercent,
      guest_service_fee_thb: activeFeeSplit.guestServiceFeeThb,
      host_commission_percent: activeFeeSplit.hostCommissionRate,
      host_commission_thb: activeFeeSplit.hostCommissionThb,
      platform_gross_revenue_thb: activeFeeSplit.platformGrossRevenueThb,
      insurance_fund_percent: activeFeeSplit.insuranceFundPercent,
      insurance_reserve_thb: activeFeeSplit.insuranceReserveThb,
      tax_rate_percent: activeFeeSplit.taxRatePercent ?? 0,
      tax_amount_thb: activeFeeSplit.taxAmountThb ?? 0,
      guest_payable_thb: activeFeeSplit.guestPayableThb,
      guest_payable_rounded_thb: roundedGuestTotalThb,
      rounding_diff_pot_thb: roundingDiffPotThb,
      rounding_pot_thb: roundingDiffPotThb,
    }
  }

  return {
    feeSplit: activeFeeSplit,
    roundedGuestTotalThb,
    roundingDiffPotThb,
    pricingSnapshot,
    pricingEngineV2Active,
    roundingMode,
    v2Breakdown,
    legacyRoundedGuestTotalThb: legacyRounded.roundedGuestTotalThb,
  }
}
