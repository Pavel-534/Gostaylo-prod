/**
 * CardPriceDisplay Component
 * Stage 107.1–107.2 — гостевая цена через SSOT guest-display-price.
 */

'use client'

import { useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import {
  formatDisplayPriceInCurrency,
  displayPriceRawForTest,
} from '@/lib/pricing/fx-display-client'
import { formatSameCurrencyGuestDisplay } from '@/lib/pricing/same-currency-guest-display'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'
import { AnimatedPrice } from '@/components/card/AnimatedPrice'
import {
  formatCardPricePeriodSuffix,
  getGuestDisplayForStay,
  getGuestDisplayPerNight,
} from '@/lib/pricing/guest-display-price'

export function CardPriceDisplay({
  listing = null,
  basePrice,
  pricing,
  initialDates,
  currency,
  exchangeRates,
  language = 'en',
  categorySlug = '',
}) {
  const rates = exchangeRates && typeof exchangeRates === 'object' ? exchangeRates : { THB: 1 }

  const nights = useMemo(() => {
    if (initialDates?.checkIn && initialDates?.checkOut) {
      try {
        const checkIn = new Date(initialDates.checkIn)
        const checkOut = new Date(initialDates.checkOut)
        return differenceInDays(checkOut, checkIn)
      } catch {
        return 0
      }
    }
    return 0
  }, [initialDates])

  const listingForPrice = useMemo(() => {
    if (listing && typeof listing === 'object') {
      if (pricing && !listing.pricing) {
        return { ...listing, pricing }
      }
      return listing
    }
    if (pricing) {
      return { basePriceThb: basePrice, pricing }
    }
    return { basePriceThb: basePrice }
  }, [listing, basePrice, pricing])

  const displayPrice = useMemo(() => {
    if (nights > 0) {
      return getGuestDisplayForStay(listingForPrice, nights)
    }
    return getGuestDisplayPerNight(listingForPrice)
  }, [listingForPrice, nights])

  const spanMode = getListingRentalPeriodMode(
    categorySlug || listing?.categorySlug || listing?.category?.slug || '',
  )

  const periodSuffix = useMemo(
    () => formatCardPricePeriodSuffix({ nights, spanMode, language }),
    [nights, spanMode, language],
  )

  const formattedPrice = useMemo(() => {
    // Same listing/UI currency: L1 × guest fee, no retail FX (Stage 200.86)
    if (nights <= 0) {
      const same = formatSameCurrencyGuestDisplay(listingForPrice, currency, language)
      if (same) return same
    }
    return formatDisplayPriceInCurrency(displayPrice, currency, rates, language)
  }, [listingForPrice, currency, language, nights, displayPrice, rates])

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      <span
        className="text-base font-semibold text-slate-900 sm:text-lg"
        data-test-raw-value={displayPriceRawForTest(displayPrice, currency, rates)}
        data-test-fee-value="0"
      >
        <AnimatedPrice value={formattedPrice} />
      </span>
      <span className="text-xs text-slate-500 sm:text-sm">{periodSuffix}</span>
      {pricing?.isPromoApplied ? (
        <span className="ml-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
          SALE
        </span>
      ) : null}
    </div>
  )
}
