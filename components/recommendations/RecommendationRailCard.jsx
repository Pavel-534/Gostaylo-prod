'use client'

/**
 * Stage 170.9 — compact rail card SSOT («Недавно смотрели», discovery rails).
 * Минимум: фото, название, категория, цена — без specs/trust/location дублей.
 */

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getListingText, getCategoryName } from '@/lib/translations'
import { getCategoryDisplayName } from '@/lib/category-display-name'
import { getListingCardImageUrls } from '@/lib/listing-display-images'
import { getListingCardBlurDataURL } from '@/lib/listing-image-blur'
import { mapPublicImageUrls, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'

const PLACEHOLDER = '/placeholder.svg'

function resolveCategoryLabel(listing, language) {
  const joined = listing?.categories || listing?.category
  const fromJoin = getCategoryDisplayName(joined, language)
  if (fromJoin) return fromJoin

  const slug =
    listing?.categorySlug ||
    joined?.slug ||
    listing?.property_type ||
    listing?.metadata?.property_type ||
    ''

  return getCategoryName(String(slug || 'property'), language)
}

export function RecommendationRailCard({
  listing,
  language = 'ru',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  href,
  className,
  onNavigate,
}) {
  const id = String(listing?.id || '').trim()
  if (!id) return null

  const title = getListingText(listing, 'title', language) || listing?.title || ''
  const categoryLabel = resolveCategoryLabel(listing, language)
  const images = mapPublicImageUrls(getListingCardImageUrls(listing))
  const cover = images[0] || PLACEHOLDER
  const unoptimized = isRemoteHttpImageSrc(cover)
  const detailUrl = href || `/listings/${id}`
  const categorySlug =
    listing?.categorySlug || listing?.category?.slug || listing?.categories?.slug || ''

  const listingForPrice = {
    ...listing,
    basePriceThb: listing.basePriceThb ?? listing.base_price_thb,
    guestDisplayPriceThb: listing.guestDisplayPriceThb ?? listing.guest_display_price_thb,
  }

  return (
    <article
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white',
        'shadow-sm transition-shadow duration-200 hover:shadow-md',
        'dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
    >
      <Link
        href={detailUrl}
        className="flex h-full min-h-0 flex-col"
        onClick={() => onNavigate?.()}
      >
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 160px, 180px"
            className="object-cover"
            placeholder="blur"
            blurDataURL={getListingCardBlurDataURL(listing) || LISTING_CARD_BLUR_DATA_URL}
            unoptimized={unoptimized}
          />
        </div>

        <div className="flex min-h-[5.5rem] flex-1 flex-col gap-0.5 p-2.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {categoryLabel ? (
            <p className="line-clamp-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {categoryLabel}
            </p>
          ) : null}
          <div className="mt-auto pt-1 [&_.text-lg]:text-sm [&_.text-lg]:font-semibold [&_.text-sm]:text-[11px]">
            <CardPriceDisplay
              listing={listingForPrice}
              currency={currency}
              exchangeRates={exchangeRates}
              language={language}
              categorySlug={categorySlug}
            />
          </div>
        </div>
      </Link>
    </article>
  )
}
