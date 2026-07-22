'use client'

/**
 * PDP client composer — view data + booking flow + chat (client islands).
 * Stage 171.24 (PR-4 RSC shell + PR-5 ListingBookingProvider).
 *
 * @see hooks/useListingViewData.js — `useQuery` + `queryKeys.listing.detail(id)`
 * @see components/listing/pdp/ListingPdpHydrationBoundary.jsx
 * @see components/listing/pdp/ListingBookingProvider.jsx
 */

import { useState, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  getPdpLightboxImageUrls,
  resolvePdpHeroBlurDataURL,
} from '@/lib/media/image-delivery'
import { useListingViewData } from '@/hooks/useListingViewData'
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
import {
  ListingBookingProvider,
  useListingBooking,
} from '@/components/listing/pdp/ListingBookingProvider'
import { GuestBookingFlowHint } from '@/components/product/GuestBookingFlowHint'
import { ReferralCatalogFunnelStrip } from '@/components/referral/ReferralCatalogFunnelStrip'
import { GuestBookingNextStepsCard } from '@/components/guest/GuestBookingNextStepsCard'
import {
  ListingPdpDetailsColumn,
  useListingPdpGalleryClickHandler,
} from '@/components/listing/pdp/ListingPdpDetailsColumn'
import { I18nSliceBootstrap } from '@/components/i18n/I18nSliceBootstrap'

/**
 * Post-inquiry banner — reads booking context inside provider.
 * @param {{ language: string, listing: object }} props
 */
function ListingPdpPostInquiryBanner({ language, listing }) {
  const { postInquiryBooking } = useListingBooking()
  if (!postInquiryBooking) return null

  const bookingId = postInquiryBooking.bookingId
    ? String(postInquiryBooking.bookingId)
    : null
  const status = String(postInquiryBooking.status || '').toUpperCase()
  const postInquiryChatHref = postInquiryBooking.conversationId
    ? `/messages/${encodeURIComponent(String(postInquiryBooking.conversationId))}`
    : null
  // Same checkout contract as chat `BookingInfoSidebar` / my-bookings next-steps.
  const payHref =
    bookingId && status === 'AWAITING_PAYMENT'
      ? `/checkout/${encodeURIComponent(bookingId)}`
      : null

  return (
    <GuestBookingNextStepsCard
      bookingId={bookingId}
      status={status}
      language={language}
      categorySlug={listing?.categorySlug}
      chatHref={postInquiryChatHref}
      payHref={payHref}
      compact
      surface="pdp"
      className="mb-4 max-w-2xl"
    />
  )
}

/**
 * Grid + booking/chat islands — must render inside `ListingBookingProvider`.
 */
function ListingPdpBookingGrid({ reviews, amenities, userId }) {
  const booking = useListingBooking()
  const { listing, language, currency, exchangeRates, user, openLoginModal, exclusiveDatesUnavailable } =
    booking

  const chat = useListingChat({
    listing,
    user,
    openLoginModal,
    language,
    dateRange: booking.dateRange,
    guests: booking.guests,
    exclusiveDatesUnavailable,
    isVehicleListing: booking.isVehicleListing,
    vehicleStartTime: booking.vehicleStartTime,
    vehicleEndTime: booking.vehicleEndTime,
    priceCalc: booking.priceCalc,
  })

  const chatPreviewProps = useMemo(
    () => ({
      language,
      listing,
      showContactPartner: chat.showContactPartner,
      lastMessagePreview: chat.lastMessagePreview,
      hasUnreadFromHost: chat.hasUnreadFromHost,
    }),
    [language, listing, chat.showContactPartner, chat.lastMessagePreview, chat.hasUnreadFromHost],
  )

  const bookingSectionChat = useMemo(
    () => ({
      showAskPartner: chat.showContactPartner && !exclusiveDatesUnavailable,
      onAskPartner: chat.handleContactPartner,
      askPartnerLoading: chat.contactPartnerLoading,
      hasExistingConversation: !!chat.existingConvId,
      lastMessagePreview: chat.lastMessagePreview,
      hasUnreadFromHost: chat.hasUnreadFromHost,
    }),
    [
      chat.showContactPartner,
      chat.handleContactPartner,
      chat.contactPartnerLoading,
      chat.existingConvId,
      chat.lastMessagePreview,
      chat.hasUnreadFromHost,
      exclusiveDatesUnavailable,
    ],
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      <ListingPdpDetailsColumn
        listing={listing}
        reviews={reviews}
        language={language}
        currency={currency}
        exchangeRates={exchangeRates}
        userId={userId}
        amenities={amenities}
        mobileBelow={<ListingMobileActions chat={chat} />}
        chatPreviewProps={chatPreviewProps}
      />

      <div className="lg:col-span-1">
        <ListingBookingSection chat={bookingSectionChat} />
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} props.listingId — listings.id from RSC shell
 * @param {string} [props.lang] — SSR locale from `getLangFromRequest`
 */
function ListingPdpContent({ listingId, lang }) {
  const router = useRouter()
  const { user, openLoginModal } = useAuth()
  const { addToRecent } = useRecentlyViewed({ userId: user?.id })

  const view = useListingViewData(listingId, {
    user,
    openLoginModal,
    addToRecent,
    initialLang: lang,
  })
  const {
    listing,
    reviews,
    loading,
    moderationPending,
    language,
    currency,
    exchangeRates,
    isFavorite,
    favoriteLoading,
    handleFavoriteClick,
  } = view

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const galleryImageUrls = useMemo(() => getPdpLightboxImageUrls(listing), [listing])
  const galleryBlurDataURL = useMemo(() => resolvePdpHeroBlurDataURL(listing), [listing])
  const handleGalleryImageClick = useListingPdpGalleryClickHandler(setGalleryIndex, setGalleryOpen)

  const amenities = listing?.metadata?.amenities || []

  if (loading) return <ListingPageSkeleton />

  if (moderationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md px-6">
          <h2 className="text-2xl font-semibold mb-2">
            {getUIText('listingDetail_underModeration', language)}
          </h2>
          <p className="text-slate-600 mb-6">
            {getUIText('listingDetail_underModerationDesc', language)}
          </p>
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
          <h2 className="text-2xl font-semibold mb-2">
            {getUIText('listingDetail_notFound', language)}
          </h2>
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
          <GuestBookingFlowHint
            t={(key) => getUIText(key, language)}
            className="mb-4 max-w-2xl"
            bookingMode={
              listing?.instantBooking === true || listing?.instant_booking === true
                ? 'instant'
                : 'request'
            }
          />
          <ListingBookingProvider
            listing={listing}
            user={user}
            openLoginModal={openLoginModal}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
          >
            <ListingPdpPostInquiryBanner language={language} listing={listing} />
            <ReferralCatalogFunnelStrip language={language} className="mb-4" />
            <ListingHeroGallery
              listing={listing}
              language={language}
              onImageClick={handleGalleryImageClick}
            />
            <ListingPdpBookingGrid reviews={reviews} amenities={amenities} userId={user?.id} />
          </ListingBookingProvider>
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

/**
 * @param {object} props
 * @param {string} props.listingId
 * @param {string} [props.lang]
 */
export function ListingPdpClient({ listingId, lang }) {
  return (
    <>
      <I18nSliceBootstrap preset="pdp" />
      <Suspense fallback={<ListingPageSkeleton />}>
        <ListingPdpContent listingId={listingId} lang={lang} />
      </Suspense>
    </>
  )
}
