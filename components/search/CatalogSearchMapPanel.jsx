'use client'

/**
 * CatalogSearchMapPanel — shared map body for desktop sidebar + mobile full-screen sheet.
 * Stage 169.3 — SSOT map instance props (pins, bbox, clusters).
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { boundsParamsReady } from '@/lib/catalog/build-catalog-search-params'
import { quantizeMapBbox } from '@/lib/geo/quantize-map-bbox'
import { useMapPinsFetch } from '@/lib/hooks/useMapPinsFetch'
import { rememberCatalogMapViewport } from '@/lib/navigation/catalog-map-viewport-memory'

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
  selectionPanMode,
  /** Stage 200.37 — from geo_locations centroid (default SEA). */
  mapCenter = [20, 100],
  mapZoom = 6,
  /** Stage 201.79 — notify parent of viewport pins (mobile rail filter). */
  onViewportMapData = null,
  /** Stage 201.81 — soft-back map camera. */
  cameraRestoreBbox = null,
  onCameraRestoreDone = null,
  /** Stage 201.84 — parent lock so remount does not world-fit. */
  holdSoftBackCamera = false,
  /** Stage 177.5.1 — false on CatalogMobileMapSheet. */
  enablePolygonDraw = false,
  appliedPolygon = null,
  onPolygonEncoded = null,
  onPolygonCleared = null,
}) {
  const [viewportBbox, setViewportBbox] = useState(null)
  /** Live center/zoom for soft-back (not quantized away). */
  const [liveCamera, setLiveCamera] = useState(null)

  const quantizedAppliedBbox = useMemo(
    () => (appliedBbox ? quantizeMapBbox(appliedBbox) : null),
    [appliedBbox],
  )

  const hasPolygon = Boolean(appliedPolygon || searchKeyParams?.polygon)
  const mapQueryBounds = quantizedAppliedBbox ?? viewportBbox
  const boundsReady = hasPolygon || boundsParamsReady(mapQueryBounds)

  const mapPinsKeyParams = useMemo(() => {
    if (!searchKeyParams) return null
    if (hasPolygon) {
      return {
        ...searchKeyParams,
        polygon: appliedPolygon || searchKeyParams.polygon,
        bounds: null,
        limit: '500',
      }
    }
    if (!boundsParamsReady(mapQueryBounds)) return null
    return { ...searchKeyParams, bounds: mapQueryBounds, limit: '500' }
  }, [searchKeyParams, mapQueryBounds, hasPolygon, appliedPolygon])

  const { mode, pins, clusters } = useMapPinsFetch(mapPinsKeyParams, {
    enabled: mapActive && boundsReady,
  })

  /** Bbox/polygon ready → merge API pins with catalog listings (sidebar SSOT); no flip on isLoading. */
  const mapPinsUseApi = boundsReady

  const viewportForParent = useMemo(() => {
    if (!mapQueryBounds) return null
    return {
      ...mapQueryBounds,
      centerLat: liveCamera?.centerLat ?? null,
      centerLng: liveCamera?.centerLng ?? null,
      zoom: liveCamera?.zoom ?? null,
    }
  }, [mapQueryBounds, liveCamera])

  useEffect(() => {
    if (typeof onViewportMapData !== 'function') return
    onViewportMapData({
      mode,
      pins: pins || [],
      clusters: clusters || [],
      viewportBbox: viewportForParent,
      boundsReady,
    })
  }, [onViewportMapData, mode, pins, clusters, viewportForParent, boundsReady])

  /**
   * Stage 202.5 — persist camera for desktop + mobile soft-back (session SSOT).
   * Mobile sheet also remembers; duplicate writes are identical and safe for PWA.
   */
  useEffect(() => {
    if (!mapActive || !viewportForParent || !boundsReady) return
    rememberCatalogMapViewport({
      south: viewportForParent.south,
      north: viewportForParent.north,
      west: viewportForParent.west,
      east: viewportForParent.east,
      centerLat: viewportForParent.centerLat,
      centerLng: viewportForParent.centerLng,
      zoom: viewportForParent.zoom,
      selectedListingId: selectedListingId || null,
    })
  }, [mapActive, boundsReady, viewportForParent, selectedListingId])

  const handleViewportBbox = useCallback(
    (bbox) => {
      if (bbox && Number.isFinite(Number(bbox.centerLat)) && Number.isFinite(Number(bbox.centerLng))) {
        setLiveCamera({
          centerLat: Number(bbox.centerLat),
          centerLng: Number(bbox.centerLng),
          zoom: Number.isFinite(Number(bbox.zoom)) ? Number(bbox.zoom) : null,
        })
      }
      if (appliedBbox || hasPolygon) return
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
    [appliedBbox, hasPolygon],
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
          center={mapCenter}
          zoom={mapZoom}
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
          layoutResetKey={layoutResetKey}
          selectionPanMode={selectionPanMode}
          cameraRestoreBbox={cameraRestoreBbox}
          onCameraRestoreDone={onCameraRestoreDone}
          holdSoftBackCamera={holdSoftBackCamera}
          enablePolygonDraw={enablePolygonDraw}
          appliedPolygon={appliedPolygon || searchKeyParams?.polygon || null}
          onPolygonEncoded={onPolygonEncoded}
          onPolygonCleared={onPolygonCleared}
        />
      </div>
    </div>
  )
}

export const CatalogSearchMapPanel = memo(CatalogSearchMapPanelComponent)
