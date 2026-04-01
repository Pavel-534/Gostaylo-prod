/**
 * ListingSidebar Component  
 * Extracted from /app/app/listings/page.js
 * Handles listings grid with infinite scroll
 */

'use client';

import { memo, useEffect } from 'react';
import Link from 'next/link';
import { GostayloListingCard } from '@/components/gostaylo-listing-card';
import { ListingGridSkeleton } from '@/components/listing-card-skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Loader2, List as ListIcon, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUIText } from '@/lib/translations';
import { isTransportListingCategory } from '@/lib/listing-category-slug';

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
  displayedCount = 0,
  selectedCategory = 'all',
  filterWhere = 'all',
  transportBroadenHref = null,
  highlightedListingId = null,
}) {
  useEffect(() => {
    if (!highlightedListingId) return;
    const el = document.getElementById(`listing-card-${highlightedListingId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedListingId, listings]);

  // Error State
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-700 mb-2">
          {getUIText('loadError', language)}
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={onRetry} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
          <RefreshCw className="h-4 w-4 mr-2" />
          {getUIText('retry', language)}
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
    const unavailText = meta?.filteredOutByAvailability > 0
      ? `${meta.filteredOutByAvailability} ${getUIText('listingsUnavailable', language)}`
      : getUIText('tryChangingFilters', language);
    const transportMode = isTransportListingCategory(selectedCategory);
    const showBroaden =
      transportMode &&
      transportBroadenHref &&
      filterWhere &&
      filterWhere !== 'all';
    return (
      <div className="text-center py-20 px-2">
        <div className="text-6xl mb-4">{transportMode ? '🚗' : '🏠'}</div>
        <h3 className="text-xl font-semibold mb-2">
          {getUIText('noResults', language)}
        </h3>
        <p className="text-slate-500 mb-2 max-w-md mx-auto">{unavailText}</p>
        {meta?.availabilityFiltered && (
          <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto leading-relaxed">
            {getUIText('searchHint_availabilityDates', language)}
          </p>
        )}
        {transportMode && (
          <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto leading-relaxed">
            {getUIText('transportEmptyHint', language)}
          </p>
        )}
        {showBroaden && (
          <Button asChild variant="outline" className="border-teal-300 text-teal-800 hover:bg-teal-50">
            <Link href={transportBroadenHref}>{getUIText('transportBroadenCta', language)}</Link>
          </Button>
        )}
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
              {getUIText('showList', language)}
            </>
          ) : (
            <>
              <MapIcon className="h-4 w-4" />
              {getUIText('showMap', language)}
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
                isMapHighlighted={highlightedListingId === listing.id}
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
                <span>{getUIText('loadingMore', language)}</span>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={onLoadMore}
                className="border-teal-300 text-teal-700 hover:bg-teal-50"
              >
                {getUIText('loadMore', language)} ({allListings.length - displayedCount} {getUIText('more', language)})
              </Button>
            )}
          </div>
        )}

        {/* Results Info */}
        {!hasMore && listings.length > 0 && (
          <div className="text-center py-6 text-slate-400 text-sm">
            {getUIText('showingXofY', language).replace('{count}', listings.length).replace('{total}', allListings.length)}
          </div>
        )}
      </div>
    </>
  );
}

// Memoize to prevent unnecessary re-renders
export const ListingSidebar = memo(ListingSidebarComponent);
