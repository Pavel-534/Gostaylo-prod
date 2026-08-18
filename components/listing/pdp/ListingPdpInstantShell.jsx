'use client'

/**
 * Instant PDP chrome from TanStack cache (catalog card / detail prefetch).
 * Shown while the listing RSC bootstrap streams (Stage 201.101).
 */

import { useMemo } from 'react'
import Image from 'next/image'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { ListingPageSkeleton } from '@/app/(storefront)/listings/[id]/components/ListingPageSkeleton'
import { readPdpInstantListing } from '@/lib/listing/read-pdp-instant-listing'
import { getListingCardImageUrls } from '@/lib/media/image-delivery'
import { getListingText, getUIText } from '@/lib/translations'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { isRemoteHttpImageSrc, mapPublicImageUrls } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'

/**
 * @param {{ listingId: string }} props
 */
export function ListingPdpInstantShell({ listingId }) {
  const queryClient = useQueryClient()
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const listing = readPdpInstantListing(queryClient, listingId)

  const cover = useMemo(() => {
    if (!listing) return null
    const urls = mapPublicImageUrls(getListingCardImageUrls(listing))
    return urls[0] || listing.coverImage || listing.cover_image || null
  }, [listing])

  if (!listing) return <ListingPageSkeleton />

  const title = getListingText(listing, 'title', language) || listing.title || ''
  const unoptimized = isRemoteHttpImageSrc(cover)

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      data-testid="listing-pdp-instant-shell"
    >
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative aspect-[5/4] max-h-[min(48dvh,20rem)] w-full overflow-hidden rounded-2xl bg-slate-100 sm:aspect-[4/3] sm:max-h-none">
          {cover ? (
            <Image
              src={cover}
              alt={title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={LISTING_CARD_BLUR_DATA_URL}
              unoptimized={unoptimized}
            />
          ) : null}
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <div className="mt-6 flex items-end justify-between gap-4">
          <CardPriceDisplay
            listing={listing}
            language={language}
            currency={currency}
            exchangeRates={exchangeRates}
          />
          <Button type="button" variant="brand" className="min-h-[44px] min-w-[44px] shrink-0" disabled>
            {getUIText('bookNow', language)}
          </Button>
        </div>
      </main>
    </div>
  )
}
