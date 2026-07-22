'use client'

import { memo, useCallback } from 'react'
import { Separator } from '@/components/ui/separator'
import { ListingHeroHeadline } from '@/components/listing/pdp/ListingHero'
import { ListingDescription } from '@/components/listing/pdp/ListingDescription'
import { ListingMap } from '@/components/listing/pdp/ListingMap'
import { ListingChatPreview } from '@/components/listing/pdp/ListingChatPreview'
import { ListingReviews } from '@/components/listing/pdp/ListingReviews'
import { SimilarListingsRail } from '@/components/recommendations/SimilarListingsRail'
import { RecentlyViewedRail } from '@/components/recommendations/RecentlyViewedRail'

/**
 * PDP left column — isolated from booking date state to avoid calendar click re-renders (Stage 171.23).
 */
function ListingPdpDetailsColumnInner({
  listing,
  reviews,
  language,
  currency,
  exchangeRates,
  userId,
  amenities,
  mobileBelow,
  chatPreviewProps,
}) {
  return (
    <div className="lg:col-span-2 space-y-8">
      <ListingHeroHeadline listing={listing} language={language} />
      <Separator />
      {/* Stage 191.0 — reviews above description/map for trust CRO */}
      <ListingReviews listing={listing} reviews={reviews} language={language} />
      <Separator />
      <ListingDescription
        listing={listing}
        language={language}
        amenities={amenities}
        belowDescription={mobileBelow}
      />
      <Separator />
      <ListingMap listing={listing} language={language} />
      <ListingChatPreview {...chatPreviewProps} />
      <Separator />
      <SimilarListingsRail
        listingId={listing.id}
        language={language}
        currency={currency}
        exchangeRates={exchangeRates}
      />
      <RecentlyViewedRail
        currentListingId={listing.id}
        userId={userId}
        language={language}
        currency={currency}
        exchangeRates={exchangeRates}
      />
    </div>
  )
}

function detailsColumnPropsEqual(prev, next) {
  if (prev.listing?.id !== next.listing?.id) return false
  if (prev.language !== next.language) return false
  if (prev.currency !== next.currency) return false
  if (prev.userId !== next.userId) return false
  if (prev.reviews !== next.reviews) return false
  if (prev.exchangeRates !== next.exchangeRates) return false
  if (prev.amenities !== next.amenities) return false
  if (prev.mobileBelow !== next.mobileBelow) return false
  if (prev.chatPreviewProps !== next.chatPreviewProps) return false
  return true
}

export const ListingPdpDetailsColumn = memo(ListingPdpDetailsColumnInner, detailsColumnPropsEqual)

export function useListingPdpGalleryClickHandler(setGalleryIndex, setGalleryOpen) {
  return useCallback((index) => {
    setGalleryIndex(typeof index === 'number' ? index : 0)
    setGalleryOpen(true)
  }, [setGalleryIndex, setGalleryOpen])
}
