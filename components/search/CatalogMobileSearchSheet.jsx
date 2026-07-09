'use client'

/**
 * CatalogMobileSearchSheet — mobile FAB companion for /listings (ADR-101 parity with home).
 * Reuses FilterBar fields inside a bottom sheet; SSOT filter state stays in listings-catalog-client.
 */

import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getUIText } from '@/lib/translations'
import { FilterBar } from '@/components/search/FilterBar'

export function CatalogMobileSearchSheet({
  open,
  onClose,
  language = 'ru',
  onSearchSubmit,
  filterBarProps = {},
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
            className="h-9 w-9 rounded-full"
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
            shellWrapper={false}
            catalogHeadline={null}
            catalogSubline={null}
            catalogParentBlurb={null}
            onSearchSubmit={handleSearchSubmit}
          />
        </div>
      </div>
    </>
  )
}
