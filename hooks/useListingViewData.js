'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { detectLanguage } from '@/lib/translations'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { recordPwaEngagement } from '@/lib/pwa/pwa-install-storage.js'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { queryKeys } from '@/lib/query-keys'
import { useFavoriteState } from '@/lib/hooks/useFavoriteState'

/**
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {string} listingId
 */
function readListingViewCacheSnapshot(queryClient, listingId) {
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
 * PDP primary view data: listing + reviews load, locale/currency, favorites, recently viewed.
 * Stage 171.21 — sync React Query cache on init to avoid skeleton flash after prefetch.
 */
export function useListingViewData(listingId, { user, openLoginModal, addToRecent }) {
  const queryClient = useQueryClient()

  const [listing, setListing] = useState(
    () => readListingViewCacheSnapshot(queryClient, listingId).listing,
  )
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(
    () => readListingViewCacheSnapshot(queryClient, listingId).loading,
  )
  const [moderationPending, setModerationPending] = useState(
    () => readListingViewCacheSnapshot(queryClient, listingId).moderationPending,
  )
  const [language, setLanguage] = useState('ru')
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })

  const {
    isFavorite,
    favoriteLoading,
    handleFavoriteClick,
  } = useFavoriteState(listingId, { user, openLoginModal, language })

  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/reviews?listing_id=${encodeURIComponent(listingId)}`)
      const data = await res.json()
      if (data.success) {
        const raw = data.data
        setReviews(Array.isArray(raw) ? raw : (raw?.reviews ?? []))
      }
    } catch {
      /* ignore */
    }
  }, [listingId])

  const loadListing = useCallback(async () => {
    const id = String(listingId || '').trim()
    if (!id) {
      setLoading(false)
      return
    }

    const queryKey = queryKeys.listing.detail(id)
    const cached = queryClient.getQueryData(queryKey)
    if (cached) {
      if (cached.moderationPending) {
        setModerationPending(true)
        setListing(null)
      } else {
        setListing(cached)
        setModerationPending(false)
      }
      setLoading(false)
      return
    }

    try {
      const mapped = await fetchListingDetail(id)
      if (mapped?.moderationPending) {
        setModerationPending(true)
        setListing(null)
        queryClient.setQueryData(queryKey, { moderationPending: true })
      } else if (mapped) {
        queryClient.setQueryData(queryKey, mapped)
        setListing(mapped)
        setModerationPending(false)
      } else {
        setModerationPending(false)
      }
    } catch (error) {
      console.error('Failed to load listing:', error)
    } finally {
      setLoading(false)
    }
  }, [listingId, queryClient])

  useEffect(() => {
    setLanguage(detectLanguage())
    try {
      const stored = localStorage.getItem('gostaylo_currency')
      if (stored) setCurrency(stored)
    } catch {
      /* ignore */
    }

    const snapshot = readListingViewCacheSnapshot(queryClient, listingId)
    setListing(snapshot.listing)
    setModerationPending(snapshot.moderationPending)
    setLoading(snapshot.loading)

    if (snapshot.loading) {
      void loadListing()
    }
    loadReviews()
  }, [listingId, queryClient, loadListing, loadReviews])

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
