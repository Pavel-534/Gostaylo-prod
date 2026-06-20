'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listing-card'
import { getUIText } from '@/lib/translations'
import { RecommendationRailShell } from '@/components/recommendations/RecommendationRailShell'
import {
  trackRecommendationClick,
  useRecommendationRailAnalytics,
} from '@/lib/analytics/recommendation-rail-analytics.js'
import {
  trackProductEvent,
  ProductAnalyticsEvents,
} from '@/lib/analytics/product-analytics.js'
import {
  FOR_YOU_MIN_RESULTS,
  FOR_YOU_MOBILE_MAX_CARDS,
  FOR_YOU_CATALOG_HIDE_MAX_WIDTH_PX,
  RECOMMENDATION_RAIL_CARD_CLASS,
} from '@/lib/recommendations/constants'
import { resolveForYouRailDisplay } from '@/lib/recommendations/for-you-rail-display'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMediaQuery } from '@/hooks/use-media-query'

export function ForYouRail({
  where = 'all',
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  className,
  surface = 'for_you_home',
}) {
  const [listings, setListings] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef(null)
  const isMobile = useIsMobile()
  const isCatalogXs = useMediaQuery(`(max-width: ${FOR_YOU_CATALOG_HIDE_MAX_WIDTH_PX}px)`)

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
        if (data.meta?.mode === 'guest_personalized' || data.meta?.mode === 'guest_personalized_topup') {
          void trackProductEvent(ProductAnalyticsEvents.GUEST_PERSONALIZATION_FOR_YOU, {
            mode: data.meta.mode,
            guest_signals: data.meta.guest_signals ?? 0,
            authenticated: false,
            where: where && where !== 'all' ? where : undefined,
            surface,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [where, surface])

  const { visible: displayListings, shouldRender } = useMemo(
    () =>
      resolveForYouRailDisplay(listings, {
        minResults: FOR_YOU_MIN_RESULTS,
        isMobile,
        isCatalogXsHidden: surface === 'for_you_catalog' && isCatalogXs,
        mobileMaxCards: FOR_YOU_MOBILE_MAX_CARDS,
      }),
    [listings, isMobile, isCatalogXs, surface],
  )

  const railReady = !loading && shouldRender

  const analyticsMeta = useMemo(
    () => ({
      mode: meta?.mode ?? null,
      authenticated: meta?.authenticated === true,
      guest_signals: meta?.guest_signals ?? 0,
    }),
    [meta?.mode, meta?.authenticated, meta?.guest_signals],
  )

  const dedupeExtra = where && where !== 'all' ? String(where) : null

  useRecommendationRailAnalytics({
    surface,
    listings: displayListings,
    meta: analyticsMeta,
    containerRef,
    minVisible: 1,
    enabled: railReady,
    dedupeExtra,
  })

  if (loading) {
    return null
  }

  if (!shouldRender) return null

  return (
    <RecommendationRailShell
      ref={containerRef}
      title={getUIText('forYouTitle', language)}
      className={className}
    >
      {displayListings.map((listing, index) => (
        <div key={listing.id} className={RECOMMENDATION_RAIL_CARD_CLASS}>
          <Link
            href={`/listings/${listing.id}`}
            className="block"
            onClick={() =>
              trackRecommendationClick({
                surface,
                listingId: listing.id,
                position: index,
                meta: analyticsMeta,
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
