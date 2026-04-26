'use client'

import { useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { PricingService } from '@/lib/services/pricing.service'
import { computeRoundedGuestTotalPot } from '@/lib/booking-price-integrity'

/**
 * Guest listing page: price breakdown (subtotal, service fee, guest total) from dates + guests + commission.
 */
export function useListingPricing({
  listing,
  dateRange,
  guests,
  commissionLoading,
  effectiveRate,
  guestServiceFeePercent,
  /** Stage 57.0 — from `GET /api/v2/commission`; 0 = hidden tax (same UX as pre–Stage 56). */
  taxRatePercent = 0,
  /** Stage 58.0 — `GET .../availability` → `pricing` for current dates/guests (tax SSOT with server). */
  syncPricing = null,
} = {}) {
  const [priceCalc, setPriceCalc] = useState(null)

  useEffect(() => {
    if (!listing || !dateRange?.from || !dateRange?.to) {
      setPriceCalc(null)
      return
    }

    const nights = differenceInDays(dateRange.to, dateRange.from)
    if (nights <= 0) {
      setPriceCalc(null)
      return
    }

    const tr = Number(taxRatePercent)
    const taxRateForCalc = Number.isFinite(tr) && tr >= 0 ? tr : 0

    const calc = PricingService.calculatePrice({
      basePriceThb: listing.basePriceThb,
      seasonalPricing: listing.seasonalPricing || [],
      dbSeasonalPrices: listing.dbSeasonalPrices || [],
      metadata: listing.metadata || {},
      checkIn: format(dateRange.from, 'yyyy-MM-dd'),
      checkOut: format(dateRange.to, 'yyyy-MM-dd'),
      listingCategorySlug: listing.categorySlug || '',
      guestsCount: guests,
      taxRatePercent: taxRateForCalc,
    })

    const cr = Number(listing.commissionRate)
    let commissionPct =
      Number.isFinite(cr) && cr >= 0
        ? cr
        : commissionLoading
          ? null
          : Number(effectiveRate)
    if (commissionPct == null || !Number.isFinite(commissionPct)) {
      setPriceCalc(null)
      return
    }
    const guestFeePct = Number.isFinite(Number(guestServiceFeePercent))
      ? Number(guestServiceFeePercent)
      : 5
    const serviceFeeRate = guestFeePct / 100
    const hostCommissionRate = commissionPct / 100
    const sync = syncPricing && typeof syncPricing === 'object' ? syncPricing : null
    const taxAmt =
      sync && Number.isFinite(Number(sync.taxAmountThb))
        ? Math.round(Number(sync.taxAmountThb))
        : Math.round(Number(calc.taxAmountThb) || 0)
    const taxRateForDisplay =
      sync && Number.isFinite(Number(sync.taxRatePercent))
        ? Number(sync.taxRatePercent)
        : taxRateForCalc
    const serviceFee = Math.round(calc.totalPrice * serviceFeeRate)
    const commissionThbHost = Math.round(calc.totalPrice * hostCommissionRate)
    const partnerPayoutThb = calc.totalPrice - commissionThbHost
    const guestPayable = calc.totalPrice + taxAmt + serviceFee
    const roundedGuestTotal = computeRoundedGuestTotalPot(guestPayable)
    if (!roundedGuestTotal) {
      setPriceCalc(null)
      return
    }
    const baseRawSubtotal = Math.round(listing.basePriceThb * nights)
    const seasonalAdjustment = calc.originalPrice - baseRawSubtotal

    setPriceCalc({
      ...calc,
      nights,
      baseRawSubtotal,
      seasonalAdjustment,
      subtotal: calc.totalPrice,
      subtotalBeforeFee: calc.totalPrice,
      taxAmountThb: taxAmt,
      taxRatePercent: taxRateForDisplay,
      commissionRate: commissionPct,
      guestServiceFeePercent: guestFeePct,
      serviceFee,
      commissionThbHost,
      partnerPayoutThb,
      platformCutThb: serviceFee + commissionThbHost,
      roundingDiffPot: roundedGuestTotal.roundingDiffPotThb,
      finalTotalRaw: guestPayable,
      finalTotal: roundedGuestTotal.roundedGuestTotalThb,
    })
  }, [
    listing,
    dateRange?.from,
    dateRange?.to,
    guests,
    commissionLoading,
    effectiveRate,
    guestServiceFeePercent,
    taxRatePercent,
    syncPricing,
  ])

  return priceCalc
}
