/**
 * Renter Favorites — saved listings.
 * Stage 201.33 — product chrome + header soft-back SSOT (no pink/red page back).
 * Stage 201.54 — UI currency SSOT + tighter workspace spacing (no min-h-screen void).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { ListingCard } from '@/components/listing-card'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { Heart } from 'lucide-react'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { getUIText } from '@/lib/translations'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

export default function FavoritesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      dispatchOptimisticNavPending('/')
      router.push('/')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/v2/favorites')
      const data = await res.json()

      if (data.success) {
        const listings = data.favorites
          .filter((fav) => fav.listings)
          .map((fav) => ({
            id: fav.listings.id,
            title: fav.listings.title,
            basePriceThb: fav.listings.base_price_thb,
            guestServiceFeePercent:
              fav.listings.guest_service_fee_percent ?? data.guestServiceFeePercent,
            guestDisplayPriceThb: getGuestDisplayPerNight({
              base_price_thb: fav.listings.base_price_thb,
              basePriceThb: parseFloat(fav.listings.base_price_thb) || 0,
              guest_display_price_thb: fav.listings.guest_display_price_thb,
              guestDisplayPriceThb: fav.listings.guest_display_price_thb,
              guestServiceFeePercent:
                fav.listings.guest_service_fee_percent ?? data.guestServiceFeePercent,
            }),
            images: fav.listings.images || [],
            coverImage: fav.listings.cover_image,
            district: fav.listings.district,
            rating: fav.listings.rating || 0,
            categoryId: fav.listings.category_id,
            status: fav.listings.status,
            favoriteId: fav.id,
            favoritedAt: fav.created_at,
          }))

        setFavorites(listings)
      } else {
        setError(getUIText('renterFavorites_loadError', language))
      }
    } catch (err) {
      console.error('[FAVORITES PAGE] Error:', err)
      setError(getUIText('networkError', language))
    } finally {
      setLoading(false)
    }
  }, [user?.id, language, router])

  useEffect(() => {
    void fetchFavorites()
  }, [fetchFavorites])

  const handleFavorite = async (listingId, newIsFavorite) => {
    if (!newIsFavorite) {
      try {
        const res = await fetch('/api/v2/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId }),
        })

        if (res.ok) {
          setFavorites((prev) => prev.filter((f) => f.id !== listingId))
        }
      } catch (error) {
        console.error('[FAVORITES] Remove error:', error)
      }
    }
  }

  const countLabel = loading
    ? getUIText('loading', language)
    : getUIText('renterFavorites_count', language, { count: favorites.length })

  return (
    <ProductPageShell
      className="min-h-0"
      containerClassName="px-0 py-2 sm:py-4 space-y-3 sm:space-y-4"
    >
      <PageSectionHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Heart className="h-7 w-7 text-brand" aria-hidden />
            {getUIText('favorites', language)}
          </span>
        }
        subtitle={countLabel}
      />

      {error ? (
        <StorefrontStateView
          variant="error"
          testId="renter-favorites-load-error"
          className="min-h-0 py-8"
          title={getUIText('loadError', language)}
          body={error}
          primaryLabel={getUIText('retry', language)}
          onPrimaryClick={() => void fetchFavorites()}
          secondaryLabel={getUIText('browse', language)}
          secondaryHref="/listings"
        />
      ) : null}

      {loading && !error ? <ListingGridSkeleton count={6} /> : null}

      {!loading && !error && favorites.length === 0 ? (
        <WorkspaceEmptyState
          icon={Heart}
          title={getUIText('renterFavorites_emptyTitle', language)}
          hint={getUIText('renterFavorites_emptyHint', language)}
          ctaLabel={getUIText('browse', language)}
          ctaHref="/listings"
        />
      ) : null}

      {!loading && !error && favorites.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {favorites.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              language={language}
              currency={currency}
              exchangeRates={exchangeRates}
              onFavorite={handleFavorite}
              isFavorited={true}
              layout="solo"
            />
          ))}
        </div>
      ) : null}
    </ProductPageShell>
  )
}
