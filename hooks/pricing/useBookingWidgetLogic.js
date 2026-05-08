'use client'

import { useMemo } from 'react'
import { getUIText } from '@/lib/translations'
import { getListingRentalPeriodMode, isWholeVesselListing } from '@/lib/listing-booking-ui'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'

/**
 * Booking widget view-model.
 * Keeps date/guest-related UI state wiring centralized while preserving
 * pricing math from the existing PricingService pipeline passed via `priceCalc`.
 */
export function useBookingWidgetLogic({
  listing,
  language,
  bookingUiMode = 'exclusive',
  availabilitySnapshot = null,
  hasExistingConversation = false,
  askPartnerLoading = false,
}) {
  const listingCategorySlug = listing?.categorySlug || listing?.category?.slug || ''

  const rentalPeriodMode = useMemo(
    () => getListingRentalPeriodMode(listingCategorySlug),
    [listingCategorySlug],
  )

  const maxGuests = useMemo(() => Math.max(1, resolveListingGuestCapacity(listing)), [listing])
  const maxCap = listing?.maxCapacity ?? availabilitySnapshot?.max_capacity ?? 1
  const remaining = availabilitySnapshot?.remaining_spots
  const sharedMode = bookingUiMode === 'shared'
  const wholeVessel = isWholeVesselListing(listing?.categorySlug, listing?.metadata)
  const uiListingCtx = listingCategorySlug ? { listingCategorySlug } : undefined
  const tx = (key) => getUIText(key, language, uiListingCtx)

  const askPartnerLabel = askPartnerLoading
    ? tx('loading')
    : hasExistingConversation
      ? language === 'ru'
        ? 'Продолжить диалог'
        : 'Continue chat'
      : tx('askListingQuestion')

  return {
    listingCategorySlug,
    rentalPeriodMode,
    maxGuests,
    maxCap,
    remaining,
    sharedMode,
    wholeVessel,
    uiListingCtx,
    tx,
    askPartnerLabel,
  }
}
