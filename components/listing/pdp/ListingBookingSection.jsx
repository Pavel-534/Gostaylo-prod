'use client'

import { DesktopBookingWidget } from '@/app/listings/[id]/components/BookingWidget'
import { BookingModal } from '@/components/listing/BookingModal'

/**
 * PDP desktop booking column: sticky **`DesktopBookingWidget`** + **`BookingModal`** (POST flow via parent `onSubmit`).
 */
export function ListingBookingSection({
  listing,
  dateRange,
  setDateRange,
  guests,
  setGuests,
  priceCalc,
  currency,
  exchangeRates,
  language,
  calendarKey,
  onBookingClick,
  showAskPartner,
  onAskPartner,
  onAskPartnerUnavailable,
  askPartnerLoading,
  hasExistingConversation,
  lastMessagePreview,
  hasUnreadFromHost,
  bookingUiMode,
  vehicleStartTime,
  vehicleEndTime,
  onVehicleStartTimeChange,
  onVehicleEndTimeChange,
  availabilityLoading,
  availabilitySnapshot,
  durationDiscountPercentActive,
  showDurationDiscountTeaser,
  onPrivateTripClick,
  onSpecialPriceClick,
  canInstantBook,
  exclusiveDatesUnavailable,
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
  onBookingSubmit,
  bookingModalIntent,
}) {
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
        onBookingClick={onBookingClick}
        showAskPartner={showAskPartner}
        onAskPartner={onAskPartner}
        onAskPartnerUnavailable={onAskPartnerUnavailable}
        askPartnerLoading={askPartnerLoading}
        hasExistingConversation={hasExistingConversation}
        lastMessagePreview={lastMessagePreview}
        hasUnreadFromHost={hasUnreadFromHost}
        bookingUiMode={bookingUiMode}
        vehicleStartTime={vehicleStartTime}
        vehicleEndTime={vehicleEndTime}
        onVehicleStartTimeChange={onVehicleStartTimeChange}
        onVehicleEndTimeChange={onVehicleEndTimeChange}
        availabilityLoading={availabilityLoading}
        availabilitySnapshot={availabilitySnapshot}
        durationDiscountPercentActive={durationDiscountPercentActive}
        showDurationDiscountTeaser={showDurationDiscountTeaser}
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
        onSubmit={onBookingSubmit}
        modalIntent={bookingModalIntent}
        listingCategorySlug={listing?.categorySlug}
        vehicleStartTime={vehicleStartTime}
        vehicleEndTime={vehicleEndTime}
        setVehicleStartTime={onVehicleStartTimeChange}
        setVehicleEndTime={onVehicleEndTimeChange}
      />
    </>
  )
}
