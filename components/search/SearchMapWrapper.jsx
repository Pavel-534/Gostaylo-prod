/**
 * SearchMapWrapper — Leaflet map (~40% width on lg), price pills, viewport bounds callback.
 * Stage 163.1 — map-pins API + lazy popup.
 * Stage 169.3 — mobile inline map removed; use CatalogMobileMapSheet + CatalogSearchMapPanel.
 * Stage 201.96 — do not mount Leaflet below lg (CSS hide still initialized the map).
 * Stage 177.5.1 — optional polygon draw (desktop lg+ only).
 */

'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { CatalogSearchMapPanel } from '@/components/search/CatalogSearchMapPanel'
import { useMinWidthConfirmed, VIEWPORT_LG_MIN_PX } from '@/hooks/use-min-width'

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
  hoveredListingId = null,
  onListingMarkerClick,
  onListingOpen = null,
  onListingPopupOpen = null,
  onListingPopupClose = null,
  onMapBackgroundClick = null,
  onSearchThisArea,
  mapBoundsLocked = false,
  onClearMapBounds,
  appliedBboxKey = '',
  mapFitResetKey = '',
  mapCenter,
  mapZoom,
  enablePolygonDraw = false,
  appliedPolygon = null,
  onPolygonEncoded = null,
  onPolygonCleared = null,
}) {
  const isDesktopMap = useMinWidthConfirmed(VIEWPORT_LG_MIN_PX)
  if (!isDesktopMap) return null

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
        hoveredListingId={hoveredListingId}
        onListingMarkerClick={onListingMarkerClick}
        onListingOpen={onListingOpen}
        onListingPopupOpen={onListingPopupOpen}
        onListingPopupClose={onListingPopupClose}
        onMapBackgroundClick={onMapBackgroundClick}
        onSearchThisArea={onSearchThisArea}
        mapBoundsLocked={mapBoundsLocked}
        onClearMapBounds={onClearMapBounds}
        appliedBboxKey={appliedBboxKey}
        mapFitResetKey={mapFitResetKey}
        mapCenter={mapCenter}
        mapZoom={mapZoom}
        mapShellClassName="h-full rounded-lg"
        enablePolygonDraw={enablePolygonDraw}
        appliedPolygon={appliedPolygon}
        onPolygonEncoded={onPolygonEncoded}
        onPolygonCleared={onPolygonCleared}
      />
    </div>
  )
}

export const SearchMapWrapper = memo(SearchMapWrapperComponent)
