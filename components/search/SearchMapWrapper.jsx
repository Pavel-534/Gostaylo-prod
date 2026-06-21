/**
 * SearchMapWrapper — Leaflet map (~40% width on lg), price pills, viewport bounds callback.
 * Stage 163.1 — map-pins API + lazy popup.
 * Stage 169.3 — mobile inline map removed; use CatalogMobileMapSheet + CatalogSearchMapPanel.
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { CatalogSearchMapPanel } from '@/components/search/CatalogSearchMapPanel'

function SearchMapWrapperComponent({
  listings = [],
  searchKeyParams = null,
  appliedBbox = null,
  userBookings = [],
  userId = null,
  language = 'ru',
  className,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  initialDates = null,
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
        'w-full min-w-0 max-lg:hidden lg:block lg:w-[40%] lg:max-w-[40%] lg:flex-shrink-0 lg:sticky lg:app-sticky-below-public-chrome lg:app-catalog-map-panel',
        className,
      )}
    >
      <CatalogSearchMapPanel
        listings={listings}
        searchKeyParams={searchKeyParams}
        appliedBbox={appliedBbox}
        userBookings={userBookings}
        userId={userId}
        language={language}
        mapActive
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
        mapShellClassName="h-full rounded-lg"
      />
    </div>
  )
}

export const SearchMapWrapper = memo(SearchMapWrapperComponent)
