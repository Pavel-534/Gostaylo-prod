'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { RecommendationRailCard } from '@/components/recommendations/RecommendationRailCard'
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
import { fetchForYouRail } from '@/lib/recommendations/fetch-for-you-rail'
import { queryKeys } from '@/lib/query-keys'
import { HOME_WIDGET_QUERY_OPTIONS } from '@/lib/query-prefetch/home-query-constants'
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
  const whereKey = where && where !== 'all' ? String(where) : 'all'
  const containerRef = useRef(null)
  const isMobile = useIsMobile()
  const isCatalogXs = useMediaQuery(`(max-width: ${FOR_YOU_CATALOG_HIDE_MAX_WIDTH_PX}px)`)

  const { data, isPending } = useQuery({
    queryKey: queryKeys.recommendations.forYou(whereKey),
    queryFn: () => fetchForYouRail(whereKey),
    ...HOME_WIDGET_QUERY_OPTIONS,
  })

  const listings = data?.listings || []
  const meta = data?.meta ?? null
  const loading = isPending && !data

  useEffect(() => {
    if (!meta) return
    if (meta.mode === 'guest_personalized' || meta.mode === 'guest_personalized_topup') {
      void trackProductEvent(ProductAnalyticsEvents.GUEST_PERSONALIZATION_FOR_YOU, {
        mode: meta.mode,
        guest_signals: meta.guest_signals ?? 0,
        authenticated: false,
        where: whereKey !== 'all' ? whereKey : undefined,
        surface,
      })
    }
  }, [meta, whereKey, surface])

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

  const dedupeExtra = whereKey !== 'all' ? whereKey : null

  useRecommendationRailAnalytics({
    surface,
    listings: displayListings,
    meta: analyticsMeta,
    containerRef,
    minVisible: 1,
    enabled: railReady,
    dedupeExtra,
  })

  if (loading) return null
  if (!shouldRender) return null

  return (
    <RecommendationRailShell
      ref={containerRef}
      title={getUIText('forYouTitle', language)}
      className={className}
    >
      {displayListings.map((listing, index) => (
        <div key={listing.id} className={cn(RECOMMENDATION_RAIL_CARD_CLASS, 'h-full')}>
          <RecommendationRailCard
            listing={listing}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
            className="h-full"
            onNavigate={() =>
              trackRecommendationClick({
                surface,
                listingId: listing.id,
                position: index,
                meta: analyticsMeta,
              })
            }
          />
        </div>
      ))}
    </RecommendationRailShell>
  )
}
