'use client'

/**
 * CatalogSearchMapPanel — shared map body for desktop sidebar + mobile full-screen sheet.
 * Stage 169.3 — SSOT map instance props (pins, bbox, clusters).
 */

import { memo, useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { boundsParamsReady } from '@/lib/catalog/build-catalog-search-params'
import { quantizeMapBbox } from '@/lib/geo/quantize-map-bbox'
import { useMapPinsFetch } from '@/lib/hooks/useMapPinsFetch'

const InteractiveSearchMap = dynamic(
  () => import('@/components/listing/InteractiveSearchMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-100 animate-pulse">
        <span className="text-slate-400">Loading map...</span>
      </div>
    ),
  },
)

function CatalogSearchMapPanelComponent({
  listings = [],
  searchKeyParams = null,
  appliedBbox = null,
  userBookings = [],
  userId = null,
  language = 'ru',
  /** When false, skip map-pins fetch (sheet closed). */
  mapActive = true,
  className,
  mapShellClassName,
  layoutResetKey = 0,
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
  const [viewportBbox, setViewportBbox] = useState(null)

  const quantizedAppliedBbox = useMemo(
    () => (appliedBbox ? quantizeMapBbox(appliedBbox) : null),
    [appliedBbox],
  )

  const mapQueryBounds = quantizedAppliedBbox ?? viewportBbox
  const boundsReady = boundsParamsReady(mapQueryBounds)

  const mapPinsKeyParams = useMemo(() => {
    if (!searchKeyParams || !boundsReady || !mapQueryBounds) return null
    return { ...searchKeyParams, bounds: mapQueryBounds, limit: '500' }
  }, [searchKeyParams, mapQueryBounds, boundsReady])

  const { mode, pins, clusters } = useMapPinsFetch(mapPinsKeyParams, {
    enabled: mapActive && boundsReady,
  })

  /** Bbox ready → merge API pins with catalog listings (sidebar SSOT); no flip on isLoading. */
  const mapPinsUseApi = boundsReady

  const handleViewportBbox = useCallback(
    (bbox) => {
      if (appliedBbox) return
      const quantized = quantizeMapBbox(bbox)
      if (!quantized) return
      setViewportBbox((prev) => {
        if (
          prev &&
          prev.south === quantized.south &&
          prev.north === quantized.north &&
          prev.west === quantized.west &&
          prev.east === quantized.east
        ) {
          return prev
        }
        return quantized
      })
    },
    [appliedBbox],
  )

  return (
    <div className={cn('h-full w-full min-h-0', className)}>
      <div
        className={cn(
          'h-full overflow-hidden border border-slate-200 shadow-lg',
          mapShellClassName,
        )}
      >
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
          layoutResetKey={layoutResetKey}
        />
      </div>
    </div>
  )
}

export const CatalogSearchMapPanel = memo(CatalogSearchMapPanelComponent)
