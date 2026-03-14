'use client'

/**
 * GostayloListingCard - Premium Airbnb-style Listing Card
 * 
 * Features:
 * - Image carousel with navigation dots
 * - Live pricing calculation
 * - Specs row (bedrooms, beds, guests)
 * - Context inheritance (passes dates to detail page)
 * - Responsive design
 * 
 * @created 2026-03-12
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Heart, Star, MapPin, BedDouble, Users, Bath, Maximize, Wifi, Car, Waves, Edit, Send, Trash2 } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { format, differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'

// Property type labels
const PROPERTY_TYPES = {
  villa: { en: 'Villa', ru: 'Вилла' },
  apartment: { en: 'Apartment', ru: 'Апартаменты' },
  house: { en: 'House', ru: 'Дом' },
  condo: { en: 'Condo', ru: 'Кондо' },
  studio: { en: 'Studio', ru: 'Студия' },
  penthouse: { en: 'Penthouse', ru: 'Пентхаус' },
  default: { en: 'Property', ru: 'Объект' }
}

// Listing status configuration for owner view
const STATUS_CONFIG = {
  ACTIVE: { label: { en: 'Active', ru: 'Активен' }, className: 'bg-green-100 text-green-700 border-green-200' },
  PENDING: { label: { en: 'Pending', ru: 'На модерации' }, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  INACTIVE: { label: { en: 'Inactive', ru: 'Неактивен' }, className: 'bg-slate-100 text-slate-600 border-slate-200' },
  REJECTED: { label: { en: 'Rejected', ru: 'Отклонён' }, className: 'bg-red-100 text-red-700 border-red-200' },
}

// Status Badge component for owner view
function StatusBadge({ status, language = 'en' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.INACTIVE
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      config.className
    )}>
      {config.label[language] || config.label.en}
    </span>
  )
}

// Amenity icons mapping
const AMENITY_ICONS = {
  wifi: Wifi,
  parking: Car,
  pool: Waves,
}

export function GostayloListingCard({
  listing,
  initialDates = { checkIn: null, checkOut: null },
  guests = '2',
  language = 'en',
  currency = 'THB',
  exchangeRates = { THB: 1 },
  onFavorite,
  isFavorited = false, // NEW: controlled favorite state
  className,
  // NEW: Owner view props
  isOwnerView = false,
  onEdit,
  onDelete,
  onPublish
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isFavorite, setIsFavorite] = useState(isFavorited) // Initialize from prop
  const [imageLoaded, setImageLoaded] = useState(false)
  
  // Sync with prop changes
  useEffect(() => {
    setIsFavorite(isFavorited)
  }, [isFavorited])

  // Extract listing data with defaults
  const {
    id,
    title = 'Untitled Property',
    description = '',
    district = 'Phuket',
    basePriceThb = 0,
    images = [],
    coverImage,
    rating = 0,
    reviewsCount = 0,
    isFeatured = false,
    metadata = {},
    pricing = null, // From API when dates are provided
    category
  } = listing

  // Extract metadata
  const bedrooms = metadata?.bedrooms || 0
  const beds = metadata?.beds || bedrooms
  const bathrooms = metadata?.bathrooms || 0
  const maxGuests = metadata?.max_guests || metadata?.guests || 4
  const area = metadata?.area || 0
  const propertyType = metadata?.property_type || category?.slug || 'default'
  const amenities = metadata?.amenities || []

  // Build image array
  const allImages = useMemo(() => {
    const imgs = []
    if (coverImage) imgs.push(coverImage)
    if (images?.length) {
      images.forEach(img => {
        if (img !== coverImage) imgs.push(img)
      })
    }
    return imgs.length > 0 ? imgs : ['/placeholder.jpg']
  }, [coverImage, images])

  // Calculate nights and pricing
  const nights = useMemo(() => {
    if (initialDates.checkIn && initialDates.checkOut) {
      try {
        const checkIn = new Date(initialDates.checkIn)
        const checkOut = new Date(initialDates.checkOut)
        return differenceInDays(checkOut, checkIn)
      } catch {
        return 0
      }
    }
    return 0
  }, [initialDates])

  // Get display price (total if dates selected, per night otherwise)
  const displayPrice = useMemo(() => {
    if (pricing?.totalPrice && nights > 0) {
      return pricing.totalPrice
    }
    return basePriceThb
  }, [pricing, nights, basePriceThb])

  const perNightPrice = useMemo(() => {
    if (pricing?.perNight) {
      return pricing.perNight
    }
    return basePriceThb
  }, [pricing, basePriceThb])

  // Price conversion
  const convertPrice = useCallback((priceThb) => {
    if (!priceThb) return 0
    if (currency === 'THB') return priceThb
    const rate = exchangeRates[currency]
    return rate ? priceThb / rate : priceThb
  }, [currency, exchangeRates])

  // Build detail page URL with context inheritance
  const detailUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (initialDates.checkIn) params.set('checkIn', initialDates.checkIn)
    if (initialDates.checkOut) params.set('checkOut', initialDates.checkOut)
    if (guests && guests !== '1') params.set('guests', guests)
    
    const queryString = params.toString()
    return queryString ? `/listings/${id}?${queryString}` : `/listings/${id}`
  }, [id, initialDates, guests])

  // Image navigation
  const nextImage = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentImageIndex(prev => (prev + 1) % allImages.length)
  }, [allImages.length])

  const prevImage = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentImageIndex(prev => (prev - 1 + allImages.length) % allImages.length)
  }, [allImages.length])

  // Favorite toggle
  const handleFavorite = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFavorite(prev => !prev)
    onFavorite?.(id, !isFavorite)
  }, [id, isFavorite, onFavorite])

  // Get property type label
  const typeLabel = PROPERTY_TYPES[propertyType]?.[language] || PROPERTY_TYPES.default[language]

  // Format rating
  const formattedRating = rating > 0 ? rating.toFixed(1) : null

  return (
    <Link 
      href={detailUrl}
      className={cn("block group", className)}
      data-testid={`listing-card-${id}`}
    >
      <article className="bg-white rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl border border-slate-100 hover:border-teal-200">
        {/* Image Carousel */}
        <div 
          className="relative aspect-[4/3] overflow-hidden bg-slate-100"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Main Image */}
          <img
            src={allImages[currentImageIndex]}
            alt={`${title} - Photo ${currentImageIndex + 1}`}
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              imageLoaded ? "opacity-100" : "opacity-0",
              "group-hover:scale-105"
            )}
            onLoad={() => setImageLoaded(true)}
            loading="lazy"
          />
          
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100 animate-pulse" />
          )}

          {/* Favorite Button */}
          <button
            onClick={handleFavorite}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-all hover:scale-110 z-10"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart 
              className={cn(
                "h-5 w-5 transition-colors",
                isFavorite ? "fill-rose-500 text-rose-500" : "text-slate-600"
              )} 
            />
          </button>

          {/* Featured Badge */}
          {isFeatured && (
            <div className="absolute top-3 left-3 z-10">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold shadow-lg">
                <Star className="h-3 w-3 fill-current" />
                TOP
              </span>
            </div>
          )}

          {/* Navigation Arrows (show on hover) */}
          {allImages.length > 1 && isHovered && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 hover:bg-white shadow-md transition-all hover:scale-110 z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4 text-slate-700" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 hover:bg-white shadow-md transition-all hover:scale-110 z-10"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4 text-slate-700" />
              </button>
            </>
          )}

          {/* Dot Indicators */}
          {allImages.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {allImages.slice(0, 5).map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCurrentImageIndex(idx)
                  }}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    idx === currentImageIndex 
                      ? "bg-white w-4" 
                      : "bg-white/60 hover:bg-white/80"
                  )}
                  aria-label={`Go to image ${idx + 1}`}
                />
              ))}
              {allImages.length > 5 && (
                <span className="text-white/80 text-xs ml-1">+{allImages.length - 5}</span>
              )}
            </div>
          )}

          {/* Quick Info Overlay (bottom gradient) */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 line-clamp-1 text-base group-hover:text-teal-700 transition-colors">
                {title}
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {typeLabel} {district && `• ${district}`}
              </p>
            </div>
            
            {/* Rating */}
            {formattedRating && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-sm text-slate-800">{formattedRating}</span>
                {reviewsCount > 0 && (
                  <span className="text-xs text-slate-400">({reviewsCount})</span>
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
          <div className="flex items-center gap-1 text-sm text-slate-400 mb-3">
            <MapPin className="h-3.5 w-3.5" />
            <span>{district}, Phuket</span>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 my-3" />

          {/* Pricing Section */}
          <div className="flex items-end justify-between">
            <div>
              {/* Main Price */}
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-teal-600">
                  {formatPrice(convertPrice(displayPrice), currency)}
                </span>
                <span className="text-sm text-slate-400">
                  {nights > 0 ? (
                    <>/ {nights} {language === 'ru' ? (nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей') : `night${nights > 1 ? 's' : ''}`}</>
                  ) : (
                    <>/ {language === 'ru' ? 'ночь' : 'night'}</>
                  )}
                </span>
              </div>
              
              {/* Per Night Price (when showing total) */}
              {nights > 0 && pricing?.perNight && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatPrice(convertPrice(perNightPrice), currency)} {language === 'ru' ? 'за ночь' : 'per night'}
                </p>
              )}
            </div>

            {/* Availability Badge */}
            {nights > 0 && pricing && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                {language === 'ru' ? 'Доступно' : 'Available'}
              </span>
            )}
          </div>

          {/* Owner View: Status Badge & Actions */}
          {isOwnerView && (
            <div className="mt-3">
              {/* Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <StatusBadge status={listing.status} language={language} />
                {listing.metadata?.is_draft && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    {language === 'ru' ? 'Черновик' : 'Draft'}
                  </span>
                )}
              </div>
              
              {/* Owner Actions */}
              <div className="flex gap-2">
                {onEdit && (
                  <button 
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors text-sm flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onEdit(listing)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    {language === 'ru' ? 'Редактировать' : 'Edit'}
                  </button>
                )}
                {onPublish && listing.status === 'INACTIVE' && (
                  <button 
                    className="flex-1 py-2 px-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors text-sm flex items-center justify-center gap-1"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onPublish(listing)
                    }}
                  >
                    <Send className="h-4 w-4" />
                    {language === 'ru' ? 'Опубликовать' : 'Publish'}
                  </button>
                )}
                {onDelete && (
                  <button 
                    className="py-2 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors text-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDelete(listing)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Guest View: Book Button */}
          {!isOwnerView && (
            <button 
              className="w-full mt-4 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors text-sm"
              onClick={(e) => {
                e.preventDefault()
                window.location.href = detailUrl
              }}
            >
              {nights > 0 
                ? (language === 'ru' ? 'Забронировать' : 'Book Now')
                : (language === 'ru' ? 'Подробнее' : 'View Details')
              }
            </button>
          )}
        </div>
      </article>
    </Link>
  )
}

// Compact variant for smaller spaces
export function GostayloListingCardCompact({
  listing,
  initialDates,
  guests,
  language = 'en',
  currency = 'THB',
  exchangeRates,
  className
}) {
  const { id, title, district, basePriceThb, images, coverImage, rating, isFeatured, pricing, metadata } = listing
  
  const image = coverImage || images?.[0] || '/placeholder.jpg'
  const nights = initialDates?.checkIn && initialDates?.checkOut 
    ? differenceInDays(new Date(initialDates.checkOut), new Date(initialDates.checkIn))
    : 0

  const detailUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (initialDates?.checkIn) params.set('checkIn', initialDates.checkIn)
    if (initialDates?.checkOut) params.set('checkOut', initialDates.checkOut)
    if (guests) params.set('guests', guests)
    return params.toString() ? `/listings/${id}?${params.toString()}` : `/listings/${id}`
  }, [id, initialDates, guests])

  const convertPrice = (priceThb) => {
    if (!priceThb || currency === 'THB') return priceThb
    return exchangeRates?.[currency] ? priceThb / exchangeRates[currency] : priceThb
  }

  return (
    <Link href={detailUrl} className={cn("block group", className)} data-testid={`listing-card-compact-${id}`}>
      <div className="flex gap-3 p-3 bg-white rounded-lg border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all">
        {/* Thumbnail */}
        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
          <img src={image} alt={title} className="w-full h-full object-cover" />
          {isFeatured && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold">TOP</span>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h4 className="font-medium text-slate-900 text-sm line-clamp-1 group-hover:text-teal-700">{title}</h4>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {district}
            </p>
            {rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-xs font-medium">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-teal-600">
              {formatPrice(convertPrice(pricing?.totalPrice || basePriceThb), currency)}
            </span>
            <span className="text-xs text-slate-400">
              /{nights > 0 ? `${nights}н.` : (language === 'ru' ? 'ночь' : 'night')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default GostayloListingCard
