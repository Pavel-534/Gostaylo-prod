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
  const wizardProfile = listing?.wizardProfile || listing?.category?.wizard_profile || null

  const rentalPeriodMode = useMemo(
    () => getListingRentalPeriodMode(listingCategorySlug),
    [listingCategorySlug],
  )

  const maxGuests = useMemo(() => Math.max(1, resolveListingGuestCapacity(listing)), [listing])
  const maxCap = listing?.maxCapacity ?? availabilitySnapshot?.max_capacity ?? 1
  const remaining = availabilitySnapshot?.remaining_spots
  const sharedMode = bookingUiMode === 'shared'
  const wholeVessel = isWholeVesselListing(listing?.categorySlug, listing?.metadata)
  const uiListingCtx =
    listingCategorySlug || wizardProfile
      ? {
          listingCategorySlug: listingCategorySlug || undefined,
          wizardProfile: wizardProfile || undefined,
        }
      : undefined
  const tx = (key) => getUIText(key, language, uiListingCtx)

  // Stage 200.73 — continue vs ask uses SSOT keys; ask path gets provider placeholders via uiListingCtx
  const askPartnerLabel = askPartnerLoading
    ? tx('loading')
    : hasExistingConversation
      ? tx('listingDetail_continueChat')
      : tx('listingDetail_askPartnerChat')

  return {
    listingCategorySlug,
    wizardProfile,
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
