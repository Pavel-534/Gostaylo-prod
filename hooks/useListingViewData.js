'use client'

/**
 * PDP primary view data: listing (TanStack Query), reviews, locale/currency, favorites.
 * Stage 171.24 (PR-3) — listing detail via `useQuery` + shared prefetch/hydrate key.
 *
 * Listing SSOT cache key: `queryKeys.listing.detail(id)` — same as catalog hover/touch prefetch
 * and RSC `buildListingPdpDehydratedState` (PR-4). Fresh prefetched/hydrated data → no refetch on mount
 * (`refetchOnMount: false` in `lib/query-client.js`).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { detectLanguage } from '@/lib/translations'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { recordPwaEngagement } from '@/lib/pwa/pwa-install-storage.js'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { queryKeys } from '@/lib/query-keys'
import { LISTING_DETAIL_STALE_MS } from '@/lib/query-prefetch/listing-detail-query-constants'
import { useFavoriteState } from '@/lib/hooks/useFavoriteState'

/**
 * Sync read of listing detail cache — used before `useQuery` hydrates and for catalog → PDP
 * instant shell (no skeleton when prefetch populated the same key).
 *
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} listingId
 * @returns {{ listing: object | null, loading: boolean, moderationPending: boolean }}
 */
export function readListingViewCacheSnapshot(queryClient, listingId) {
  const id = String(listingId || '').trim()
  if (!id) {
    return { listing: null, loading: false, moderationPending: false }
  }
  const cached = queryClient.getQueryData(queryKeys.listing.detail(id))
  if (!cached) {
    return { listing: null, loading: true, moderationPending: false }
  }
  if (cached.moderationPending) {
    return { listing: null, loading: false, moderationPending: true }
  }
  return { listing: cached, loading: false, moderationPending: false }
}

/**
 * @param {string} listingId
 * @param {object} options
 * @param {object | null} options.user
 * @param {() => void} options.openLoginModal
 * @param {(item: object) => void} options.addToRecent
 * @param {string} [options.initialLang] — SSR locale from RSC shell (`getLangFromRequest`)
 */
export function useListingViewData(listingId, { user, openLoginModal, addToRecent, initialLang }) {
  const queryClient = useQueryClient()
  const id = String(listingId || '').trim()
  const queryKey = useMemo(() => queryKeys.listing.detail(id), [id])

  const listingQuery = useQuery({
    queryKey,
    queryFn: () => fetchListingDetail(id),
    staleTime: LISTING_DETAIL_STALE_MS,
    enabled: Boolean(id),
  })

  const listingData = listingQuery.data
  const listing =
    listingData && typeof listingData === 'object' && listingData.moderationPending
      ? null
      : (listingData ?? null)
  const moderationPending = Boolean(
    listingData && typeof listingData === 'object' && listingData.moderationPending,
  )
  // Pending only when no cached/prefetched/hydrated payload yet (catalog prefetch avoids flash).
  const loading = listingQuery.isPending && listingData === undefined

  const [reviews, setReviews] = useState([])
  const [language, setLanguage] = useState(() => initialLang || detectLanguage())
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })

  const {
    isFavorite,
    favoriteLoading,
    handleFavoriteClick,
  } = useFavoriteState(listingId, { user, openLoginModal, language })

  const setListing = useCallback(
    (updater) => {
      if (!id) return
      queryClient.setQueryData(queryKey, (prev) =>
        typeof updater === 'function' ? updater(prev ?? null) : updater,
      )
    },
    [id, queryClient, queryKey],
  )

  const loadReviews = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/v2/reviews?listing_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data.success) {
        const raw = data.data
        setReviews(Array.isArray(raw) ? raw : (raw?.reviews ?? []))
      }
    } catch {
      /* ignore */
    }
  }, [id])

  useEffect(() => {
    setLanguage(detectLanguage())
    try {
      const stored = localStorage.getItem('gostaylo_currency')
      if (stored) setCurrency(stored)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  useEffect(() => {
    const handler = (e) => {
      if (e?.detail) setCurrency(e.detail)
    }
    window.addEventListener('currency-change', handler)
    return () => window.removeEventListener('currency-change', handler)
  }, [])

  useEffect(() => {
    const handler = (e) => e?.detail && setLanguage(e.detail)
    window.addEventListener('language-change', handler)
    return () => window.removeEventListener('language-change', handler)
  }, [])

  useEffect(() => {
    if (listing && !loading) {
      void trackProductEvent(ProductAnalyticsEvents.LISTING_VIEW, {
        listing_id: listing.id,
        category_slug: listing.categorySlug || undefined,
      })
      recordPwaEngagement('pdp_view')
      addToRecent({
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.coverImage,
        basePriceThb: listing.basePriceThb,
        guestDisplayPriceThb: listing.guestDisplayPriceThb,
        rating: listing.rating,
        reviewsCount: listing.reviewsCount,
      })
    }
  }, [listing, loading, addToRecent])

  return {
    listing,
    setListing,
    reviews,
    setReviews,
    loading,
    moderationPending,
    language,
    setLanguage,
    currency,
    setCurrency,
    exchangeRates,
    isFavorite,
    favoriteLoading,
    handleFavoriteClick,
  }
}
