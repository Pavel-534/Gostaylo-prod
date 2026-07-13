/**
 * ListingSidebar Component  
 * Extracted from /app/app/listings/page.js
 * Handles listings grid with infinite scroll
 */

'use client';

import { memo, useEffect } from 'react';
import Link from 'next/link';
import { ListingCard } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/listing-card-skeleton';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Loader2, List as ListIcon, Map as MapIcon, CalendarX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUIText } from '@/lib/translations';
import { isTransportListingCategory } from '@/lib/listing-category-slug';
import { CatalogSortSelect } from '@/components/search/CatalogSortSelect';
import { resolveListingCardImagePriority } from '@/lib/media/image-delivery';
import { useNetworkQuality } from '@/hooks/use-network-quality';
import { useIsMobile } from '@/hooks/use-mobile';
import { LISTING_CATALOG_GRID_CLASSES } from '@/lib/listing/listing-card-layout'

function ListingSidebarComponent({
  listings = [],
  loading = false,
  aiSearchPending = false,
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
  /** Stage 169.3 — full-screen map sheet on mobile; list stays visible underneath. */
  mobileMapSheet = false,
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
  /** Marker click / explicit select — scroll list to card (not hover). */
  scrollToListingId = null,
  catalogCategories = null,
  onListingPointerEnter = null,
  onListingPointerLeave = null,
  onListingCardHover = null,
  onListingCardHoverEnd = null,
  onListingCardSelect = null,
  catalogSort = 'recommended',
  onCatalogSortChange = null,
  catalogSortDistanceAvailable = false,
}) {
  const networkQuality = useNetworkQuality()
  const isMobile = useIsMobile()

  /** Stage 179.2 — mobile: skeleton replaces list during refetch (no opacity flash / CLS). */
  const showMobileRefetchSkeleton =
    isMobile && !error && (loading || isTransitioning || aiSearchPending)

  const renderCatalogSkeleton = () => (
    <>
      {aiSearchPending ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm font-medium text-violet-900 shadow-sm">
          <span aria-hidden className="text-base">
            ✨
          </span>
          {getUIText('aiSearchLoadingBanner', language)}
        </div>
      ) : null}
      <ListingGridSkeleton mobile={isMobile} />
    </>
  )

  useEffect(() => {
    if (!scrollToListingId) return;
    const el = document.getElementById(`listing-card-${scrollToListingId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [scrollToListingId, listings]);

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
  
  // Loading / mobile refetch — skeleton grid (SSOT layout, no layout shift)
  if (showMobileRefetchSkeleton) {
    return renderCatalogSkeleton()
  }

  if (loading && !error) {
    return renderCatalogSkeleton()
  }
  
  // ── Soft Fallback Banner ──────────────────────────────────────────────────────
  // Показывается над карточками когда сработал автоматический fallback-поиск.
  const isSoftFallback = meta?.isSoftFallback === true && listings.length > 0

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
      <EmptyState
        language={language}
        hint={unavailText}
        ctaLabel={getUIText('noResults', language) && (language === 'ru' ? 'Показать все объекты' : 'Show all listings')}
        ctaHref="/listings"
      >
        {(meta?.availabilityFiltered || transportMode || showBroaden) && (
          <div className="flex flex-col items-center gap-3 text-center">
            {meta?.availabilityFiltered && (
              <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                {getUIText('searchHint_availabilityDates', language)}
              </p>
            )}
            {transportMode && (
              <p className="text-sm text-slate-600 max-w-md leading-relaxed">
                {getUIText('transportEmptyHint', language)}
              </p>
            )}
            {showBroaden && (
              <Button asChild variant="outline" className="rounded-2xl border-brand/30 text-brand-hover hover:bg-brand/10">
                <Link href={transportBroadenHref}>{getUIText('transportBroadenCta', language)}</Link>
              </Button>
            )}
          </div>
        )}
      </EmptyState>
    );
  }
  
  return (
    <>
      {/* Mobile Map Toggle — hidden while full-screen sheet is open */}
      {!mobileMapSheet || !showMap ? (
        <div className="mb-4 flex justify-end lg:hidden">
          <Button
            onClick={onToggleMap}
            variant="outline"
            className="gap-2 rounded-2xl"
            data-testid="catalog-mobile-map-toggle"
          >
            {showMap && !mobileMapSheet ? (
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
      ) : null}

      {/* Soft Fallback Banner — показываем когда точный поиск дал 0, но есть похожие */}
      {isSoftFallback && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
          <CalendarX className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {language === 'ru'
                ? 'На выбранные даты нет свободных объектов'
                : language === 'zh'
                  ? '所选日期没有可用房源'
                  : language === 'th'
                    ? 'ไม่มีที่พักว่างสำหรับวันที่เลือก'
                    : 'No listings available for selected dates'}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              {language === 'ru'
                ? 'Показываем все объекты — уточните доступность напрямую у хозяина.'
                : language === 'zh'
                  ? '显示所有房源 — 请直接向房东确认可用性。'
                  : language === 'th'
                    ? 'แสดงที่พักทั้งหมด — กรุณาตรวจสอบความพร้อมกับเจ้าของโดยตรง'
                    : 'Showing all listings — please confirm availability with the host directly.'}
            </p>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      <div
        className={cn(
          'flex-1',
          showMap && !mobileMapSheet && 'hidden lg:block',
        )}
      >
        {onCatalogSortChange ? (
          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="text-sm text-slate-600">{getUIText('catalogSortLabel', language)}</span>
            <CatalogSortSelect
              value={catalogSort}
              onChange={onCatalogSortChange}
              language={language}
              distanceDisabled={!catalogSortDistanceAvailable}
            />
          </div>
        ) : null}
        <div 
          className={cn(
            LISTING_CATALOG_GRID_CLASSES,
            'transition-opacity duration-200',
            !isMobile && isTransitioning ? 'opacity-50' : 'opacity-100',
          )}
        >
          {listings.map((listing, index) => (
            <div
              key={listing.id}
              className="flex h-full flex-col animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
              onMouseEnter={() => {
                onListingPointerEnter?.(listing.id, { intent: 'hover' })
                onListingCardHover?.(listing.id)
              }}
              onMouseLeave={() => {
                onListingPointerLeave?.(listing.id)
                onListingCardHoverEnd?.(listing.id)
              }}
              onPointerDown={(e) => {
                if (e.pointerType === 'touch') {
                  onListingPointerEnter?.(listing.id, { intent: 'touch', listing })
                }
              }}
              onTouchStart={() => {
                onListingPointerEnter?.(listing.id, { intent: 'touch', listing })
              }}
              onPointerUp={(e) => {
                if (e.pointerType === 'touch') {
                  onListingPointerLeave?.(listing.id)
                }
              }}
              onTouchEnd={() => onListingPointerLeave?.(listing.id)}
              onTouchCancel={() => onListingPointerLeave?.(listing.id)}
              onClick={() => onListingCardSelect?.(listing.id)}
              role="presentation"
            >
              <ListingCard 
                listing={listing}
                initialDates={cardDates}
                guests={guests}
                language={language}
                currency={currency}
                exchangeRates={exchangeRates}
                onFavorite={onFavorite}
                isFavorited={userFavorites.has(listing.id)}
                isMapHighlighted={highlightedListingId === listing.id}
                catalogCategories={catalogCategories}
                imagePriority={resolveListingCardImagePriority({ cardIndex: index }, networkQuality)}
                className="h-full flex-1"
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
                className="border-brand/30 text-brand-hover hover:bg-brand/10"
              >
                {(() => {
                  const remaining = allListings.length - displayedCount
                  const label = getUIText('loadMore', language)
                  if (remaining <= 0) return label
                  return `${label} (${remaining} ${getUIText('more', language)})`
                })()}
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
