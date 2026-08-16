'use client'

/**
 * Маркетинговое превью в Popup Leaflet (каталог / карта).
 * Stage 201.73 — компактная карточка; 201.74 — brand CTA contrast + client nav.
 */

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { ListingTrustVerifiedMiniBadge } from '@/components/listing/ListingTrustVerifiedMiniBadge'
import { getUIText } from '@/lib/translations'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import {
  navigateWithListingHeroTransition,
  prefetchListingPdp,
} from '@/lib/navigation/listing-hero-transition'

/** @param {object} props */
export function ListingPopupCard({
  listing,
  language = 'ru',
  isApproximateLocation,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onOpenDetails = null,
}) {
  const router = useRouter()
  const raw = listing.images?.[0] || listing.coverImage || listing.cover_image || '/placeholder.svg'
  const image = raw === '/placeholder.svg' ? raw : resolveImageThumbDisplayUrl(raw) || raw
  const rating = parseFloat(listing.rating || listing.avgRating || listing.average_rating || 0) || 0
  const reviewsCt = listing.reviewsCount ?? listing.reviews_count ?? 0
  const locHint = getUIText(
    isApproximateLocation ? 'mapListing_approximatePopup' : 'mapListing_exactPopup',
    language,
  )
  const categorySlug =
    listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''
  const listingId = String(listing?.id || '').trim()
  const href = listingId ? `/listings/${listingId}` : '#'

  const handleOpen = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!listingId) return
      if (typeof onOpenDetails === 'function') {
        onOpenDetails(listingId)
        return
      }
      prefetchListingPdp(router, listingId)
      navigateWithListingHeroTransition(() => router.push(href), listingId, href)
    },
    [href, listingId, onOpenDetails, router],
  )

  return (
    <div className="w-[220px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="relative h-28 w-full overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- Leaflet popup: avoid next/image layout in map pane */}
        <img src={image} alt={listing.title} className="h-full w-full object-cover" />
      </div>
      <div className="space-y-2 p-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900">
            {listing.title}
          </h3>
          <div className="shrink-0">
            <ListingTrustVerifiedMiniBadge listing={listing} language={language} compact />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-snug text-slate-500">
          {rating > 0 ? (
            <span className="inline-flex items-center gap-0.5 font-medium text-slate-700">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
              {rating.toFixed(1)}
              {reviewsCt > 0 ? (
                <span className="font-normal text-slate-500">({reviewsCt})</span>
              ) : null}
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {getUIText('newListing', language)}
            </span>
          )}
          <span className="truncate">{locHint}</span>
        </div>

        <div className="flex items-baseline justify-between gap-1 border-t border-slate-100 pt-2">
          <CardPriceDisplay
            listing={listing}
            pricing={listing.pricing}
            initialDates={initialDates || {}}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            categorySlug={categorySlug}
          />
        </div>

        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={handleOpen}
          className="h-9 w-full min-h-[36px] rounded-xl text-xs font-semibold !text-white hover:!text-white"
          data-testid="map-listing-popup-open"
        >
          {getUIText('viewDetails', language)}
        </Button>
      </div>
    </div>
  )
}
