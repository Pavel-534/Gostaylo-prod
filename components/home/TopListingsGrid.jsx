'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin,
  BedDouble,
  Bath,
  Users,
  Ship,
  Clock,
  Route,
  Car,
  Anchor,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { getUIText, getListingText, getCategoryName } from '@/lib/translations'
import { ListingGridSkeleton } from '@/components/listing-card-skeleton'
import { toPublicImageUrl, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { format, isSameDay } from 'date-fns'
import { formatDisplayDate } from '@/lib/date-display-format'
import { getListingRentalPeriodMode } from '@/lib/listing-booking-ui'
import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'

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
  nights,
  mediaFallback,
  markMediaFailed,
  onViewAll,
}) {
  return (
    <section id="listings-section" className="py-10 sm:py-14 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 min-h-[3.5rem]">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
              {dateRange.from && dateRange.to
                ? language === 'ru'
                  ? 'Доступные объекты'
                  : 'Available Properties'
                : language === 'ru'
                  ? 'Топ объекты'
                  : 'Top Properties'}
            </h2>
            <p className="text-slate-500 text-sm min-h-[1.25rem]">
              {listings.length} {language === 'ru' ? 'объектов' : 'properties'}
              {dateRange.from && dateRange.to && (
                <span className="text-teal-600 ml-2">
                  • {formatDisplayDate(dateRange.from)} — {formatDisplayDate(dateRange.to)}
                </span>
              )}
            </p>
          </div>
          {listingsLoading && <Loader2 className="h-5 w-5 animate-spin text-teal-600 shrink-0" aria-hidden />}
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
          <div className="text-center py-12 min-h-[200px] flex items-center justify-center">
            <p className="text-slate-600">{language === 'ru' ? 'Ничего не найдено' : 'No results'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map((listing, idx) => {
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
              const thumbSrc = thumbRaw === '/placeholder.svg' ? thumbRaw : toPublicImageUrl(thumbRaw) || thumbRaw

              return (
                <Link key={listing.id} href={listingUrl}>
                  <Card className="group h-full flex flex-col overflow-hidden hover:shadow-lg transition-all border hover:border-teal-400 bg-white">
                    <div className="relative h-40 sm:h-44 overflow-hidden flex-shrink-0">
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
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={() => markMediaFailed(`lst-${listing.id}`)}
                      />
                      {listing.isFeatured && (
                        <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-pink-600">
                          ⭐ TOP
                        </Badge>
                      )}
                      {listing.rating > 0 && (
                        <Badge className="absolute top-2 right-2 bg-teal-600">⭐ {listing.rating}</Badge>
                      )}
                    </div>
                    <div className="flex flex-col flex-grow p-3">
                      <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm mb-1">
                        {getListingText(listing, 'title', language)}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>{listing.district}</span>
                      </div>
                      {(() => {
                        const slug =
                          listing.categorySlug || listing.category?.slug || listing.metadata?.category_slug || ''
                        const propertyInterior = showsPropertyInteriorSpecs(slug)
                        const yachtCard = isYachtLikeCategory(slug)
                        const tourCard = isTourListingCategory(slug)
                        const vehicleCard = isTransportListingCategory(slug)
                        const meta = listing.metadata || {}
                        const cabins = parseInt(String(meta.cabins ?? meta.cabins_count ?? '').replace(/\D/g, ''), 10) || 0
                        const durationHours =
                          parseInt(String(meta.duration_hours ?? meta.tour_hours ?? '').replace(/\D/g, ''), 10) || 0
                        const engineCc = parseInt(String(meta.engine_cc ?? '').replace(/\D/g, ''), 10) || 0
                        const cap = resolveListingGuestCapacity(listing)
                        const showSpecs =
                          (propertyInterior && (listing.bedrooms > 0 || listing.bathrooms > 0)) ||
                          yachtCard ||
                          tourCard ||
                          vehicleCard ||
                          cap > 0
                        if (!showSpecs) return null
                        return (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-2">
                            {propertyInterior && listing.bedrooms > 0 && (
                              <span className="flex items-center gap-0.5">
                                <BedDouble className="h-3 w-3 shrink-0" aria-hidden />
                                {listing.bedrooms}
                              </span>
                            )}
                            {propertyInterior && listing.bathrooms > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Bath className="h-3 w-3 shrink-0" aria-hidden />
                                {listing.bathrooms}
                              </span>
                            )}
                            {yachtCard && (
                              <span
                                className="flex items-center gap-0.5"
                                title={getCategoryName('yachts', language)}
                              >
                                <Anchor className="h-3 w-3 shrink-0" aria-hidden />
                              </span>
                            )}
                            {yachtCard && cabins > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Ship className="h-3 w-3 shrink-0" aria-hidden />
                                {cabins}
                              </span>
                            )}
                            {tourCard && (
                              <span
                                className="flex items-center gap-0.5"
                                title={getCategoryName('tours', language)}
                              >
                                <Route className="h-3 w-3 shrink-0" aria-hidden />
                              </span>
                            )}
                            {tourCard && durationHours > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                                {durationHours}h
                              </span>
                            )}
                            {vehicleCard && !yachtCard && (
                              <span
                                className="flex items-center gap-0.5"
                                title={getCategoryName('vehicles', language)}
                              >
                                <Car className="h-3 w-3 shrink-0" aria-hidden />
                              </span>
                            )}
                            {vehicleCard && !yachtCard && engineCc > 0 && (
                              <span className="tabular-nums font-medium text-slate-500">{engineCc}cc</span>
                            )}
                            <span className="flex items-center gap-0.5">
                              <Users className="h-3 w-3 shrink-0" aria-hidden />
                              {cap}
                            </span>
                          </div>
                        )
                      })()}
                      <div className="mt-auto flex items-baseline justify-between">
                        <span className="text-lg font-bold text-teal-600">
                          {formatPrice(
                            listing.pricing?.totalPrice || listing.basePriceThb,
                            currency,
                            exchangeRates,
                            language,
                          )}
                        </span>
                        <span className="text-xs text-slate-400">
                          /
                          {listing.pricing
                            ? `${nights}${language === 'ru' ? 'н.' : 'n'}`
                            : getListingRentalPeriodMode(
                                listing.categorySlug || listing.category?.slug || '',
                              ) === 'day'
                              ? getUIText('listingPriceUnitDay', language)
                              : getUIText('night', language)}
                        </span>
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
              className="border-teal-600 text-teal-600 hover:bg-teal-50"
            >
              {language === 'ru' ? 'Смотреть все' : 'View all'} →
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
