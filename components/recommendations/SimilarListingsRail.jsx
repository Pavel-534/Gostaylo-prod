'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { RecommendationRailCard } from '@/components/recommendations/RecommendationRailCard'
import { getUIText } from '@/lib/translations'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'
import {
  trackRecommendationClick,
  useRecommendationRailAnalytics,
} from '@/lib/analytics/recommendation-rail-analytics.js'
import {
  SIMILAR_MIN_RESULTS,
  RECOMMENDATION_RAIL_CARD_CLASS,
} from '@/lib/recommendations/constants'

/**
 * PDP «Похожие объявления» — тот же compact rail SSOT, что «Недавно смотрели» / «Для вас».
 * Без skeleton: грузится в фоне, секция появляется только когда есть ≥ SIMILAR_MIN_RESULTS.
 */
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

  const shouldRender = useMemo(
    () => !loading && listings.length >= SIMILAR_MIN_RESULTS,
    [loading, listings.length],
  )

  useRecommendationRailAnalytics({
    surface: 'similar_pdp',
    listings,
    meta: { mode: 'similar_v1' },
    anchorListingId: anchorId || null,
    containerRef,
    minVisible: SIMILAR_MIN_RESULTS,
    enabled: shouldRender,
  })

  if (loading) {
    return null
  }

  if (!shouldRender) return null

  return (
    <RecommendationRailShell
      ref={containerRef}
      title={getUIText('similarListingsTitle', language)}
      className={className}
    >
      {listings.map((listing, index) => (
        <div key={listing.id} className={cn(RECOMMENDATION_RAIL_CARD_CLASS, 'h-full')}>
          <RecommendationRailCard
            listing={listing}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
            className="h-full"
            onNavigate={() =>
              trackRecommendationClick({
                surface: 'similar_pdp',
                listingId: listing.id,
                position: index,
                meta: { mode: 'similar_v1' },
                anchorListingId: anchorId,
              })
            }
          />
        </div>
      ))}
    </RecommendationRailShell>
  )
}
