'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { detectLanguage, getUIText } from '@/lib/translations'
import { fetchExchangeRates } from '@/lib/client-data'

/**
 * PDP primary view data: listing + reviews load, locale/currency, favorites, recently viewed.
 * Booking URL sync, availability, and chat pre-check stay on the page (or dedicated hooks).
 */
export function useListingViewData(listingId, { user, openLoginModal, addToRecent }) {
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState('ru')
  const [currency, setCurrency] = useState('THB')
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 })
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
    try {
      const res = await fetch(`/api/v2/listings/${encodeURIComponent(listingId)}`)
      const data = await res.json()

      if (data.success && data.data) {
        const l = data.data
        const seasonalRaw = l.seasonalPrices || l.seasonalPricing || []
        const seasonalPricing = Array.isArray(seasonalRaw)
          ? seasonalRaw.map((sp) => ({
              startDate: sp.startDate || sp.start_date,
              endDate: sp.endDate || sp.end_date,
              priceDaily: sp.priceDaily ?? sp.price_daily,
              label: sp.label,
              seasonType: sp.seasonType || sp.season_type,
              name: sp.label,
              priceMultiplier: sp.priceMultiplier,
            }))
          : []
        const seasonalPricesRaw = l.seasonalPrices || []
        setListing({
          id: l.id,
          ownerId: l.ownerId ?? l.owner?.id ?? null,
          owner: l.owner,
          title: l.title,
          description: l.description,
          district: l.district,
          latitude: l.latitude,
          longitude: l.longitude,
          basePriceThb: parseFloat(l.basePriceThb),
          commissionRate: parseFloat(l.commissionRate),
          images: l.images || [],
          coverImage: l.coverImage,
          metadata: l.metadata || {},
          rating: parseFloat(l.rating) || 0,
          reviewsCount: l.reviewsCount || 0,
          seasonalPricing,
          dbSeasonalPrices: seasonalPricesRaw.map((sp) => ({
            start_date: String(sp.startDate || sp.start_date || '').slice(0, 10),
            end_date: String(sp.endDate || sp.end_date || '').slice(0, 10),
            price_daily: parseFloat(sp.priceDaily ?? sp.price_daily) || 0,
            label: sp.label,
            season_type: sp.seasonType || sp.season_type,
          })),
          minStay: l.minBookingDays || 1,
          city: l.city,
          category_id: l.categoryId,
          categorySlug: l.category?.slug || null,
          maxCapacity: (() => {
            const raw = l.maxCapacity ?? l.max_capacity
            const n = parseInt(raw, 10)
            return Number.isFinite(n) && n > 0 ? n : null
          })(),
          cancellationPolicy: l.cancellationPolicy ?? l.cancellation_policy ?? 'moderate',
          partnerTrust: l.partnerTrust ?? null,
          catalog_flash_urgency: l.catalog_flash_urgency ?? null,
          catalog_flash_social_proof: l.catalog_flash_social_proof ?? null,
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
    }
  }, [listingId])

  useEffect(() => {
    setLanguage(detectLanguage())
    try {
      const stored = localStorage.getItem('gostaylo_currency')
      if (stored) setCurrency(stored)
    } catch {
      /* ignore */
    }
    loadListing()
    loadReviews()
    fetchExchangeRates().then(setExchangeRates).catch(() => {})
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
      addToRecent({
        id: listing.id,
        title: listing.title,
        district: listing.district,
        coverImage: listing.coverImage,
        basePriceThb: listing.basePriceThb,
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
    language,
    setLanguage,
    currency,
    setCurrency,
    exchangeRates,
    setExchangeRates,
    isFavorite,
    favoriteLoading,
    handleFavoriteClick,
  }
}
