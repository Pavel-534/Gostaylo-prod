'use client'

/**
 * ListingCard — карточка листинга в сетках и сайдбаре.
 * Phase 7.6 Final + Stage 200.15 optimistic PDP entry.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Star, MapPin } from 'lucide-react'
import { CardImageCarousel } from '@/components/card/CardImageCarousel'
import { CardPriceDisplay } from '@/components/card/CardPriceDisplay'
import { useShareListing } from '@/lib/hooks/useShareListing'
import { cn } from '@/lib/utils'
import { getUIText, getCategoryName, getListingText } from '@/lib/translations'
import { buildListingCategoryLineLabel } from '@/lib/category-display-name'
import { getListingCardBlurDataURL } from '@/lib/listing-image-blur'
import { getListingCardImageUrls } from '@/lib/media/image-delivery'
import { PartnerTrustBadge } from '@/components/trust/PartnerTrustBadge'
import { PartnerRenterTrustBadges } from '@/components/trust/PartnerRenterTrustBadges'
import { Badge } from '@/components/ui/badge'
import { UrgencyTimer } from '@/components/UrgencyTimer'
import { ListingFlashHotStrip } from '@/components/listing/ListingFlashHotStrip'
import { shouldShowFlashUrgencyTimerAboveStrip } from '@/lib/listing/flash-hot-strip'
import { ListingCardSpecsRow } from '@/components/listing/ListingCardSpecsRow'
import { dispatchOptimisticNavPending } from '@/lib/navigation/optimistic-nav-href'
import { prefetchListingPdp } from '@/lib/navigation/listing-hero-transition'
import {
  LISTING_CARD_BODY_PAD,
  LISTING_CARD_CONTENT_MIN_H,
  LISTING_CARD_PRICE_ROW_MIN_H,
  LISTING_CARD_SPEC_ROW_MIN_H,
  LISTING_CARD_TITLE_ROW_MIN_H,
  LISTING_CARD_TRUST_ROW_MIN_H,
} from '@/lib/listing/listing-card-layout'
import { useListingLocationLabel } from '@/lib/hooks/use-listing-location-label'

export function ListingCard({
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
  /** Stage 69.0 — плоский список из `/api/v2/categories` для строки «Родитель • Подтип» */
  catalogCategories = null,
  /** Stage 171.18 — LCP for first catalog cards only. */
  imagePriority = false,
  /**
   * Stage 200.136 — `grid` stretches in catalog rows (equal height + price at bottom).
   * `solo` hugs content (wizard preview / eye sheet) — no empty void under specs.
   */
  layout = 'grid',
}) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(isFavorited)
  const [pdpPending, setPdpPending] = useState(false)
  
  // Sync with prop changes
  useEffect(() => {
    setIsFavorite(isFavorited)
  }, [isFavorited])

  // Extract listing data
  const {
    id,
    title = 'Untitled Property',
    district: districtRaw = '',
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
    ownerVerified: listingOwnerVerified,
    owner,
    catalog_promo_badge = null,
    catalog_flash_urgency = null,
    catalog_flash_social_proof = null,
  } = listing

  const locationLabel = useListingLocationLabel(listing, language)
  const district = locationLabel || String(districtRaw || '').trim() 
  const actualIsFeatured = isFeatured || is_featured
  const ownerVerified =
    listingOwnerVerified === true ||
    owner?.is_verified === true ||
    listing?.owner?.is_verified === true
  const displayRatingRaw =
    listing?.avgRating ?? listing?.average_rating ?? average_rating ?? rating ?? 0
  const displayRating = parseFloat(displayRatingRaw) || 0
  const displayReviewsCount = reviews_count || reviewsCount || 0
  
  const categorySlugForCard = listingCategorySlug || category?.slug || ''
  const propertyType = metadata?.property_type || category?.slug || 'default'
  
  const allImages = useMemo(
    () => getListingCardImageUrls({ coverImage, cover_image, images }),
    [coverImage, cover_image, images],
  )

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

  const markPdpPending = useCallback((href = detailUrl) => {
    setPdpPending(true)
    dispatchOptimisticNavPending(href || detailUrl)
  }, [detailUrl])

  const handlePrefetch = useCallback(() => {
    prefetchListingPdp(router, id)
  }, [id, router])

  // Favorite toggle
  const handleFavorite = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const newState = !isFavorite
    setIsFavorite(newState)
    onFavorite?.(id, newState)
  }, [id, isFavorite, onFavorite])

  // Web Share — нативный sharesheet (iOS/Android) или clipboard fallback
  const handleShare = useShareListing({
    url: detailUrl,
    title: getUIText('shareListing', language) + ' · ' + title,
    text: title,
    language,
    listingId: id,
  })

  const categoryLine =
    Array.isArray(catalogCategories) && catalogCategories.length > 0
      ? buildListingCategoryLineLabel(listing, catalogCategories, language, getCategoryName)
      : getCategoryName(propertyType, language) || getCategoryName('property', language)
  const promoBadgeLabel =
    catalog_promo_badge && typeof catalog_promo_badge === 'object' && catalog_promo_badge.label
      ? String(catalog_promo_badge.label)
      : ''
  const isSolo = layout === 'solo'

  return (
    <article
      id={`listing-card-${id}`}
      data-testid={`listing-card-${id}`}
      data-pdp-pending={pdpPending ? 'true' : undefined}
      data-listing-card-layout={isSolo ? 'solo' : 'grid'}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      className={cn(
        // Base
        'group flex min-h-0 flex-col scroll-mt-24 overflow-hidden rounded-2xl border bg-white',
        isSolo ? 'h-auto' : 'h-full',
        // Premium hover: lift + deepen shadow + teal border accent
        'transition-all duration-300 ease-out touch-manipulation',
        'hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(0,102,102,0.14),0_4px_16px_rgba(0,0,0,0.06)]',
        'active:scale-[0.99]',
        pdpPending && 'opacity-90 ring-2 ring-brand/30 ring-offset-1',
        isMapHighlighted
          ? 'relative z-0 border-brand shadow-lg ring-2 ring-brand/40 ring-offset-2 hover:z-20'
          : 'relative z-0 border-slate-100 hover:border-brand/25 md:hover:z-20',
        className
      )}
    >
      <CardImageCarousel
        listingId={id}
        detailHref={detailUrl}
        images={allImages}
        title={title}
        isFavorite={isFavorite}
        onFavoriteClick={handleFavorite}
        favoriteAddLabel={getUIText('favoriteAdd', language)}
        favoriteRemoveLabel={getUIText('favoriteRemove', language)}
        onShareClick={handleShare}
        shareLabel={getUIText('shareListing', language)}
        blurDataURL={getListingCardBlurDataURL(listing)}
        priority={imagePriority}
        onNavigateStart={markPdpPending}
        topLeftBadge={
          promoBadgeLabel ? (
            <Badge className="border-0 bg-gradient-to-r from-rose-600 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
              {promoBadgeLabel}
            </Badge>
          ) : null
        }
      />

      {shouldShowFlashUrgencyTimerAboveStrip(catalog_flash_urgency, catalog_flash_social_proof) ? (
        <div className="px-3 pt-1.5 sm:px-4 sm:pt-2">
          <UrgencyTimer endsAt={catalog_flash_urgency.ends_at} language={language} variant="compact" />
        </div>
      ) : null}

      <ListingFlashHotStrip
        catalog_flash_urgency={catalog_flash_urgency}
        catalog_flash_social_proof={catalog_flash_social_proof}
        language={language}
        compact
        className="mx-3 mt-1.5 sm:mx-4 sm:mt-2"
      />

      {/* Текст и цена — отдельная ссылка; сердце не внутри anchor (валидный DOM) */}
      <Link
        href={detailUrl}
        onClick={() => markPdpPending(detailUrl)}
        className={cn(
          'flex flex-col',
          LISTING_CARD_BODY_PAD,
          !isSolo && LISTING_CARD_CONTENT_MIN_H,
          isSolo ? 'flex-none' : 'flex-1',
        )}
      >
          {/* Title Row */}
          <div
            className={cn(
              'mb-1.5 flex min-w-0 items-start justify-between gap-2 sm:mb-2',
              LISTING_CARD_TITLE_ROW_MIN_H,
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm sm:text-base group-hover:text-brand-hover transition-colors">
                  {getListingText(listing, 'title', language) || title}
                </h3>
                {ownerVerified ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-brand/30 bg-brand/10 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-brand-hover sm:px-2 sm:text-[10px]"
                  >
                    {getUIText('listingCard_verifiedPartner', language)}
                  </Badge>
                ) : null}
              </div>
              <div className={cn('mt-0.5 space-y-0.5 sm:mt-1', LISTING_CARD_TRUST_ROW_MIN_H)}>
                {categoryLine ? (
                  <p className="text-[10px] font-medium leading-snug text-slate-400 sm:text-[11px]">{categoryLine}</p>
                ) : null}
                {district ? (
                  <p className="flex items-center gap-1 text-xs text-slate-500 sm:text-sm">
                    <MapPin className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden />
                    <span className="min-w-0 truncate">{district}</span>
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 space-y-1 overflow-hidden">
                <PartnerTrustBadge
                  trust={partnerTrust}
                  language={language}
                  compact
                  showVerifiedCompanion={!!(owner?.is_verified || listing?.owner?.is_verified)}
                />
                <PartnerRenterTrustBadges trust={partnerTrust} language={language} />
              </div>
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

          <div className={LISTING_CARD_SPEC_ROW_MIN_H}>
            <ListingCardSpecsRow listing={listing} language={language} />
          </div>

          {/* Price — grid: pin to card bottom; solo: natural gap under specs */}
          <div
            className={cn(
              'relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white pt-2 sm:pt-3',
              isSolo ? 'mt-3' : 'mt-auto',
              LISTING_CARD_PRICE_ROW_MIN_H,
            )}
          >
            <CardPriceDisplay
              listing={listing}
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
            {listing?.is_availability_mismatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-xs font-medium mt-1">
                {language === 'ru' ? 'Уточняйте доступность' : 'Check availability'}
              </span>
            )}
          </div>
      </Link>
    </article>
  )
}
