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
    return { basePriceThb: basePrice, guestDisplayPriceThb: basePrice }
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

  const formattedPrice = formatDisplayPriceInCurrency(displayPrice, currency, rates, language)

  return (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      <span
        className="text-lg font-semibold text-slate-900"
        data-test-raw-value={displayPriceRawForTest(displayPrice, currency, rates)}
        data-test-fee-value="0"
      >
        <AnimatedPrice value={formattedPrice} />
      </span>
      <span className="text-sm text-slate-500">{periodSuffix}</span>
      {pricing?.isPromoApplied ? (
        <span className="ml-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
          SALE
        </span>
      ) : null}
    </div>
  )
}
