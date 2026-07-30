/**
 * Renter Favorites Page — saved listings.
 * Stage 199.4 — copy via getUIText (ru/en/zh/th).
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { ListingCard } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/listing-card-skeleton';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { StorefrontStateView } from '@/components/product/StorefrontStateView'
import { EmptyState } from '@/components/empty-state'
import { useSoftBack } from '@/hooks/use-soft-back'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'

export default function FavoritesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const softBack = useSoftBack('/listings')
  const { language } = useI18n()
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({ THB: 1 });

  useEffect(() => {
    fetch('/api/v2/exchange-rates', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.rateMap && typeof j.rateMap === 'object') {
          setExchangeRates({ THB: 1, ...j.rateMap });
        }
      })
      .catch(() => {});
  }, []);
  
  const fetchFavorites = async () => {
    if (!user?.id) {
      dispatchOptimisticNavPending('/')
      router.push('/');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/v2/favorites');
      const data = await res.json();
      
      if (data.success) {
        // Transform favorites to listing format
        const listings = data.favorites
          .filter(fav => fav.listings) // Only favorites with valid listings
          .map(fav => ({
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
            favoritedAt: fav.created_at
          }));
        
        setFavorites(listings);
      } else {
        setError(getUIText('renterFavorites_loadError', language));
      }
    } catch (err) {
      console.error('[FAVORITES PAGE] Error:', err);
      setError(getUIText('networkError', language));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchFavorites();
  }, [user]);
  
  const handleFavorite = async (listingId, newIsFavorite) => {
    if (!newIsFavorite) {
      // Remove from favorites
      try {
        const res = await fetch('/api/v2/favorites', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId })
        });
        
        if (res.ok) {
          // Remove from local state
          setFavorites(prev => prev.filter(f => f.id !== listingId));
        }
      } catch (error) {
        console.error('[FAVORITES] Remove error:', error);
      }
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white py-8">
        <div className="container mx-auto px-4">
          <Button
            variant="ghost"
            onClick={softBack}
            className="mb-4 min-h-11 text-white hover:bg-white/20 touch-manipulation active:scale-[0.99]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {getUIText('back', language)}
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 fill-white" />
            <h1 className="text-3xl font-bold">{getUIText('favorites', language)}</h1>
          </div>
          <p className="text-white/90">
            {loading
              ? getUIText('loading', language)
              : getUIText('renterFavorites_count', language, { count: favorites.length })}
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-8">
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
        
        {loading && !error ? (
          <ListingGridSkeleton count={6} />
        ) : null}
        
        {!loading && !error && favorites.length === 0 ? (
          <EmptyState
            language={language}
            title={getUIText('renterFavorites_emptyTitle', language)}
            hint={getUIText('renterFavorites_emptyHint', language)}
            ctaLabel={getUIText('browse', language)}
            ctaHref="/listings"
            variant="compact"
          />
        ) : null}
        
        {!loading && !error && favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                language={language}
                currency="THB"
                exchangeRates={exchangeRates}
                onFavorite={handleFavorite}
                isFavorited={true}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
