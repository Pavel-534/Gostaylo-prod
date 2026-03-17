/**
 * ListingSidebar Component  
 * Extracted from /app/app/listings/page.js
 * Handles listings grid with infinite scroll
 */

'use client';

import { memo } from 'react';
import { GostayloListingCard } from '@/components/gostaylo-listing-card';
import { ListingGridSkeleton } from '@/components/listing-card-skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Loader2, List as ListIcon, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function ListingSidebarComponent({
  listings = [],
  loading = false,
  error = null,
  hasMore = false,
  loadingMore = false,
  isTransitioning = false,
  language = 'en',
  currency = 'THB',
  exchangeRates = {},
  userFavorites = new Set(),
  cardDates = {},
  guests = '1',
  showMap = false,
  onFavorite,
  onLoadMore,
  onRetry,
  onToggleMap,
  meta,
  loadMoreRef,
  allListings = [],
  displayedCount = 0
}) {
  
  // Error State
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-700 mb-2">
          {language === 'ru' ? 'Ошибка загрузки' : 'Loading Error'}
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={onRetry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === 'ru' ? 'Повторить' : 'Retry'}
        </Button>
      </div>
    );
  }
  
  // Loading State
  if (loading && !error) {
    return <ListingGridSkeleton count={8} />;
  }
  
  // Empty State
  if (!error && listings.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🏠</div>
        <h3 className="text-xl font-semibold mb-2">
          {language === 'ru' ? 'Ничего не найдено' : 'No results found'}
        </h3>
        <p className="text-slate-500 mb-4">
          {meta?.filteredOutByAvailability > 0 
            ? (language === 'ru' 
                ? `${meta.filteredOutByAvailability} объектов недоступны на выбранные даты`
                : `${meta.filteredOutByAvailability} listings unavailable for selected dates`)
            : (language === 'ru' ? 'Попробуйте изменить фильтры' : 'Try changing your filters')}
        </p>
      </div>
    );
  }
  
  return (
    <>
      {/* Mobile Map Toggle */}
      <div className="lg:hidden mb-4 flex justify-end">
        <Button
          onClick={onToggleMap}
          variant="outline"
          className="gap-2"
        >
          {showMap ? (
            <>
              <ListIcon className="h-4 w-4" />
              {language === 'ru' ? 'Показать список' : 'Show List'}
            </>
          ) : (
            <>
              <MapIcon className="h-4 w-4" />
              {language === 'ru' ? 'Показать карту' : 'Show Map'}
            </>
          )}
        </Button>
      </div>
      
      {/* Listings Grid */}
      <div className={cn(
        "flex-1",
        showMap && "hidden lg:block"
      )}>
        <div 
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 transition-opacity duration-200",
            isTransitioning ? "opacity-50" : "opacity-100"
          )}
        >
          {listings.map((listing, index) => (
            <div
              key={listing.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
            >
              <GostayloListingCard 
                listing={listing}
                initialDates={cardDates}
                guests={guests}
                language={language}
                currency={currency}
                exchangeRates={exchangeRates}
                onFavorite={onFavorite}
                isFavorited={userFavorites.has(listing.id)}
              />
            </div>
          ))}
        </div>

        {/* Load More / Infinite Scroll Trigger */}
        {hasMore && (
          <div 
            ref={loadMoreRef}
            className="flex justify-center py-8"
          >
            {loadingMore ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{language === 'ru' ? 'Загрузка...' : 'Loading more...'}</span>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={onLoadMore}
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                {language === 'ru' ? 'Показать ещё' : 'Load more'} ({allListings.length - displayedCount} {language === 'ru' ? 'ещё' : 'more'})
              </Button>
            )}
          </div>
        )}

        {/* Results Info */}
        {!hasMore && listings.length > 0 && (
          <div className="text-center py-6 text-slate-400 text-sm">
            {language === 'ru' 
              ? `Показано ${listings.length} из ${allListings.length} объектов`
              : `Showing ${listings.length} of ${allListings.length} properties`}
          </div>
        )}
      </div>
    </>
  );
}

// Memoize to prevent unnecessary re-renders
export const ListingSidebar = memo(ListingSidebarComponent);
