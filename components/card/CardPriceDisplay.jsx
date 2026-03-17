/**
 * CardPriceDisplay Component
 * Price calculation and display for listing cards
 */

'use client'

import { useMemo, useCallback } from 'react'
import { differenceInDays } from 'date-fns'
import { formatPrice } from '@/lib/currency'

export function CardPriceDisplay({
  basePrice,
  pricing,
  initialDates,
  currency,
  exchangeRates,
  language = 'en'
}) {
  // Calculate nights
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
  
  // Get display price
  const displayPrice = useMemo(() => {
    if (pricing?.totalPrice && nights > 0) {
      return pricing.totalPrice
    }
    return basePrice
  }, [pricing, nights, basePrice])
  
  const perNightPrice = useMemo(() => {
    if (pricing?.perNight) {
      return pricing.perNight
    }
    return basePrice
  }, [pricing, basePrice])
  
  // Price conversion
  const convertPrice = useCallback((priceThb) => {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }, [currency, exchangeRates])
  
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-semibold text-slate-900">
        {formatPrice(convertPrice(displayPrice), currency, exchangeRates)}
      </span>
      <span className="text-sm text-slate-500">
        {nights > 0 
          ? `/ ${nights} ${language === 'ru' ? 'ноч.' : 'nights'}`
          : `/ ${language === 'ru' ? 'ночь' : 'night'}`
        }
      </span>
    </div>
  )
}
