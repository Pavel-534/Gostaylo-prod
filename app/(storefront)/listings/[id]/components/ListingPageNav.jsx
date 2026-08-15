'use client'

/**
 * Stage 201.40 — PDP favorite control only (back → AppHeader soft-back SSOT).
 * Fixed under the header so it stays in thumb/eye reach while scrolling.
 */

import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

export function ListingPageNav({ language, isFavorite, favoriteLoading, onFavorite }) {
  return (
    <div
      className="pointer-events-none fixed right-3 z-30 sm:right-6"
      style={{ top: 'calc(var(--app-header-height, 64px) + 0.5rem)' }}
      data-testid="listing-pdp-favorite-fab"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onFavorite}
        disabled={favoriteLoading}
        type="button"
        className={cn(
          'pointer-events-auto h-11 w-11 min-h-[44px] min-w-[44px] rounded-full',
          'border-slate-200 bg-white/95 shadow-md backdrop-blur-md',
          'touch-manipulation active:scale-[0.98]',
        )}
        aria-label={
          isFavorite
            ? getUIText('listingDetail_favoriteRemove', language)
            : getUIText('listingDetail_favoriteAdd', language)
        }
      >
        <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} aria-hidden />
      </Button>
    </div>
  )
}
