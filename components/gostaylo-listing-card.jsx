'use client'

/**
 * GostayloListingCard - Refactored Clean Version
 * Phase 7.6 Final
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Star,
  MapPin,
  BedDouble,
  Users,
  Bath,
  Maximize,
  Anchor,
  Ship,
  Clock,
  Car,
  Route,
} from 'lucide-react'
import { CardImageCarousel } from '@/components/card/CardImageCarousel'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { cn } from '@/lib/utils'
import { getUIText, getCategoryName } from '@/lib/translations'
import { resolveListingGuestCapacity } from '@/lib/listing-guest-capacity'
import {
  isTransportListingCategory,
  isTourListingCategory,
  isYachtLikeCategory,
  showsPropertyInteriorSpecs,
} from '@/lib/listing-category-slug'
import { getListingCardBlurDataURL } from '@/lib/listing-image-blur'
import { PartnerTrustBadge } from '@/components/trust/PartnerTrustBadge'

export function GostayloListingCard({
  listing,
  initialDates = { checkIn: null, checkOut: null },
  guests = '2',
  language = 'en',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onFavorite,
  isFavorited = false,
  className,
  isMapHighlighted = false,
}) {
  const [isFavorite, setIsFavorite] = useState(isFavorited)
  
  // Sync with prop changes
  useEffect(() => {
    setIsFavorite(isFavorited)
  }, [isFavorited])

  // Extract listing data
  const {
    id,
    title = 'Untitled Property',
    district = 'Phuket',
    basePriceThb = 0,
    base_price_thb = 0,
    images = [],
    coverImage,
    cover_image,
    rating = 0,
    reviewsCount = 0,
    reviews_count = 0,
    average_rating = 0,
    isFeatured = false,
    is_featured = false,
    metadata = {},
    pricing = null,
    category,
    categorySlug: listingCategorySlug,
    partnerTrust = null,
    owner,
  } = listing
  
  const basePrice = basePriceThb || base_price_thb || 0
  const actualCoverImage = coverImage || cover_image
  const actualIsFeatured = isFeatured || is_featured
  const displayRating = average_rating || rating || 0
  const displayReviewsCount = reviews_count || reviewsCount || 0
  
  // Extract metadata
  const bedrooms = metadata?.bedrooms || 0
  const bathrooms = metadata?.bathrooms || 0
  const categorySlugForCard = listingCategorySlug || category?.slug || ''
  const propertyInteriorCard = showsPropertyInteriorSpecs(categorySlugForCard)
  const yachtCard = isYachtLikeCategory(categorySlugForCard)
  const tourCard = isTourListingCategory(categorySlugForCard)
  const vehicleCard = isTransportListingCategory(categorySlugForCard)
  const maxGuests = resolveListingGuestCapacity(listing)
  const cabins =
    parseInt(String(metadata?.cabins ?? metadata?.cabins_count ?? '').replace(/\D/g, ''), 10) || 0
  const durationHours =
    parseInt(String(metadata?.duration_hours ?? metadata?.tour_hours ?? '').replace(/\D/g, ''), 10) ||
    0
  const engineCc =
    parseInt(String(metadata?.engine_cc ?? '').replace(/\D/g, ''), 10) || 0
  const area = metadata?.area || 0
  const propertyType = metadata?.property_type || category?.slug || 'default'
  
  // Build image array
  const allImages = useMemo(() => {
    const imgs = []
    if (actualCoverImage) imgs.push(actualCoverImage)
    if (images?.length) {
      images.forEach(img => {
        if (img !== actualCoverImage) imgs.push(img)
      })
    }
    return imgs.length > 0 ? imgs : ['/placeholder.svg']
  }, [actualCoverImage, images])

  // Build detail page URL
  const detailUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (initialDates.checkIn) params.set('checkIn', initialDates.checkIn)
    if (initialDates.checkOut) params.set('checkOut', initialDates.checkOut)
    if (initialDates.checkInTime) params.set('checkInTime', initialDates.checkInTime)
    if (initialDates.checkOutTime) params.set('checkOutTime', initialDates.checkOutTime)
    if (guests && guests !== '1') params.set('guests', guests)
    
    const queryString = params.toString()
    return queryString ? `/listings/${id}?${queryString}` : `/listings/${id}`
  }, [id, initialDates, guests])

  // Favorite toggle
  const handleFavorite = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const newState = !isFavorite
    setIsFavorite(newState)
    onFavorite?.(id, newState)
  }, [id, isFavorite, onFavorite])

  const typeLabel = getCategoryName(propertyType, language) || getCategoryName('property', language)

  return (
    <article
      id={`listing-card-${id}`}
      data-testid={`listing-card-${id}`}
      className={cn(
        'group scroll-mt-24 overflow-hidden rounded-xl border bg-white transition-all duration-300 hover:shadow-xl md:group-hover:overflow-visible',
        isMapHighlighted
          ? 'relative z-0 border-teal-500 shadow-lg ring-2 ring-teal-500/40 ring-offset-2 hover:z-20'
          : 'relative z-0 border-slate-100 md:hover:z-20 hover:border-teal-200',
        className
      )}
    >
      <CardImageCarousel
        detailHref={detailUrl}
        images={allImages}
        title={title}
        isFavorite={isFavorite}
        onFavoriteClick={handleFavorite}
        blurDataURL={getListingCardBlurDataURL(listing)}
      />

      {/* Текст и цена — отдельная ссылка; сердце не внутри anchor (валидный DOM) */}
      <Link href={detailUrl} className="block p-4">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 line-clamp-1 text-base group-hover:text-teal-700 transition-colors">
                {title}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {typeLabel} • {district}
              </p>
              <PartnerTrustBadge
                trust={partnerTrust}
                language={language}
                compact
                showVerifiedCompanion={!!(owner?.is_verified || listing?.owner?.is_verified)}
              />
            </div>
            
            {/* Rating */}
            {displayRating > 0 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-sm text-slate-800">{displayRating.toFixed(1)}</span>
                {displayReviewsCount > 0 && (
                  <span className="text-xs text-slate-400">({displayReviewsCount})</span>
                )}
              </div>
            )}
          </div>

          {/* Specs Row — жильё: спальни/ванные; яхта/тур/транспорт: свои признаки */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 mb-3">
            {propertyInteriorCard && bedrooms > 0 && (
              <div className="flex items-center gap-1" title={getUIText('bedrooms', language)}>
                <BedDouble className="h-4 w-4" />
                <span>{bedrooms}</span>
              </div>
            )}
            {propertyInteriorCard && bathrooms > 0 && (
              <div className="flex items-center gap-1" title={getUIText('bathrooms', language)}>
                <Bath className="h-4 w-4" />
                <span>{bathrooms}</span>
              </div>
            )}
            {yachtCard && (
              <div className="flex items-center gap-1" title={getCategoryName('yachts', language)}>
                <Anchor className="h-4 w-4" aria-hidden />
              </div>
            )}
            {yachtCard && cabins > 0 && (
              <div
                className="flex items-center gap-1"
                title={language === 'ru' ? 'Кают' : 'Cabins'}
              >
                <Ship className="h-4 w-4" aria-hidden />
                <span>{cabins}</span>
              </div>
            )}
            {tourCard && (
              <div className="flex items-center gap-1" title={getCategoryName('tours', language)}>
                <Route className="h-4 w-4" aria-hidden />
              </div>
            )}
            {tourCard && durationHours > 0 && (
              <div className="flex items-center gap-1" title={language === 'ru' ? 'Часы' : 'Hours'}>
                <Clock className="h-4 w-4" aria-hidden />
                <span>{durationHours}h</span>
              </div>
            )}
            {vehicleCard && !yachtCard && (
              <div className="flex items-center gap-1" title={getCategoryName('vehicles', language)}>
                <Car className="h-4 w-4" aria-hidden />
              </div>
            )}
            {vehicleCard && !yachtCard && engineCc > 0 && (
              <span className="tabular-nums text-xs font-medium text-slate-600">{engineCc} cc</span>
            )}
            <div
              className="flex items-center gap-1"
              title={
                vehicleCard && !yachtCard
                  ? getUIText('numberOfSeats', language)
                  : getUIText('guests', language)
              }
            >
              <Users className="h-4 w-4" />
              <span>{maxGuests}</span>
            </div>
            {propertyInteriorCard && area > 0 && (
              <div className="flex items-center gap-1" title={getUIText('area', language)}>
                <Maximize className="h-4 w-4" />
                <span>{area}м²</span>
              </div>
            )}
          </div>

          {/* Location */}
          {district && (
            <div className="flex items-center gap-1 text-sm text-slate-500 mb-3">
              <MapPin className="h-4 w-4" />
              <span>{district}</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <CardPriceDisplay
              basePrice={basePrice}
              pricing={pricing}
              initialDates={initialDates}
              currency={currency}
              exchangeRates={exchangeRates}
              language={language}
              categorySlug={categorySlugForCard}
            />
            {actualIsFeatured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold">
                <Star className="h-3 w-3 fill-current" />
                TOP
              </span>
            )}
          </div>
      </Link>
    </article>
  )
}
