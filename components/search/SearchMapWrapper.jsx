/**
 * SearchMapWrapper — Leaflet map (~40% width on lg), price pills, viewport bounds callback.
 */

'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

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
  userBookings = [],
  userId = null,
  language = 'ru',
  showMap = false,
  className,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  selectedListingId = null,
  onListingMarkerClick,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
}) {
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
          userBookings={userBookings}
          userId={userId}
          language={language}
          center={[7.8804, 98.3923]}
          zoom={12}
          currency={currency}
          exchangeRates={exchangeRates}
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
