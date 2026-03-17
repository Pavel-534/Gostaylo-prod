'use client'

/**
 * GostayloListingCard - Refactored Clean Version
 * Phase 7.6 Final
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Star, MapPin, BedDouble, Users, Bath, Maximize } from 'lucide-react'
import { CardImageCarousel } from '@/components/card/CardImageCarousel'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { cn } from '@/lib/utils'

const PROPERTY_TYPES = {
  villa: { en: 'Villa', ru: 'Вилла' },
  apartment: { en: 'Apartment', ru: 'Апартаменты' },
  house: { en: 'House', ru: 'Дом' },
  condo: { en: 'Condo', ru: 'Кондо' },
  studio: { en: 'Studio', ru: 'Студия' },
  penthouse: { en: 'Penthouse', ru: 'Пентхаус' },
  default: { en: 'Property', ru: 'Объект' }
}

export function GostayloListingCard({
  listing,
  initialDates = { checkIn: null, checkOut: null },
  guests = '2',
  language = 'en',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onFavorite,
  isFavorited = false,
  className
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
    category
  } = listing
  
  const basePrice = basePriceThb || base_price_thb || 0
  const actualCoverImage = coverImage || cover_image
  const actualIsFeatured = isFeatured || is_featured
  const displayRating = average_rating || rating || 0
  const displayReviewsCount = reviews_count || reviewsCount || 0
  
  // Extract metadata
  const bedrooms = metadata?.bedrooms || 0
  const bathrooms = metadata?.bathrooms || 0
  const maxGuests = metadata?.max_guests || metadata?.guests || 4
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
    return imgs.length > 0 ? imgs : ['/placeholder.jpg']
  }, [actualCoverImage, images])

  // Build detail page URL
  const detailUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (initialDates.checkIn) params.set('checkIn', initialDates.checkIn)
    if (initialDates.checkOut) params.set('checkOut', initialDates.checkOut)
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

  const typeLabel = PROPERTY_TYPES[propertyType]?.[language] || PROPERTY_TYPES.default[language]

  return (
    <Link 
      href={detailUrl}
      className={cn("block group", className)}
      data-testid={`listing-card-${id}`}
    >
      <article className="bg-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-slate-100 hover:border-teal-200">
        <CardImageCarousel
          images={allImages}
          title={title}
          isFavorite={isFavorite}
          onFavoriteClick={handleFavorite}
        />

        {/* Content */}
        <div className="p-4">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 line-clamp-1 text-base group-hover:text-teal-700 transition-colors">
                {title}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {typeLabel} • {district}
              </p>
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

          {/* Specs Row */}
          <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
            {bedrooms > 0 && (
              <div className="flex items-center gap-1" title={language === 'ru' ? 'Спальни' : 'Bedrooms'}>
                <BedDouble className="h-4 w-4" />
                <span>{bedrooms}</span>
              </div>
            )}
            {bathrooms > 0 && (
              <div className="flex items-center gap-1" title={language === 'ru' ? 'Ванные' : 'Bathrooms'}>
                <Bath className="h-4 w-4" />
                <span>{bathrooms}</span>
              </div>
            )}
            <div className="flex items-center gap-1" title={language === 'ru' ? 'Макс. гостей' : 'Max guests'}>
              <Users className="h-4 w-4" />
              <span>{maxGuests}</span>
            </div>
            {area > 0 && (
              <div className="flex items-center gap-1" title={language === 'ru' ? 'Площадь' : 'Area'}>
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
            />
            {actualIsFeatured && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold">
                <Star className="h-3 w-3 fill-current" />
                TOP
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
