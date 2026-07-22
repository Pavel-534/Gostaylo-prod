'use client'

/**
 * CatalogMobileSearchSheet — unified mobile search editor (<md) for home + catalog.
 * Single-tab FilterBar / UnifiedSearchBar variant="filter"; SSOT filter state in parent.
 * Stage 179.0 — overview-only sheet (FAB / catalog summary); no programmatic nested picker opens.
 * Stage 190.6 — Where/Dates/Guests use accordion + `presentation="wizardStep"` (no nested drawers).
 */

import { useCallback, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { FilterBar } from '@/components/search/FilterBar'

/** Above sheet (`z-[120]`) and backdrop (`z-[110]`); matches WhereCombobox popover in overlays. */
export const CATALOG_MOBILE_SEARCH_SHEET_SELECT_Z = 'z-[220]'

export function CatalogMobileSearchSheet({
  open,
  onClose,
  language = 'ru',
  onSearchSubmit,
  filterBarProps = {},
  /** Sticky primary CTA at sheet bottom (<md). */
  showSubmitFooter = true,
}) {
  const sheetRef = useRef(null)

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

  const handleSearchSubmit = useCallback(() => {
    onSearchSubmit?.()
    onClose?.()
  }, [onSearchSubmit, onClose])

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[110] bg-slate-900/55 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden
        data-testid="catalog-mobile-search-backdrop"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={getUIText('findButton', language)}
        data-testid="catalog-mobile-search-sheet"
        className={cn(
          'fixed inset-x-0 bottom-0 z-[120] flex flex-col rounded-t-3xl bg-white md:hidden',
          'shadow-[0_-24px_64px_rgba(15,23,42,0.22)]',
          'transition-transform duration-300 ease-out will-change-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex justify-center pt-3 pb-1" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 pt-2 pb-2">
          <h2 className="text-base font-semibold text-slate-900">
            {getUIText('findButton', language)}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 h-11 w-11 rounded-full"
            onClick={onClose}
            aria-label="Close"
            data-testid="catalog-mobile-search-close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <FilterBar
            {...filterBarProps}
            mobileSheetEditor
            mobileSheetOpen={open}
            categorySelectPortalClassName={CATALOG_MOBILE_SEARCH_SHEET_SELECT_Z}
            shellWrapper={false}
            catalogHeadline={null}
            catalogSubline={null}
            catalogParentBlurb={null}
            onSearchSubmit={handleSearchSubmit}
          />
        </div>

        {showSubmitFooter ? (
          <div className="border-t border-slate-100 bg-white px-5 py-3.5 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] md:hidden">
            <Button
              type="button"
              variant="brand"
              className="h-12 w-full rounded-2xl text-base font-bold shadow-[0_10px_28px_rgba(0,102,102,0.32)]"
              onClick={handleSearchSubmit}
              data-testid="catalog-mobile-search-submit"
            >
              <Search className="mr-2 h-5 w-5" />
              {getUIText('findButton', language)}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}
