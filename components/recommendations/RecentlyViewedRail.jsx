'use client'

import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { getUIText } from '@/lib/translations'
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'

export function RecentlyViewedRail({
  currentListingId,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
}) {
  const { recentListings } = useRecentlyViewed()
  const currentId = String(currentListingId || '').trim()

  const items = (recentListings || []).filter((item) => String(item.id) !== currentId)
  if (items.length === 0) return null

  return (
    <RecommendationRailShell
      title={getUIText('recentlyViewedTitle', language)}
      className={className}
    >
      {items.map((listing) => (
        <div key={listing.id} className="w-[260px] shrink-0 snap-start">
          <Link href={`/listings/${listing.id}`} className="block">
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
