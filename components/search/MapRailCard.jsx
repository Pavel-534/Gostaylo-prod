'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/currency'
import { getGuestDisplayPerNight } from '@/lib/pricing/guest-display-price'
import { getListingCardImageUrls } from '@/lib/media/image-delivery'
import { CATALOG_MAP_MOBILE_RAIL_CARD_HEIGHT } from '@/lib/maps/catalog-map-ux-policy'

/**
 * Lightweight map rail card — compact horizontal chip for docked mobile rail.
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
      style={{ height: `${CATALOG_MAP_MOBILE_RAIL_CARD_HEIGHT}px` }}
      className={cn(
        'group flex min-h-11 w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all',
        active
          ? 'border-brand ring-2 ring-brand/20 shadow-md'
          : 'border-slate-200 hover:border-slate-300',
        className,
      )}
      data-listing-id={listing?.id}
      aria-label={title}
    >
      <div className="relative h-full w-[76px] shrink-0 overflow-hidden bg-slate-100">
        <Image
          src={imageSrc}
          alt={title}
          fill
          sizes="76px"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <h4 className="line-clamp-1 text-xs font-semibold text-slate-900">{title}</h4>
          {rating > 0 ? (
            <div className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-700">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </div>
          ) : null}
        </div>

        {district ? <p className="line-clamp-1 text-[11px] text-slate-500">{district}</p> : null}

        <p className="text-xs font-semibold text-slate-900">{priceText}</p>
      </div>
    </button>
  )
}

export default MapRailCard
