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

const SWIPE_CLOSE_THRESHOLD_PX = 72

export function CatalogMobileMapSheet({
  open,
  onClose,
  language = 'ru',
  mapPanelProps = {},
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

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[34] bg-slate-900/40 backdrop-blur-[2px] md:hidden"
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
          'fixed inset-x-0 top-0 z-[35] flex flex-col bg-white md:hidden',
          'animate-in slide-in-from-bottom duration-300',
        )}
        style={{
          bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
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
        </div>
      </div>
    </>
  )
}
