'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/currency'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { getListingCardImageUrls } from '@/lib/media/image-delivery'

/**
 * Lightweight map rail card (no inner carousel) for smooth swipe performance.
 */
export function MapRailCard({
  listing,
  active = false,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onOpen,
  className,
}) {
  const imageUrls = useMemo(() => getListingCardImageUrls(listing), [listing])
  const imageSrc = imageUrls[0] || '/placeholder.svg'
  const title = String(listing?.title || 'Untitled listing')
  const district = String(listing?.district || '')

  const ratingRaw =
    listing?.avgRating ?? listing?.average_rating ?? listing?.rating ?? 0
  const rating = Number.parseFloat(ratingRaw) || 0

  const priceThb = getGuestDisplayPerNight(listing)
  const priceText = formatPrice(priceThb, currency, exchangeRates, language)

  return (
    <button
      type="button"
      onClick={() => onOpen?.(listing)}
      className={cn(
        'group flex min-h-11 w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all',
        active
          ? 'border-brand ring-2 ring-brand/20 shadow-md'
          : 'border-slate-200 hover:border-slate-300',
        className,
      )}
      data-listing-id={listing?.id}
      aria-label={title}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <Image
          src={imageSrc}
          alt={title}
          fill
          sizes="280px"
          className="object-cover"
        />
      </div>

      <div className="flex min-h-[78px] flex-col gap-1.5 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-1 text-sm font-semibold text-slate-900">{title}</h4>
          {rating > 0 ? (
            <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-700">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {district ? <p className="line-clamp-1 text-xs text-slate-500">{district}</p> : null}

        <div className="mt-auto flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">{priceText}</p>
        </div>
      </div>
    </button>
  )
}

export default MapRailCard
