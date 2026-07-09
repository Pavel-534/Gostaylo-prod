'use client'

/**
 * CatalogMobileMapSheet — Airbnb-style full-screen map on mobile catalog (Stage 169.3).
 * Map fills viewport between top chrome and mobile bottom nav; swipe-down / buttons to close.
 */

import { useCallback, useEffect, useRef } from 'react'
import { ListIcon, MapIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { CatalogSearchMapPanel } from '@/components/search/CatalogSearchMapPanel'
import { CatalogMapCardRail } from '@/components/search/CatalogMapCardRail'

const SWIPE_CLOSE_THRESHOLD_PX = 72

export function CatalogMobileMapSheet({
  open,
  onClose,
  language = 'ru',
  mapPanelProps = {},
  railProps = {},
}) {
  const sheetRef = useRef(null)
  const touchStartYRef = useRef(null)

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
  const railListings = railProps.listings || mapPanelProps.listings || []

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
        className={cn(
          'fixed inset-x-0 app-fixed-below-header app-fixed-above-bottom-nav z-[90] flex flex-col bg-white md:hidden',
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
              className="h-9 w-9 rounded-full"
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
          />
          {railListings.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-[13] -translate-x-1/2 gap-2 rounded-full border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur-sm"
              onClick={onClose}
              data-testid="catalog-mobile-map-floating-list"
            >
              <ListIcon className="h-4 w-4" />
              {getUIText('showList', language)}
            </Button>
          ) : null}
        </div>

        {railListings.length > 0 ? (
          <div className="shrink-0 border-t border-slate-200 bg-white/95 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
            <CatalogMapCardRail
              listings={railListings}
              activeListingId={railProps.activeListingId ?? mapPanelProps.selectedListingId ?? null}
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
