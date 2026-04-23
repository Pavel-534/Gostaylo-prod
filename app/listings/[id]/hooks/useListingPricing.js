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
}) {
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

    const calc = PricingService.calculatePrice({
      basePriceThb: listing.basePriceThb,
      seasonalPricing: listing.seasonalPricing || [],
      dbSeasonalPrices: listing.dbSeasonalPrices || [],
      metadata: listing.metadata || {},
      checkIn: format(dateRange.from, 'yyyy-MM-dd'),
      checkOut: format(dateRange.to, 'yyyy-MM-dd'),
      listingCategorySlug: listing.categorySlug || '',
      guestsCount: guests,
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
    const serviceFee = Math.round(calc.totalPrice * serviceFeeRate)
    const commissionThbHost = Math.round(calc.totalPrice * hostCommissionRate)
    const partnerPayoutThb = calc.totalPrice - commissionThbHost
    const guestPayable = calc.totalPrice + serviceFee
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
  }, [listing, dateRange?.from, dateRange?.to, guests, commissionLoading, effectiveRate, guestServiceFeePercent])

  return priceCalc
}
