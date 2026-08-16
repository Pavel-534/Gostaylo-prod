'use client'

/**
 * Stage 201.40 / 201.60 — PDP favorite control only (back → AppHeader soft-back SSOT).
 * Fixed under the header so it stays in thumb/eye reach while scrolling.
 */

import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import {
  MOBILE_ACTION_FAB_BUTTON_CLASS,
  MOBILE_ACTION_FAB_STACK_CLASS,
  MOBILE_ACTION_FAB_TOP_UNDER_HEADER,
} from '@/lib/layout/mobile-action-fab'
import { cn } from '@/lib/utils'

export function ListingPageNav({ language, isFavorite, favoriteLoading, onFavorite }) {
  return (
    <div
      className={MOBILE_ACTION_FAB_STACK_CLASS}
      style={{ top: MOBILE_ACTION_FAB_TOP_UNDER_HEADER }}
      data-testid="listing-pdp-favorite-fab"
    >
      <Button
        variant="outline"
        size="icon"
        onClick={onFavorite}
        disabled={favoriteLoading}
        type="button"
        className={MOBILE_ACTION_FAB_BUTTON_CLASS}
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
