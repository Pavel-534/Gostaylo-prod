'use client'

import { memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { ListingHeroHeadline } from '@/components/listing/pdp/ListingHero'
import { ListingDescription } from '@/components/listing/pdp/ListingDescription'
import { ListingMap } from '@/components/listing/pdp/ListingMap'
import { ListingChatPreview } from '@/components/listing/pdp/ListingChatPreview'
import { ListingReviews } from '@/components/listing/pdp/ListingReviews'
import { AmenitiesGrid } from '@/components/listing/AmenitiesGrid'
import { PdpDeferredSection } from '@/components/listing/pdp/PdpDeferredSection'
import {
  ListingPdpSection,
  ListingPdpSectionStack,
} from '@/components/listing/pdp/ListingPdpSection'
import {
  LISTING_PDP_RAIL_SECTION_CLASS,
  LISTING_PDP_SECTION_RULE_CLASS,
} from '@/lib/listing/pdp-section-rhythm'

const SimilarListingsRail = dynamic(
  () =>
    import('@/components/recommendations/SimilarListingsRail').then(
      (m) => m.SimilarListingsRail,
    ),
  { ssr: false, loading: () => null },
)

const RecentlyViewedRail = dynamic(
  () =>
    import('@/components/recommendations/RecentlyViewedRail').then(
      (m) => m.RecentlyViewedRail,
    ),
  { ssr: false, loading: () => null },
)

/**
 * PDP left column — isolated from booking date state to avoid calendar click re-renders (Stage 171.23).
 * Stage 201.83 — section order: story → trust (reviews) → place (map) → rails.
 * Stage 201.85 — SSOT section rhythm; mobile dates sit between stacks (not inside divide-y).
 * Stage 201.118 — reviews + rails viewport-deferred; map already deferred in ListingMap (171.23).
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
  const showChatPreview = Boolean(chatPreviewProps?.showContactPartner)
  const hasAmenities = Array.isArray(amenities) && amenities.length > 0

  return (
    <div className="lg:col-span-2 min-w-0 overflow-x-clip">
      <ListingPdpSectionStack>
        <ListingPdpSection>
          <ListingHeroHeadline listing={listing} language={language} />
        </ListingPdpSection>
        <ListingDescription listing={listing} language={language} />
      </ListingPdpSectionStack>

      {/* Outside divide-y: `lg:hidden` must not leave orphan section rules on desktop. */}
      {mobileBelow}

      <ListingPdpSectionStack
        className={cn('border-t max-lg:border-t-0', LISTING_PDP_SECTION_RULE_CLASS)}
      >
        {hasAmenities ? (
          <ListingPdpSection>
            <AmenitiesGrid amenities={amenities} language={language} />
          </ListingPdpSection>
        ) : null}
        <ListingPdpSection>
          <ListingReviews listing={listing} reviews={reviews} language={language} />
        </ListingPdpSection>
        <ListingPdpSection>
          <ListingMap listing={listing} language={language} />
        </ListingPdpSection>
      </ListingPdpSectionStack>

      {showChatPreview ? (
        <div className={cn(LISTING_PDP_RAIL_SECTION_CLASS, 'hidden lg:block')}>
          <ListingChatPreview {...chatPreviewProps} />
        </div>
      ) : null}

      <PdpDeferredSection fallback={null} className={LISTING_PDP_RAIL_SECTION_CLASS}>
        <SimilarListingsRail
          listingId={listing.id}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
        />
      </PdpDeferredSection>
      <PdpDeferredSection fallback={null} className={LISTING_PDP_RAIL_SECTION_CLASS}>
        <RecentlyViewedRail
          currentListingId={listing.id}
          userId={userId}
          language={language}
          currency={currency}
          exchangeRates={exchangeRates}
        />
      </PdpDeferredSection>
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
