'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PlatformCalendar } from '@/components/platform-calendar'
import { GuestCountStepper } from '@/components/listing/GuestCountStepper'
import { MobileBookingBar, PriceBreakdownBlock } from '@/app/(storefront)/listings/[id]/components/BookingWidget'
import { getUIText } from '@/lib/translations'
import { PDP_BOOKING_DATES_ANCHOR_ATTR } from '@/lib/listing/pdp-hero-layout'
import { useListingBooking } from '@/components/listing/pdp/ListingBookingProvider'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import {
  LISTING_PDP_SECTION_PAD_CLASS,
  LISTING_PDP_SECTION_RULE_CLASS,
  LISTING_PDP_SECTION_TITLE_CLASS,
} from '@/lib/listing/pdp-section-rhythm'

/**
 * PDP mobile: inline date/guest planner (lg:hidden) + fixed bottom **`MobileBookingBar`**.
 * Booking state from **`useListingBooking()`**; chat bar actions via `chat` bridge prop.
 *
 * @param {object} props
 * @param {object} props.chat — from `useListingChat` (mobile bar contact actions)
 * @param {() => void} props.chat.handleContactPartner
 * @param {boolean} props.chat.contactPartnerLoading
 * @param {boolean} props.chat.showContactPartner
 * @param {boolean} props.chat.existingConvId
 * @param {string | null} props.chat.lastMessagePreview
 * @param {boolean} props.chat.hasUnreadFromHost
 */
export function ListingMobileActions({ chat }) {
  const {
    listing,
    user,
    openLoginModal,
    language,
    currency,
    exchangeRates,
    dateRange,
    setDateRange,
    guests,
    setGuests,
    calendarKey,
    listingRentalPeriodMode,
    maxGuests,
    hasDurationDiscountTiers,
    durationDiscountPercentActive,
    wholeVesselListing,
    bookingUiMode,
    availabilityLoading,
    availabilitySnapshot,
    exclusiveDatesUnavailable,
    priceCalc,
    handleAskPartnerUnavailable,
    openBookModal,
    handleBookCtaClick,
    canInstantBook,
  } = useListingBooking()

  const listingCategorySlug = listing?.categorySlug || listing?.category?.slug || ''
  const wizardProfile = listing?.wizardProfile || listing?.category?.wizard_profile || null
  const uiCtx =
    listingCategorySlug || wizardProfile
      ? {
          listingCategorySlug: listingCategorySlug || undefined,
          wizardProfile: wizardProfile || undefined,
        }
      : undefined
  const tx = (k) => getUIText(k, language, uiCtx)

  const mobileBarProps = useMemo(
    () => ({
      priceCalc,
      dateRange,
      currency,
      exchangeRates,
      language,
      onBookingClick: () => handleBookCtaClick('book'),
      onAskPartner: chat.handleContactPartner,
      onAskPartnerUnavailable: handleAskPartnerUnavailable,
      askPartnerLoading: chat.contactPartnerLoading,
      showAskPartner: chat.showContactPartner,
      hasExistingConversation: !!chat.existingConvId,
      lastMessagePreview: chat.lastMessagePreview,
      hasUnreadFromHost: chat.hasUnreadFromHost,
      bookingUiMode,
      availabilityLoading,
      canInstantBook,
      exclusiveDatesUnavailable,
      onPrivateTripClick:
        bookingUiMode === 'shared'
          ? () => (user ? openBookModal('private') : openLoginModal())
          : undefined,
      onSpecialPriceClick:
        bookingUiMode === 'shared'
          ? () => (user ? openBookModal('special') : openLoginModal())
          : undefined,
    }),
    [
      priceCalc,
      dateRange,
      currency,
      exchangeRates,
      language,
      handleBookCtaClick,
      chat,
      handleAskPartnerUnavailable,
      bookingUiMode,
      availabilityLoading,
      canInstantBook,
      exclusiveDatesUnavailable,
      user,
      openBookModal,
      openLoginModal,
    ],
  )

  return (
    <>
      <div
        className={cn(
          'lg:hidden scroll-mt-24',
          LISTING_PDP_SECTION_PAD_CLASS,
          'border-y',
          LISTING_PDP_SECTION_RULE_CLASS,
        )}
        {...{ [PDP_BOOKING_DATES_ANCHOR_ATTR]: '' }}
      >
        <h2 className={cn(LISTING_PDP_SECTION_TITLE_CLASS, 'mb-4')}>{tx('selectYourDates')}</h2>
        <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'sm:border-slate-200 sm:bg-slate-50')}>
          <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4 sm:p-4')}>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {tx(listingRentalPeriodMode === 'day' ? 'travelDatesRental' : 'travelDates')}
              </Label>
              <PlatformCalendar
                key={calendarKey}
                listingId={listing.id}
                value={dateRange}
                onChange={setDateRange}
                minStay={listing.minStay}
                language={language}
                guests={guests}
                listingMaxCapacity={listing.maxCapacity}
                rentalPeriodMode={listingRentalPeriodMode}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {tx(listingRentalPeriodMode === 'day' ? 'numberOfSeats' : 'numberOfGuests')}
              </Label>
              <GuestCountStepper value={guests} onChange={setGuests} min={1} max={maxGuests} />
            </div>
            {hasDurationDiscountTiers && durationDiscountPercentActive > 0 && (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-900">
                <span>
                  {tx(
                    listingRentalPeriodMode === 'day'
                      ? 'durationDiscountTeaserActiveDay'
                      : 'durationDiscountTeaserActiveNight',
                  ).replace(/\{\{pct\}\}/g, String(durationDiscountPercentActive))}
                </span>
              </div>
            )}
            {wholeVesselListing && dateRange?.from && dateRange?.to && (
              <div className="text-sm text-brand bg-brand/10 border border-brand/20 rounded-lg px-3 py-2">
                {availabilityLoading ? (
                  <span>{tx('listingDetail_checkingAvailability')}</span>
                ) : availabilitySnapshot != null ? (
                  <span>
                    {availabilitySnapshot.available
                      ? tx('listingDetail_vesselAvailable')
                      : tx('listingDetail_vesselUnavailable')}
                  </span>
                ) : null}
              </div>
            )}
            {bookingUiMode === 'shared' && !wholeVesselListing && dateRange?.from && dateRange?.to && (
              <div className="text-sm text-brand bg-brand/10 border border-brand/20 rounded-lg px-3 py-2">
                {availabilityLoading ? (
                  <span>{tx('listingDetail_checkingSpots')}</span>
                ) : availabilitySnapshot?.remaining_spots != null ? (
                  <span>
                    {tx('listingDetail_spotsLabel')}: <strong>{availabilitySnapshot.remaining_spots}</strong>
                    {listing.maxCapacity > 1 ? ` / ${listing.maxCapacity}` : ''}
                  </span>
                ) : null}
              </div>
            )}
            {exclusiveDatesUnavailable && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {tx('listingDetail_datesUnavailable')}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 min-h-11 w-full border-brand/30"
                  onClick={handleAskPartnerUnavailable}
                  data-testid="listing-ask-partner-unavailable"
                >
                  {tx('listingDetail_askPartnerChat')}
                </Button>
              </div>
            )}
            {bookingUiMode === 'shared' && dateRange?.from && dateRange?.to && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full border border-brand/25"
                  onClick={() => (user ? openBookModal('private') : openLoginModal())}
                >
                  {tx('listingDetail_privateTrip')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full border-dashed"
                  onClick={() => (user ? openBookModal('special') : openLoginModal())}
                >
                  {tx('listingDetail_specialPrice')}
                </Button>
              </div>
            )}
            {priceCalc && (
              <div className="max-sm:pt-1 sm:rounded-lg sm:bg-white sm:p-4">
                <PriceBreakdownBlock
                  priceCalc={priceCalc}
                  currency={currency}
                  exchangeRates={exchangeRates}
                  language={language}
                  rentalPeriodMode={listingRentalPeriodMode}
                  listingCategorySlug={listingCategorySlug}
                  listingMetadata={listing?.metadata || null}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MobileBookingBar listing={listing} {...mobileBarProps} />
    </>
  )
}
