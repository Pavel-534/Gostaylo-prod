'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { getUIText } from '@/lib/translations'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { PERSONALIZATION_MIN_RESULTS } from '@/lib/recommendations/constants'

export function ForYouRail({
  where = 'all',
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
  surface = 'for_you',
}) {
  const [listings, setListings] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const impressionSentRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams({ limit: '16' })
    if (where && where !== 'all') params.set('where', where)

    fetch(`/api/v2/recommendations/for-you?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return
        setListings(Array.isArray(data.listings) ? data.listings : [])
        setMeta(data.meta ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [where])

  useEffect(() => {
    impressionSentRef.current = false
  }, [where])

  useEffect(() => {
    if (loading || impressionSentRef.current || listings.length < PERSONALIZATION_MIN_RESULTS) return
    impressionSentRef.current = true
    void trackProductEvent(ProductAnalyticsEvents.RECOMMENDATION_IMPRESSION, {
      surface,
      count: listings.length,
      mode: meta?.mode ?? null,
      authenticated: meta?.authenticated === true,
    })
  }, [loading, listings, meta, surface])

  const handleClick = (listingId) => {
    void trackProductEvent(ProductAnalyticsEvents.RECOMMENDATION_CLICK, {
      surface,
      listing_id: listingId,
      mode: meta?.mode ?? null,
    })
  }

  if (loading) {
    return (
      <RecommendationRailShell title={getUIText('forYouTitle', language)} className={className}>
        <div className="min-w-[260px] snap-start">
          <ListingGridSkeleton count={1} />
        </div>
      </RecommendationRailShell>
    )
  }

  if (listings.length < PERSONALIZATION_MIN_RESULTS) return null

  return (
    <RecommendationRailShell title={getUIText('forYouTitle', language)} className={className}>
      {listings.map((listing) => (
        <div key={listing.id} className="w-[260px] shrink-0 snap-start">
          <Link
            href={`/listings/${listing.id}`}
            className="block"
            onClick={() => handleClick(listing.id)}
          >
            <ListingCard
              listing={listing}
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
