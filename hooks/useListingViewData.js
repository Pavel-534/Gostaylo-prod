'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'
import { fetchListingDetail } from '@/lib/catalog/fetch-listing-detail'
import { queryKeys } from '@/lib/query-keys'

/**
 * PDP primary view data: listing + reviews load, locale/currency, favorites, recently viewed.
 * Booking URL sync, availability, and chat pre-check stay on the page (or dedicated hooks).
 */
export function useListingViewData(listingId, { user, openLoginModal, addToRecent }) {
  const queryClient = useQueryClient()
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [moderationPending, setModerationPending] = useState(false)
  const [language, setLanguage] = useState('ru')
  const [currency, setCurrency] = useState('THB')
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)

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
    setLoading(true)
    setModerationPending(false)
    loadListing()
    loadReviews()
  }, [listingId, loadListing, loadReviews])

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
    if (!user?.id || !listing?.id) {
      setIsFavorite(false)
      return
    }
    fetch('/api/v2/favorites')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.favorites) {
          const inFavs = data.favorites.some((f) => f.listing_id === listing.id)
          setIsFavorite(inFavs)
        }
      })
      .catch(() => {})
  }, [user?.id, listing?.id])

  useEffect(() => {
    if (listing && !loading) {
      void trackProductEvent(ProductAnalyticsEvents.LISTING_VIEW, {
        listing_id: listing.id,
        category_slug: listing.categorySlug || undefined,
      })
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

  const handleFavoriteClick = useCallback(async () => {
    if (!user) {
      openLoginModal()
      return
    }
    if (favoriteLoading || !listing?.id) return
    setFavoriteLoading(true)
    const newState = !isFavorite
    setIsFavorite(newState)
    try {
      const res = await fetch('/api/v2/favorites', {
        method: newState ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id }),
      })
      const data = await res.json()
      if (!data.success) {
        setIsFavorite(!newState)
        toast.error(getUIText('listingDetail_favoriteError', language))
      } else {
        toast.success(
          newState
            ? getUIText('listingDetail_favoriteAdded', language)
            : getUIText('listingDetail_favoriteRemoved', language),
        )
      }
    } catch {
      setIsFavorite(!newState)
      toast.error(getUIText('listingDetail_networkError', language))
    } finally {
      setFavoriteLoading(false)
    }
  }, [user, favoriteLoading, listing?.id, isFavorite, language, openLoginModal])

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
