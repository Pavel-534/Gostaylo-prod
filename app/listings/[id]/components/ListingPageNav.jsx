'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Heart } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

export function ListingPageNav({ language, onBack, isFavorite, favoriteLoading, onFavorite }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Button variant="ghost" onClick={onBack} className="gap-2" type="button">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{getUIText('listingDetail_back', language)}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onFavorite}
          disabled={favoriteLoading}
          type="button"
          aria-label={isFavorite ? getUIText('listingDetail_favoriteRemove', language) : getUIText('listingDetail_favoriteAdd', language)}
        >
          <Heart className={cn('h-5 w-5', isFavorite && 'fill-red-500 text-red-500')} />
        </Button>
      </div>
    </header>
  )
}
