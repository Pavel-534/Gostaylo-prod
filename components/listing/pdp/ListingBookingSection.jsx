'use client'

import { useMemo } from 'react'
import { DesktopBookingWidget } from '@/app/(storefront)/listings/[id]/components/BookingWidget'
import { BookingModal } from '@/components/listing/BookingModal'
import { useListingBooking } from '@/components/listing/pdp/ListingBookingProvider'

/**
 * PDP desktop booking column: sticky **`DesktopBookingWidget`** + **`BookingModal`**.
 * Booking state from **`useListingBooking()`**; chat actions via optional `chat` bridge prop.
 *
 * @param {object} [props]
 * @param {object} [props.chat] — from `useListingChat` (contact partner UI only)
 * @param {boolean} [props.chat.showAskPartner]
 * @param {() => void} [props.chat.onAskPartner]
 * @param {boolean} [props.chat.askPartnerLoading]
 * @param {boolean} [props.chat.hasExistingConversation]
 * @param {string | null} [props.chat.lastMessagePreview]
 * @param {boolean} [props.chat.hasUnreadFromHost]
 */
export function ListingBookingSection({ chat = {} }) {
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
    priceCalc,
    calendarKey,
    bookingUiMode,
    vehicleStartTime,
    vehicleEndTime,
    setVehicleStartTime,
    setVehicleEndTime,
    availabilityLoading,
    availabilitySnapshot,
    durationDiscountPercentActive,
    hasDurationDiscountTiers,
    exclusiveDatesUnavailable,
    canInstantBook,
    bookingModalOpen,
    setBookingModalOpen,
    setBookingModalIntent,
    guestName,
    setGuestName,
    guestEmail,
    setGuestEmail,
    guestPhone,
    setGuestPhone,
    message,
    setMessage,
    submitting,
    bookingModalIntent,
    openBookModal,
    handleBookCtaClick,
    handleAskPartnerUnavailable,
    handleBookingSubmit,
  } = useListingBooking()

  const onPrivateTripClick = useMemo(
    () =>
      bookingUiMode === 'shared'
        ? () => (user ? openBookModal('private') : openLoginModal())
        : undefined,
    [bookingUiMode, user, openBookModal, openLoginModal],
  )

  const onSpecialPriceClick = useMemo(
    () =>
      bookingUiMode === 'shared'
        ? () => (user ? openBookModal('special') : openLoginModal())
        : undefined,
    [bookingUiMode, user, openBookModal, openLoginModal],
  )

  return (
    <>
      <DesktopBookingWidget
        listing={listing}
        dateRange={dateRange}
        setDateRange={setDateRange}
        guests={guests}
        setGuests={setGuests}
        priceCalc={priceCalc}
        currency={currency}
        exchangeRates={exchangeRates}
        language={language}
        calendarKey={calendarKey}
        onBookingClick={() => handleBookCtaClick('book')}
        showAskPartner={chat.showAskPartner}
        onAskPartner={chat.onAskPartner}
        onAskPartnerUnavailable={handleAskPartnerUnavailable}
        askPartnerLoading={chat.askPartnerLoading}
        hasExistingConversation={chat.hasExistingConversation}
        lastMessagePreview={chat.lastMessagePreview}
        hasUnreadFromHost={chat.hasUnreadFromHost}
        bookingUiMode={bookingUiMode}
        vehicleStartTime={vehicleStartTime}
        vehicleEndTime={vehicleEndTime}
        onVehicleStartTimeChange={setVehicleStartTime}
        onVehicleEndTimeChange={setVehicleEndTime}
        availabilityLoading={availabilityLoading}
        availabilitySnapshot={availabilitySnapshot}
        durationDiscountPercentActive={durationDiscountPercentActive}
        showDurationDiscountTeaser={hasDurationDiscountTiers}
        onPrivateTripClick={onPrivateTripClick}
        onSpecialPriceClick={onSpecialPriceClick}
        canInstantBook={canInstantBook}
        exclusiveDatesUnavailable={exclusiveDatesUnavailable}
      />

      <BookingModal
        open={bookingModalOpen}
        onOpenChange={(open) => {
          setBookingModalOpen(open)
          if (!open) setBookingModalIntent('book')
        }}
        guestName={guestName}
        setGuestName={setGuestName}
        guestEmail={guestEmail}
        setGuestEmail={setGuestEmail}
        guestPhone={guestPhone}
        setGuestPhone={setGuestPhone}
        message={message}
        setMessage={setMessage}
        dateRange={dateRange}
        priceCalc={priceCalc}
        currency={currency}
        exchangeRates={exchangeRates}
        language={language}
        submitting={submitting}
        onSubmit={handleBookingSubmit}
        modalIntent={bookingModalIntent}
        listingCategorySlug={listing?.categorySlug}
        vehicleStartTime={vehicleStartTime}
        vehicleEndTime={vehicleEndTime}
        setVehicleStartTime={setVehicleStartTime}
        setVehicleEndTime={setVehicleEndTime}
      />
    </>
  )
}
