'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Heart } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

export function ListingPageNav({ language, onBack, isFavorite, favoriteLoading, onFavorite }) {
  return (
    <header className="sticky app-sticky-below-header z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          onClick={onBack}
          className="h-11 min-h-11 min-w-11 shrink-0 gap-2 px-2 sm:min-w-0 sm:px-3"
          type="button"
          aria-label={getUIText('listingDetail_back', language)}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{getUIText('listingDetail_back', language)}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFavorite}
          disabled={favoriteLoading}
          type="button"
          className="h-11 w-11 min-h-11 min-w-11 shrink-0"
          aria-label={
            isFavorite
              ? getUIText('listingDetail_favoriteRemove', language)
              : getUIText('listingDetail_favoriteAdd', language)
          }
        >
          <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} />
        </Button>
      </div>
    </header>
  )
}
