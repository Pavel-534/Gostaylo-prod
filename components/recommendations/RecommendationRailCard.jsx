'use client'

/**
 * Stage 170.9 — compact rail card SSOT («Недавно смотрели», discovery rails).
 * Stage 200.15 — optimistic PDP entry (progress + prefetch + press).
 * Минимум: фото, название, рейтинг (если есть), категория, цена — без specs/trust/location дублей.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getListingText, getCategoryName } from '@/lib/translations'
import { getCategoryDisplayName } from '@/lib/category-display-name'
import { getListingCardImageUrls } from '@/lib/listing-display-images'
import { getListingCardBlurDataURL } from '@/lib/listing-image-blur'
import { mapPublicImageUrls, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { prefetchListingPdp, prepareListingPdpNavigation } from '@/lib/navigation/listing-hero-transition'
import { resolveRecommendationRailRating } from '@/lib/recommendations/recommendation-rail-rating'
import { Star } from 'lucide-react'

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
  const router = useRouter()
  const pathname = usePathname()
  const [pdpPending, setPdpPending] = useState(false)
  const id = String(listing?.id || '').trim()
  const detailUrl = href || (id ? `/listings/${id}` : '#')

  const title = getListingText(listing, 'title', language) || listing?.title || ''
  const categoryLabel = resolveCategoryLabel(listing, language)
  const { rating, show: showRating } = resolveRecommendationRailRating(listing)
  const images = useMemo(
    () => mapPublicImageUrls(getListingCardImageUrls(listing || {})),
    [listing],
  )
  const cover = images[0] || PLACEHOLDER
  const unoptimized = isRemoteHttpImageSrc(cover)
  const categorySlug =
    listing?.categorySlug || listing?.category?.slug || listing?.categories?.slug || ''

  const listingForPrice = {
    ...listing,
    basePriceThb: listing?.basePriceThb ?? listing?.base_price_thb,
    guestDisplayPriceThb: listing?.guestDisplayPriceThb ?? listing?.guest_display_price_thb,
  }

  const handlePrefetch = useCallback(() => {
    if (!id) return
    prefetchListingPdp(router, id)
  }, [id, router])

  useEffect(() => {
    setPdpPending(false)
  }, [pathname])

  const handleNavigate = useCallback(
    (e) => {
      if (!id || detailUrl === '#') return
      if (e?.metaKey || e?.ctrlKey || e?.shiftKey || e?.altKey) return
      setPdpPending(true)
      prepareListingPdpNavigation(detailUrl)
      onNavigate?.()
    },
    [detailUrl, id, onNavigate],
  )

  if (!id) return null

  return (
    <article
      data-pdp-pending={pdpPending ? 'true' : undefined}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white',
        'shadow-sm transition-shadow duration-200 hover:shadow-md touch-manipulation',
        'active:scale-[0.99]',
        pdpPending && 'opacity-90 ring-2 ring-brand/30',
        'dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
    >
      <Link
        href={detailUrl}
        className="flex h-full min-h-0 flex-col"
        onClick={handleNavigate}
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
          <div className="flex items-start justify-between gap-1.5">
            <h3 className="line-clamp-2 min-w-0 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {showRating ? (
              <div className="flex shrink-0 items-center gap-0.5 pt-0.5" aria-label={rating.toFixed(1)}>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                <span className="text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  {rating.toFixed(1)}
                </span>
              </div>
            ) : null}
          </div>
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
