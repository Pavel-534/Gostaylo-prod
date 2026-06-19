'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { getUIText } from '@/lib/translations'
import { SIMILAR_MIN_RESULTS } from '@/lib/recommendations/constants'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'
import {
  trackRecommendationClick,
  useRecommendationRailAnalytics,
} from '@/lib/analytics/recommendation-rail-analytics.js'

export function SimilarListingsRail({
  listingId,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
}) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const anchorId = String(listingId || '').trim()

  useEffect(() => {
    if (!anchorId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/v2/listings/${encodeURIComponent(anchorId)}/similar?limit=12`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.listings)) {
          setListings(data.listings)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [anchorId])

  const railReady = !loading && listings.length >= SIMILAR_MIN_RESULTS

  useRecommendationRailAnalytics({
    surface: 'similar_pdp',
    listings,
    meta: { mode: 'similar_v1' },
    anchorListingId: anchorId || null,
    containerRef,
    minVisible: SIMILAR_MIN_RESULTS,
    enabled: railReady,
  })

  if (loading) {
    return (
      <RecommendationRailShell
        title={getUIText('similarListingsTitle', language)}
        className={className}
      >
        <div className="min-w-[260px] snap-start">
          <ListingGridSkeleton count={1} />
        </div>
      </RecommendationRailShell>
    )
  }

  if (listings.length < SIMILAR_MIN_RESULTS) return null

  return (
    <RecommendationRailShell
      ref={containerRef}
      title={getUIText('similarListingsTitle', language)}
      className={className}
    >
      {listings.map((listing, index) => (
        <div key={listing.id} className="w-[260px] shrink-0 snap-start">
          <Link
            href={`/listings/${listing.id}`}
            className="block"
            onClick={() =>
              trackRecommendationClick({
                surface: 'similar_pdp',
                listingId: listing.id,
                position: index,
                meta: { mode: 'similar_v1' },
                anchorListingId: anchorId,
              })
            }
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
