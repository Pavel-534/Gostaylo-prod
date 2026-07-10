'use client'

/**
 * Mobile search FAB — scroll-triggered pill above bottom nav (ADR-100 / ADR-101).
 * Shared by home `/` and catalog `/listings` (<md only).
 */

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { PUBLIC_SEARCH_CHROME_FAB_SCROLL_PX } from '@/lib/search/public-search-chrome-constants'
import { cn } from '@/lib/utils'

export function MobileSearchFAB({ onClick, language = 'ru', hasActiveFilters = false, hidden = false }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > PUBLIC_SEARCH_CHROME_FAB_SCROLL_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shown = visible && !hidden

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={getUIText('findButton', language)}
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      data-testid="mobile-search-fab"
      className={cn(
        'fixed app-fixed-above-bottom-nav left-1/2 z-30 -translate-x-1/2',
        'flex items-center gap-2 rounded-full bg-brand px-5 py-3',
        'text-sm font-semibold text-white',
        'shadow-[0_10px_30px_rgba(0,102,102,0.45)]',
        'transition-all duration-300 ease-out will-change-transform',
        'active:scale-95',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 pointer-events-none',
        'md:hidden',
      )}
    >
      <Search className="h-4 w-4" />
      <span>{getUIText('findButton', language)}</span>
      {hasActiveFilters ? (
        <span className="ml-1 flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      ) : null}
    </button>
  )
}
