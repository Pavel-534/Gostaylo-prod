'use client'

/**
 * GoStayLo PDP — Stage 70.2 composer: view data + booking flow + chat; layout + pdp/ components.
 */

import { useState, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  getPdpLightboxImageUrls,
  resolvePdpHeroBlurDataURL,
} from '@/lib/media/image-delivery'
import { useListingViewData } from '@/hooks/useListingViewData'
import { useListingBookingFlow } from '@/hooks/useListingBookingFlow'
import { useListingChat } from '@/hooks/useListingChat'
import { ListingPageNav } from './components/ListingPageNav'
import { ListingPageSkeleton } from './components/ListingPageSkeleton'
import { GalleryModal } from '@/components/listing/GalleryModal'
import { getUIText } from '@/lib/translations'
import { useAuth } from '@/contexts/auth-context'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { ListingHeroGallery } from '@/components/listing/pdp/ListingHero'
import { ListingBookingSection } from '@/components/listing/pdp/ListingBookingSection'
import { ListingMobileActions } from '@/components/listing/pdp/ListingMobileActions'
import { GuestBookingFlowHint } from '@/components/product/GuestBookingFlowHint'
import { ReferralCatalogFunnelStrip } from '@/components/referral/ReferralCatalogFunnelStrip'
import { GuestBookingNextStepsCard } from '@/components/guest/GuestBookingNextStepsCard'
import {
  ListingPdpDetailsColumn,
  useListingPdpGalleryClickHandler,
} from '@/components/listing/pdp/ListingPdpDetailsColumn'

function PremiumListingContent({ params }) {
  const router = useRouter()
  const { user, openLoginModal } = useAuth()
  const { addToRecent } = useRecentlyViewed({ userId: user?.id })

  const view = useListingViewData(params.id, { user, openLoginModal, addToRecent })
  const { listing, reviews, loading, moderationPending, language, currency, exchangeRates, isFavorite, favoriteLoading, handleFavoriteClick } =
    view

  const booking = useListingBookingFlow({
    listing,
    user,
    openLoginModal,
    language,
    currency,
    exchangeRates,
  })

  const chat = useListingChat({
    listing,
    user,
    openLoginModal,
    language,
    dateRange: booking.dateRange,
    guests: booking.guests,
    exclusiveDatesUnavailable: booking.exclusiveDatesUnavailable,
    isVehicleListing: booking.isVehicleListing,
    vehicleStartTime: booking.vehicleStartTime,
    vehicleEndTime: booking.vehicleEndTime,
    priceCalc: booking.priceCalc,
  })

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const galleryImageUrls = useMemo(() => getPdpLightboxImageUrls(listing), [listing])
  const galleryBlurDataURL = useMemo(() => resolvePdpHeroBlurDataURL(listing), [listing])
  const handleGalleryImageClick = useListingPdpGalleryClickHandler(setGalleryIndex, setGalleryOpen)

  const chatPreviewProps = useMemo(
    () => ({
      language,
      listing,
      showContactPartner: chat.showContactPartner,
      lastMessagePreview: chat.lastMessagePreview,
      hasUnreadFromHost: chat.hasUnreadFromHost,
    }),
    [
      language,
      listing,
      chat.showContactPartner,
      chat.lastMessagePreview,
      chat.hasUnreadFromHost,
    ],
  )

  const amenities = listing?.metadata?.amenities || []
  const postInquiryChatHref = booking.postInquiryBooking?.conversationId
    ? `/messages/${encodeURIComponent(booking.postInquiryBooking.conversationId)}`
    : null

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
        onBookingClick: () => booking.handleBookCtaClick('book'),
        onAskPartner: chat.handleContactPartner,
        onAskPartnerUnavailable: booking.handleAskPartnerUnavailable,
        askPartnerLoading: chat.contactPartnerLoading,
        showAskPartner: chat.showContactPartner,
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

  if (moderationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-6">
          <h2 className="text-2xl font-semibold mb-2">{getUIText('listingDetail_underModeration', language)}</h2>
          <p className="text-slate-600 mb-6">{getUIText('listingDetail_underModerationDesc', language)}</p>
          <Button onClick={() => router.push('/listings')} variant="outline">
            {getUIText('listingDetail_backToListings', language)}
          </Button>
        </div>
      </div>
    )
  }

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
      <div className="min-h-screen bg-white text-slate-900">
        <ListingPageNav
          language={language}
          onBack={() => router.back()}
          isFavorite={isFavorite}
          favoriteLoading={favoriteLoading}
          onFavorite={handleFavoriteClick}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 app-pad-mobile-booking-chrome">
          <GuestBookingFlowHint t={(key) => getUIText(key, language)} className="mb-4 max-w-2xl" />
          {booking.postInquiryBooking ? (
            <GuestBookingNextStepsCard
              bookingId={booking.postInquiryBooking.bookingId}
              status={booking.postInquiryBooking.status}
              language={language}
              categorySlug={listing?.categorySlug}
              chatHref={postInquiryChatHref}
              compact
              surface="pdp"
              className="mb-4 max-w-2xl"
            />
          ) : null}
          <ReferralCatalogFunnelStrip language={language} className="mb-4" />
          <ListingHeroGallery
            listing={listing}
            language={language}
            onImageClick={handleGalleryImageClick}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <ListingPdpDetailsColumn
              listing={listing}
              reviews={reviews}
              language={language}
              currency={currency}
              exchangeRates={exchangeRates}
              userId={user?.id}
              amenities={amenities}
              mobileBelow={mobileBelow}
              chatPreviewProps={chatPreviewProps}
            />

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
                onBookingClick={() => booking.handleBookCtaClick('book')}
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
          blurDataURL={galleryBlurDataURL}
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
