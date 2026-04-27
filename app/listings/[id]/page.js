'use client'

/**
 * GoStayLo PDP — Stage 70.2 composer: view data + booking flow + chat; layout + pdp/ components.
 */

import { useState, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getListingDisplayImageUrls } from '@/lib/listing-display-images'
import { useListingViewData } from '@/hooks/useListingViewData'
import { useListingBookingFlow } from '@/hooks/useListingBookingFlow'
import { useListingChat } from '@/hooks/useListingChat'
import { ListingPageNav } from './components/ListingPageNav'
import { ListingPageSkeleton } from './components/ListingPageSkeleton'
import { GalleryModal } from '@/components/listing/GalleryModal'
import { getUIText } from '@/lib/translations'
import { useAuth } from '@/contexts/auth-context'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { ListingHeroGallery, ListingHeroHeadline } from '@/components/listing/pdp/ListingHero'
import { ListingDescription } from '@/components/listing/pdp/ListingDescription'
import { ListingReviews } from '@/components/listing/pdp/ListingReviews'
import { ListingMap } from '@/components/listing/pdp/ListingMap'
import { ListingBookingSection } from '@/components/listing/pdp/ListingBookingSection'
import { ListingMobileActions } from '@/components/listing/pdp/ListingMobileActions'
import { ListingChatPreview } from '@/components/listing/pdp/ListingChatPreview'

function PremiumListingContent({ params }) {
  const router = useRouter()
  const { user, openLoginModal } = useAuth()
  const { addToRecent } = useRecentlyViewed()

  const view = useListingViewData(params.id, { user, openLoginModal, addToRecent })
  const { listing, reviews, loading, language, currency, exchangeRates, isFavorite, favoriteLoading, handleFavoriteClick } =
    view

  const booking = useListingBookingFlow({
    listing,
    user,
    openLoginModal,
    language,
    currency,
    exchangeRates,
  })

  const chat = useListingChat({ listing, user, openLoginModal, language })

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const amenities = listing?.metadata?.amenities || []
  const galleryImageUrls = useMemo(() => getListingDisplayImageUrls(listing), [listing])

  const mobileBelow = listing ? (
    <ListingMobileActions
      listing={listing}
      language={language}
      currency={currency}
      exchangeRates={exchangeRates}
      dateRange={booking.dateRange}
      setDateRange={booking.setDateRange}
      guests={booking.guests}
      setGuests={booking.setGuests}
      calendarKey={booking.calendarKey}
      listingRentalPeriodMode={booking.listingRentalPeriodMode}
      maxGuests={booking.maxGuests}
      hasDurationDiscountTiers={booking.hasDurationDiscountTiers}
      durationDiscountPercentActive={booking.durationDiscountPercentActive}
      wholeVesselListing={booking.wholeVesselListing}
      bookingUiMode={booking.bookingUiMode}
      availabilityLoading={booking.availabilityLoading}
      availabilitySnapshot={booking.availabilitySnapshot}
      exclusiveDatesUnavailable={booking.exclusiveDatesUnavailable}
      priceCalc={booking.priceCalc}
      onAskPartnerUnavailable={booking.handleAskPartnerUnavailable}
      user={user}
      openLoginModal={openLoginModal}
      openBookModal={booking.openBookModal}
      mobileBarProps={{
        priceCalc: booking.priceCalc,
        dateRange: booking.dateRange,
        currency,
        exchangeRates,
        language,
        onBookingClick: () => booking.openBookModal('book'),
        onAskPartner: chat.handleContactPartner,
        onAskPartnerUnavailable: booking.handleAskPartnerUnavailable,
        askPartnerLoading: chat.contactPartnerLoading,
        showAskPartner: chat.showContactPartner && !booking.exclusiveDatesUnavailable,
        hasExistingConversation: !!chat.existingConvId,
        lastMessagePreview: chat.lastMessagePreview,
        hasUnreadFromHost: chat.hasUnreadFromHost,
        bookingUiMode: booking.bookingUiMode,
        availabilityLoading: booking.availabilityLoading,
        canInstantBook: booking.canInstantBook,
        exclusiveDatesUnavailable: booking.exclusiveDatesUnavailable,
        onPrivateTripClick:
          booking.bookingUiMode === 'shared'
            ? () => (user ? booking.openBookModal('private') : openLoginModal())
            : undefined,
        onSpecialPriceClick:
          booking.bookingUiMode === 'shared'
            ? () => (user ? booking.openBookModal('special') : openLoginModal())
            : undefined,
      }}
    />
  ) : null

  if (loading) return <ListingPageSkeleton />

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">{getUIText('listingDetail_notFound', language)}</h2>
          <Button onClick={() => router.push('/listings')} variant="outline">
            {getUIText('listingDetail_backToListings', language)}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-white">
        <ListingPageNav
          language={language}
          onBack={() => router.back()}
          isFavorite={isFavorite}
          favoriteLoading={favoriteLoading}
          onFavorite={handleFavoriteClick}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-40 lg:pb-8">
          <ListingHeroGallery
            listing={listing}
            language={language}
            onImageClick={(index) => {
              setGalleryIndex(typeof index === 'number' ? index : 0)
              setGalleryOpen(true)
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              <ListingHeroHeadline listing={listing} language={language} />
              <Separator />
              <ListingDescription listing={listing} language={language} amenities={amenities} belowDescription={mobileBelow} />

              <Separator />
              <ListingMap listing={listing} language={language} />

              <ListingChatPreview
                language={language}
                listing={listing}
                showContactPartner={chat.showContactPartner}
                lastMessagePreview={chat.lastMessagePreview}
                hasUnreadFromHost={chat.hasUnreadFromHost}
              />

              <Separator />
              <ListingReviews listing={listing} reviews={reviews} language={language} />
            </div>

            <div className="lg:col-span-1">
              <ListingBookingSection
                listing={listing}
                dateRange={booking.dateRange}
                setDateRange={booking.setDateRange}
                guests={booking.guests}
                setGuests={booking.setGuests}
                priceCalc={booking.priceCalc}
                currency={currency}
                exchangeRates={exchangeRates}
                language={language}
                calendarKey={booking.calendarKey}
                onBookingClick={() => booking.openBookModal('book')}
                showAskPartner={chat.showContactPartner && !booking.exclusiveDatesUnavailable}
                onAskPartner={chat.handleContactPartner}
                onAskPartnerUnavailable={booking.handleAskPartnerUnavailable}
                askPartnerLoading={chat.contactPartnerLoading}
                hasExistingConversation={!!chat.existingConvId}
                lastMessagePreview={chat.lastMessagePreview}
                hasUnreadFromHost={chat.hasUnreadFromHost}
                bookingUiMode={booking.bookingUiMode}
                vehicleStartTime={booking.vehicleStartTime}
                vehicleEndTime={booking.vehicleEndTime}
                onVehicleStartTimeChange={booking.setVehicleStartTime}
                onVehicleEndTimeChange={booking.setVehicleEndTime}
                availabilityLoading={booking.availabilityLoading}
                availabilitySnapshot={booking.availabilitySnapshot}
                durationDiscountPercentActive={booking.durationDiscountPercentActive}
                showDurationDiscountTeaser={booking.hasDurationDiscountTiers}
                onPrivateTripClick={
                  booking.bookingUiMode === 'shared'
                    ? () => (user ? booking.openBookModal('private') : openLoginModal())
                    : undefined
                }
                onSpecialPriceClick={
                  booking.bookingUiMode === 'shared'
                    ? () => (user ? booking.openBookModal('special') : openLoginModal())
                    : undefined
                }
                canInstantBook={booking.canInstantBook}
                exclusiveDatesUnavailable={booking.exclusiveDatesUnavailable}
                bookingModalOpen={booking.bookingModalOpen}
                setBookingModalOpen={booking.setBookingModalOpen}
                setBookingModalIntent={booking.setBookingModalIntent}
                guestName={booking.guestName}
                setGuestName={booking.setGuestName}
                guestEmail={booking.guestEmail}
                setGuestEmail={booking.setGuestEmail}
                guestPhone={booking.guestPhone}
                setGuestPhone={booking.setGuestPhone}
                message={booking.message}
                setMessage={booking.setMessage}
                submitting={booking.submitting}
                onBookingSubmit={booking.handleBookingSubmit}
                bookingModalIntent={booking.bookingModalIntent}
              />
            </div>
          </div>
        </main>

        <GalleryModal
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          images={galleryImageUrls}
          currentIndex={galleryIndex}
          onIndexChange={setGalleryIndex}
          listingTitle={listing.title}
        />
      </div>
    </>
  )
}

export default function PremiumListingPage({ params }) {
  return (
    <Suspense fallback={<ListingPageSkeleton />}>
      <PremiumListingContent params={params} />
    </Suspense>
  )
}
