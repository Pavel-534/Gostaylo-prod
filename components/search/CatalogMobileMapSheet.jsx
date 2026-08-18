'use client'

/**
 * CatalogMobileMapSheet — full-height map on mobile catalog (Stage 169.3 / 201.49 / 201.79).
 * Rail listings follow map viewport pins (Airbnb-style), not the full search page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ListIcon, MapIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { CatalogSearchMapPanel } from '@/components/search/CatalogSearchMapPanel'
import { CatalogMapCardRail } from '@/components/search/CatalogMapCardRail'
import { useMobileDockLock } from '@/hooks/use-mobile-dock-lock'
import { MOBILE_CHROME_SAFE_PAD_BOTTOM } from '@/hooks/use-visual-viewport-frame'
import { filterCatalogRailListingsForMapViewport } from '@/lib/maps/catalog-map-rail-filter'
import {
  logCatalogMapRailJump,
  summarizeCatalogMapRailDebug,
} from '@/lib/maps/catalog-map-rail-debug'
import {
  rememberCatalogMapViewport,
} from '@/lib/navigation/catalog-map-viewport-memory'

const SWIPE_CLOSE_THRESHOLD_PX = 72
const VIEWPORT_RAIL_UPDATE_DEBOUNCE_MS = 160

export function CatalogMobileMapSheet({
  open,
  onClose,
  language = 'ru',
  mapPanelProps = {},
  railProps = {},
}) {
  const sheetRef = useRef(null)
  const touchStartYRef = useRef(null)
  const viewportUpdateTimerRef = useRef(null)
  const lastRailDebugRef = useRef(null)
  const [viewportMapData, setViewportMapData] = useState({
    pins: [],
    clusters: [],
    viewportBbox: null,
    boundsReady: false,
    mode: 'pins',
  })
  useMobileDockLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const handleTouchStart = useCallback((event) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null
  }, [])

  const handleTouchEnd = useCallback(
    (event) => {
      const startY = touchStartYRef.current
      const endY = event.changedTouches[0]?.clientY
      touchStartYRef.current = null
      if (startY == null || endY == null) return
      if (endY - startY > SWIPE_CLOSE_THRESHOLD_PX) onClose?.()
    },
    [onClose],
  )

  const handleViewportMapData = useCallback(
    (next) => {
      if (viewportUpdateTimerRef.current) {
        clearTimeout(viewportUpdateTimerRef.current)
      }
      viewportUpdateTimerRef.current = setTimeout(() => {
        setViewportMapData({
          pins: next?.pins || [],
          clusters: next?.clusters || [],
          viewportBbox: next?.viewportBbox || null,
          boundsReady: Boolean(next?.boundsReady),
          mode: next?.mode || 'pins',
        })
      }, VIEWPORT_RAIL_UPDATE_DEBOUNCE_MS)
      const bbox = next?.viewportBbox
      if (open && bbox) {
        rememberCatalogMapViewport({
          south: bbox.south,
          north: bbox.north,
          west: bbox.west,
          east: bbox.east,
          centerLat: bbox.centerLat,
          centerLng: bbox.centerLng,
          zoom: bbox.zoom,
          selectedListingId:
            railProps.activeListingId ?? mapPanelProps.selectedListingId ?? null,
        })
      }
    },
    [open, railProps.activeListingId, mapPanelProps.selectedListingId],
  )

  useEffect(
    () => () => {
      if (viewportUpdateTimerRef.current) clearTimeout(viewportUpdateTimerRef.current)
    },
    [],
  )

  const sourceListings = railProps.listings || mapPanelProps.listings || []
  const activeListingId = railProps.activeListingId ?? mapPanelProps.selectedListingId ?? null

  useEffect(() => {
    if (!open || !viewportMapData.viewportBbox) return
    const bbox = viewportMapData.viewportBbox
    rememberCatalogMapViewport({
      south: bbox.south,
      north: bbox.north,
      west: bbox.west,
      east: bbox.east,
      centerLat: bbox.centerLat,
      centerLng: bbox.centerLng,
      zoom: bbox.zoom,
      selectedListingId: activeListingId,
    })
  }, [open, activeListingId, viewportMapData.viewportBbox])

  const railListings = useMemo(
    () =>
      filterCatalogRailListingsForMapViewport(sourceListings, {
        pins: viewportMapData.pins,
        viewportBbox: viewportMapData.viewportBbox,
        selectedListingId: activeListingId,
      }),
    [sourceListings, viewportMapData.pins, viewportMapData.viewportBbox, activeListingId],
  )

  useEffect(() => {
    if (!open) return
    const next = summarizeCatalogMapRailDebug({
      railCount: railListings.length,
      pinCount: (viewportMapData.pins || []).length,
      clusterCount: (viewportMapData.clusters || []).length,
      sourceCount: sourceListings.length,
      boundsReady: viewportMapData.boundsReady,
      mode: viewportMapData.mode,
      selectedListingId: activeListingId,
    })
    logCatalogMapRailJump(next, lastRailDebugRef.current)
    lastRailDebugRef.current = next
  }, [
    open,
    railListings,
    viewportMapData.pins,
    viewportMapData.clusters,
    viewportMapData.boundsReady,
    viewportMapData.mode,
    sourceListings.length,
    activeListingId,
  ])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[85] bg-slate-900/40 backdrop-blur-[2px] md:hidden"
        onClick={onClose}
        aria-hidden
        data-testid="catalog-mobile-map-backdrop"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={getUIText('showMap', language)}
        data-testid="catalog-mobile-map-sheet"
        data-mobile-chrome="form"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[90] flex flex-col bg-white md:hidden',
          'top-[var(--app-header-height,64px)]',
          'animate-in slide-in-from-bottom duration-300',
        )}
      >
        <div
          className="flex shrink-0 flex-col border-b border-slate-200 bg-white/95 backdrop-blur-sm"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-center pt-2 pb-1" aria-hidden>
            <div className="h-1 w-12 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-2xl border-slate-200"
              onClick={onClose}
              data-testid="catalog-mobile-map-show-list"
            >
              <ListIcon className="h-4 w-4" />
              {getUIText('showList', language)}
            </Button>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <MapIcon className="h-4 w-4 text-brand" aria-hidden />
              {getUIText('showMap', language)}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={onClose}
              aria-label={getUIText('showList', language)}
              data-testid="catalog-mobile-map-close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <CatalogSearchMapPanel
            {...mapPanelProps}
            mapActive={open}
            layoutResetKey={open ? 1 : 0}
            mapShellClassName="h-full rounded-none border-0 shadow-none"
            onViewportMapData={handleViewportMapData}
          />
          {railListings.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="absolute bottom-4 left-1/2 z-[13] min-h-[44px] -translate-x-1/2 gap-2 rounded-full border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm"
              onClick={onClose}
              data-testid="catalog-mobile-map-floating-list"
            >
              <ListIcon className="h-4 w-4" />
              {getUIText('showList', language)}
            </Button>
          ) : null}
        </div>

        {railListings.length > 0 ? (
          <div
            className="shrink-0 border-t border-slate-200 bg-white/95 pt-1"
            style={{ paddingBottom: MOBILE_CHROME_SAFE_PAD_BOTTOM }}
          >
            <CatalogMapCardRail
              listings={railListings}
              activeListingId={activeListingId}
              onActiveListingChange={
                railProps.onActiveListingChange ?? mapPanelProps.onListingMarkerClick
              }
              onListingOpen={railProps.onListingOpen ?? mapPanelProps.onListingMarkerClick}
              language={railProps.language || language}
              currency={railProps.currency || mapPanelProps.currency || 'THB'}
              exchangeRates={railProps.exchangeRates || mapPanelProps.exchangeRates || { THB: 1 }}
            />
          </div>
        ) : null}
      </div>
    </>
  )
}
