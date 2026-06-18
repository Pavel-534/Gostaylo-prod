/**
 * SearchMapWrapper — Leaflet map (~40% width on lg), price pills, viewport bounds callback.
 * Stage 163.1 — map-pins API + lazy popup.
 */

'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { boundsParamsReady } from '@/lib/catalog/build-catalog-search-params';
import { useMapPinsFetch } from '@/lib/hooks/useMapPinsFetch';

const InteractiveSearchMap = dynamic(
  () => import('@/components/listing/InteractiveSearchMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 animate-pulse rounded-lg flex items-center justify-center">
        <span className="text-slate-400">Loading map...</span>
      </div>
    ),
  }
);

function SearchMapWrapperComponent({
  listings = [],
  /** @type {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams> | null} */
  searchKeyParams = null,
  appliedBbox = null,
  userBookings = [],
  userId = null,
  language = 'ru',
  showMap = false,
  className,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  /** @type {{ checkIn?: string|null, checkOut?: string|null, checkInTime?: string|null, checkOutTime?: string|null } | null} */
  initialDates = null,
  selectedListingId = null,
  onListingMarkerClick,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
}) {
  const [viewportBbox, setViewportBbox] = useState(null);

  const mapQueryBounds = appliedBbox ?? viewportBbox;
  const boundsReady = boundsParamsReady(mapQueryBounds);

  const mapPinsKeyParams = useMemo(() => {
    if (!searchKeyParams || !boundsReady) return null;
    return { ...searchKeyParams, bounds: mapQueryBounds, limit: '500' };
  }, [searchKeyParams, mapQueryBounds, boundsReady]);

  const { mode, pins, clusters, isLoading } = useMapPinsFetch(mapPinsKeyParams, {
    enabled: showMap && boundsReady,
  });

  const mapPinsUseApi = boundsReady && !isLoading;

  const handleViewportBbox = useCallback((bbox) => {
    if (appliedBbox) return;
    setViewportBbox(bbox);
  }, [appliedBbox]);

  return (
    <div
      className={cn(
        'w-full min-w-0 lg:w-[40%] lg:max-w-[40%] lg:flex-shrink-0 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]',
        !showMap && 'hidden lg:block',
        className
      )}
    >
      <div className="h-[500px] lg:h-full rounded-lg overflow-hidden border border-slate-200 shadow-lg">
        <InteractiveSearchMap
          listings={listings}
          mapPins={pins}
          mapClusters={clusters}
          mapMode={mode}
          mapPinsUseApi={mapPinsUseApi}
          onViewportBbox={handleViewportBbox}
          userBookings={userBookings}
          userId={userId}
          language={language}
          center={[7.8804, 98.3923]}
          zoom={12}
          currency={currency}
          exchangeRates={exchangeRates}
          initialDates={initialDates}
          selectedListingId={selectedListingId}
          onListingMarkerClick={onListingMarkerClick}
          onSearchThisArea={onSearchThisArea}
          mapBoundsLocked={mapBoundsLocked}
          onClearMapBounds={onClearMapBounds}
          appliedBboxKey={appliedBboxKey}
          mapFitResetKey={mapFitResetKey}
        />
      </div>
    </div>
  );
}

export const SearchMapWrapper = memo(SearchMapWrapperComponent);
