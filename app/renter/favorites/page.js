/**
 * GoStayLo - Renter Favorites Page
 * Displays all listings the user has "hearted"
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { GostayloListingCard } from '@/components/gostaylo-listing-card';
import { ListingGridSkeleton } from '@/components/listing-card-skeleton';
import { Button } from '@/components/ui/button';
import { Heart, ArrowLeft, RefreshCw } from 'lucide-react';
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

export default function FavoritesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { language } = useI18n()
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchFavorites = async () => {
    if (!user?.id) {
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
        setError(language === 'ru' ? 'Не удалось загрузить избранное' : 'Failed to load favorites');
      }
    } catch (err) {
      console.error('[FAVORITES PAGE] Error:', err);
      setError(language === 'ru' ? 'Ошибка сети' : 'Network error');
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
            onClick={() => router.back()}
            className="text-white hover:bg-white/20 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ru' ? 'Назад' : 'Back'}
          </Button>
          
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 fill-white" />
            <h1 className="text-3xl font-bold">{getUIText('favorites', language)}</h1>
          </div>
          <p className="text-white/90">
            {loading
              ? getUIText('loading', language)
              : `${favorites.length} ${language === 'ru' ? 'избранных объектов' : 'favorites'}`}
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchFavorites} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {getUIText('retry', language)}
            </Button>
          </div>
        )}
        
        {/* Loading State */}
        {loading && !error && (
          <ListingGridSkeleton count={6} />
        )}
        
        {/* Empty State */}
        {!loading && !error && favorites.length === 0 && (
          <div className="text-center py-20">
            <Heart className="h-20 w-20 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-700 mb-2">
              {language === 'ru' ? 'Нет избранных объектов' : 'No favorites yet'}
            </h2>
            <p className="text-slate-500 mb-6">
              {language === 'ru'
                ? 'Добавляйте понравившиеся объекты в избранное, нажимая на ❤️'
                : 'Add listings to favorites by tapping ❤️'}
            </p>
            <Button onClick={() => router.push('/listings')}>
              {getUIText('browse', language)}
            </Button>
          </div>
        )}
        
        {/* Favorites Grid */}
        {!loading && !error && favorites.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map(listing => (
              <GostayloListingCard
                key={listing.id}
                listing={listing}
                language={language}
                currency="THB"
                exchangeRates={{ THB: 1, USD: 35.5, RUB: 0.37 }}
                onFavorite={handleFavorite}
                isFavorited={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
