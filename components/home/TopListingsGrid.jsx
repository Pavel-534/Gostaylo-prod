'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Loader2, CalendarX, Flame } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getUIText, getListingText } from '@/lib/translations'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { EmptyState } from '@/components/empty-state'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { resolveImageThumbDisplayUrl } from '@/lib/image-display-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { format, isSameDay } from 'date-fns'
import { formatDisplayDate } from '@/lib/date-display-format'
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'

export function TopListingsGrid({
  language,
  dateRange,
  guests,
  checkInTime,
  checkOutTime,
  listings,
  loading,
  listingsLoading,
  aiGridPending,
  exchangeRates,
  currency,
  mediaFallback,
  markMediaFailed,
  onViewAll,
  customTitle = null,
}) {
  const cleanCustomTitle = typeof customTitle === 'string' ? customTitle.trim() : ''
  const fallbackTitle =
    dateRange.from && dateRange.to
      ? language === 'ru'
        ? 'Доступные объекты'
        : 'Available Properties'
      : language === 'ru'
        ? 'Топ объекты'
        : 'Top Properties'
  const sectionTitle = cleanCustomTitle.length > 0 ? cleanCustomTitle : fallbackTitle
  const initialDates = {
    checkIn: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
    checkOut: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
    checkInTime,
    checkOutTime,
  }
  return (
    <section id="listings-section" className="bg-white py-12 sm:py-16">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between mb-8 min-h-[3.5rem]">
          <div>
            <h2 className="text-[32px] leading-10 tracking-[-0.01em] font-semibold text-slate-900 mb-1">
              {sectionTitle}
            </h2>
            <p className="text-slate-600 text-base min-h-[1.5rem]">
              {listings.length} {language === 'ru' ? 'объектов' : 'properties'}
              {dateRange.from && dateRange.to && (
                <span className="text-[#006666] ml-2">
                  • {formatDisplayDate(dateRange.from)} — {formatDisplayDate(dateRange.to)}
                </span>
              )}
            </p>
          </div>
          {listingsLoading && <Loader2 className="h-5 w-5 animate-spin text-[#006666] shrink-0" aria-hidden />}
        </div>

        {aiGridPending && listingsLoading ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm font-medium text-violet-900 shadow-sm">
            <span aria-hidden className="text-base">
              ✨
            </span>
            {getUIText('aiSearchLoadingBanner', language)}
          </div>
        ) : null}

        {loading ? (
          <ListingGridSkeleton count={8} />
        ) : listings.length === 0 ? (
          <EmptyState
            language={language}
            onCtaClick={onViewAll}
            ctaLabel={language === 'ru' ? 'Показать все объявления' : 'Show all listings'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {listings.map((listing, idx) => {
              const promoBadgeText =
                listing.catalog_promo_badge && typeof listing.catalog_promo_badge === 'object'
                  ? String(listing.catalog_promo_badge.label || '')
                  : (listing.catalog_promo_badge || '')
              const listingParams = new URLSearchParams()
              if (dateRange.from) listingParams.set('checkIn', format(dateRange.from, 'yyyy-MM-dd'))
              if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
                listingParams.set('checkOut', format(dateRange.to, 'yyyy-MM-dd'))
              }
              if (
                isTransportListingCategory(listing.category?.slug || listing.categorySlug) &&
                dateRange.from &&
                dateRange.to &&
                !isSameDay(dateRange.from, dateRange.to)
              ) {
                listingParams.set('checkInTime', checkInTime)
                listingParams.set('checkOutTime', checkOutTime)
              }
              if (guests !== '1') listingParams.set('guests', guests)
              const listingUrl = listingParams.toString()
                ? `/listings/${listing.id}?${listingParams.toString()}`
                : `/listings/${listing.id}`
              const thumbRaw = listing.coverImage || listing.images?.[0] || '/placeholder.svg'
              const thumbSrc =
                thumbRaw === '/placeholder.svg'
                  ? thumbRaw
                  : resolveImageThumbDisplayUrl(thumbRaw) || thumbRaw

              return (
                <Link key={listing.id} href={listingUrl}>
                  <Card className="group h-full flex flex-col overflow-hidden rounded-2xl transition-all duration-300 border border-slate-200 hover:border-[#006666] hover:-translate-y-1 bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05),0_2px_6px_rgba(0,102,102,0.06)] hover:shadow-[0_30px_64px_rgba(0,102,102,0.16),0_12px_28px_rgba(15,23,42,0.12)]">
                    <div className="relative h-44 sm:h-48 overflow-hidden flex-shrink-0">
                      <Image
                        src={mediaFallback[`lst-${listing.id}`] ? '/placeholder.svg' : thumbSrc}
                        alt={listing.title}
                        fill
                        placeholder="blur"
                        blurDataURL={LISTING_CARD_BLUR_DATA_URL}
                        unoptimized={isRemoteHttpImageSrc(
                          mediaFallback[`lst-${listing.id}`] ? '/placeholder.svg' : thumbSrc,
                        )}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        priority={idx < 4}
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        onError={() => markMediaFailed(`lst-${listing.id}`)}
                      />
                      {listing?.isFeatured && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600">
                          ⭐ TOP
                        </Badge>
                      )}
                      {listing.is_availability_mismatch && (
                        <Badge className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500/95 text-white text-[10px] px-2 py-1">
                          <CalendarX className="h-3 w-3" />
                          {language === 'ru' ? 'Уточняйте доступность' : 'Check availability'}
                        </Badge>
                      )}
                      {(listing.catalog_flash_urgency || promoBadgeText) && (
                        <Badge
                          data-testid={`listing-flash-deal-${listing.id}`}
                          className="absolute bottom-2 left-2 flex items-center gap-1 border-0 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-bold px-2 py-1 shadow-[0_4px_12px_rgba(225,29,72,0.35)] animate-[pulse_2.2s_ease-in-out_infinite]"
                        >
                          <Flame className="h-3 w-3" aria-hidden />
                          {promoBadgeText || (language === 'ru' ? 'FLASH' : 'FLASH')}
                        </Badge>
                      )}
                      {listing.catalog_flash_social_proof && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/75 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                          {listing.catalog_flash_social_proof}
                        </span>
                      )}
                      {Number(listing?.rating) > 0 && (
                        <Badge className="absolute top-2 right-2 bg-[#006666]">⭐ {listing.rating}</Badge>
                      )}
                    </div>
                    <div className="flex flex-col flex-grow p-5">
                      <h3 className="font-semibold text-slate-900 line-clamp-1 text-[18px] leading-6 tracking-[-0.01em] mb-1.5">
                        {getListingText(listing, 'title', language)}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
                        <MapPin className="h-3 w-3" />
                        <span>{listing.district}</span>
                      </div>
                      <ListingCardSpecsRow listing={listing} language={language} compact />
                      <div className="mt-auto flex items-baseline justify-between gap-2">
                        <CardPriceDisplay
                          listing={listing}
                          pricing={listing.pricing}
                          initialDates={initialDates}
                          currency={currency}
                          exchangeRates={exchangeRates}
                          language={language}
                          categorySlug={
                            listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''
                          }
                        />
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {listings.length > 0 && (
          <div className="text-center mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={onViewAll}
              className="rounded-2xl border-[#006666] text-[#006666] hover:bg-[#006666]/10"
            >
              {language === 'ru' ? 'Смотреть все' : 'View all'} →
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
