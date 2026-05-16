'use client'

/**
 * Маркетинговое превью в Popup Leaflet (каталог / карта).
 * Stage 87.1 + 88.0 — доверие у заголовка; CTA **`emerald-600`** для контраста.
 */

import { Star } from 'lucide-react'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { ListingTrustVerifiedMiniBadge } from '@/components/listing/ListingTrustVerifiedMiniBadge'
import { getUIText } from '@/lib/translations'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { resolveListingGuestDisplayPriceThb } from '@/lib/pricing/catalog-guest-display-price'

/** @param {object} props */
export function ListingPopupCard({
  listing,
  language = 'ru',
  isApproximateLocation,
  initialDates = null,
  currency = 'THB',
  exchangeRates = { THB: 1 },
}) {
  const raw = listing.images?.[0] || listing.coverImage || listing.cover_image || '/placeholder.svg'
  const image = raw === '/placeholder.svg' ? raw : resolveImageThumbDisplayUrl(raw) || raw
  const rating = parseFloat(listing.rating || listing.avgRating || listing.average_rating || 0) || 0
  const reviewsCt = listing.reviewsCount ?? listing.reviews_count ?? 0
  const locHint = getUIText(
    isApproximateLocation ? 'mapListing_approximatePopup' : 'mapListing_exactPopup',
    language,
  )
  const basePrice = resolveListingGuestDisplayPriceThb(listing)
  const categorySlug =
    listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''

  return (
    <div className="w-64">
      <img src={image} alt={listing.title} className="h-32 w-full rounded-t-lg object-cover" />
      <div className="rounded-b-lg bg-white p-3">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900">
            {listing.title}
          </h3>
          <div className="shrink-0">
            <ListingTrustVerifiedMiniBadge listing={listing} language={language} compact />
          </div>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {rating > 0 ? (
            <>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden />
              <span className="text-xs font-medium text-slate-700">{rating.toFixed(1)}</span>
              {reviewsCt > 0 && <span className="text-xs text-slate-500">({reviewsCt})</span>}
            </>
          ) : (
            <span className="text-xs text-slate-400">{getUIText('newListing', language)}</span>
          )}
        </div>
        <p className="mb-2 text-[11px] leading-snug text-slate-500">{locHint}</p>
        <ListingCardSpecsRow
          listing={listing}
          language={language}
          compact
          className="mb-2"
          suppressTrustVerifiedMiniBadge
        />
        <div className="flex items-baseline justify-between gap-1 border-t border-slate-100 pt-2">
          <CardPriceDisplay
            basePrice={basePrice}
            pricing={listing.pricing}
            initialDates={initialDates || {}}
            currency={currency}
            exchangeRates={exchangeRates}
            language={language}
            categorySlug={categorySlug}
          />
        </div>
        <a
          href={`/listings/${listing.id}`}
          className="mt-2 block w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-center text-xs font-semibold text-white antialiased shadow-none transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {getUIText('viewDetails', language)}
        </a>
      </div>
    </div>
  )
}
