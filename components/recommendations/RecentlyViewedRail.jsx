'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { getUIText } from '@/lib/translations'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'
import {
  trackRecommendationClick,
  useRecommendationRailAnalytics,
} from '@/lib/analytics/recommendation-rail-analytics.js'
import { RECENTLY_VIEWED_MIN_PDP } from '@/lib/recommendations/constants'

export function RecentlyViewedRail({
  currentListingId,
  userId = null,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
  surface = 'recent_pdp',
  minItems = RECENTLY_VIEWED_MIN_PDP,
}) {
  const containerRef = useRef(null)
  const { recentListings } = useRecentlyViewed({ userId })
  const currentId = String(currentListingId || '').trim()
  const authenticated = Boolean(String(userId || '').trim())
  const minVisible = Math.max(1, Number(minItems) || RECENTLY_VIEWED_MIN_PDP)

  const items = useMemo(
    () => (recentListings || []).filter((item) => String(item.id) !== currentId),
    [recentListings, currentId],
  )

  const recentMode = authenticated ? 'recent_merged' : 'recent_local'
  const railReady = items.length >= minVisible

  useRecommendationRailAnalytics({
    surface,
    listings: items,
    meta: { mode: recentMode, authenticated },
    containerRef,
    minVisible,
    enabled: railReady,
  })

  if (!railReady) return null

  return (
    <RecommendationRailShell
      ref={containerRef}
      title={getUIText('recentlyViewedTitle', language)}
      className={className}
    >
      {items.map((listing, index) => (
        <div key={listing.id} className="w-[260px] shrink-0 snap-start">
          <Link
            href={`/listings/${listing.id}`}
            className="block"
            onClick={() =>
              trackRecommendationClick({
                surface,
                listingId: listing.id,
                position: index,
                meta: { mode: recentMode, authenticated },
              })
            }
          >
            <ListingCard
              listing={{
                ...listing,
                basePriceThb: listing.base_price_thb ?? listing.basePriceThb,
                guestDisplayPriceThb:
                  listing.guest_display_price_thb ?? listing.guestDisplayPriceThb,
                coverImage: listing.cover_image ?? listing.coverImage,
              }}
              language={language}
              currency={currency}
              exchangeRates={exchangeRates}
              className="h-full"
            />
          </Link>
        </div>
      ))}
    </RecommendationRailShell>
  )
}
