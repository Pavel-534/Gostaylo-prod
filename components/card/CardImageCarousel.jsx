/**
 * CardImageCarousel Component
 * Image carousel for listing cards with navigation
 */

'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mapPublicImageUrls, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { resolveListingCardImageSizes } from '@/lib/media/image-delivery'
import { useNetworkQuality } from '@/hooks/use-network-quality'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  listingHeroTransitionStyle,
  navigateWithListingHeroTransition,
} from '@/lib/navigation/listing-hero-transition'

const PLACEHOLDER = '/placeholder.svg'

export function CardImageCarousel({
  images,
  title,
  isFavorite,
  onFavoriteClick,
  favoriteAddLabel,
  favoriteRemoveLabel,
  onShareClick,
  shareLabel,
  onImageLoad,
  /** Ссылка на карточку: прозрачный оверлей под сердцем и стрелками (кнопки не внутри одного anchor). */
  detailHref = null,
  /** Stage 33 — бейдж скидки поверх фото (pointer-events: none). */
  topLeftBadge = null,
  /** Низкокачественный плейсхолдер (LQIP), иначе нейтральный blur. */
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
  /** LCP: only first visible cards in catalog (Stage 171.18). */
  priority = false,
  /** Stage 171.22 — shared element morph → PDP hero. */
  listingId = null,
}) {
  const router = useRouter()
  const networkQuality = useNetworkQuality()
  const isMobile = useIsMobile()
  const imageSizes = resolveListingCardImageSizes(networkQuality)
  const imagesProxied = useMemo(() => mapPublicImageUrls(images), [images])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  /** индексы слайдов, для которых удалённый URL не загрузился */
  const [failed, setFailed] = useState(() => ({}))
  
  const nextImage = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(prev => (prev + 1) % imagesProxied.length)
  }, [imagesProxied.length])
  
  const prevImage = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(prev => (prev - 1 + imagesProxied.length) % imagesProxied.length)
  }, [imagesProxied.length])
  
  const handleLoad = () => {
    setImageLoaded(true)
    onImageLoad?.()
  }

  useEffect(() => {
    setImageLoaded(false)
  }, [currentIndex])

  const rawSrc = imagesProxied[currentIndex]
  const displaySrc = failed[currentIndex] ? PLACEHOLDER : rawSrc
  const unoptimized = isRemoteHttpImageSrc(displaySrc)
  const heroTransitionStyle = listingHeroTransitionStyle(listingId)

  const handleDetailNavigate = useCallback(
    (e) => {
      if (!detailHref) return
      e.preventDefault()
      navigateWithListingHeroTransition(() => router.push(detailHref), listingId)
    },
    [detailHref, listingId, router],
  )

  const showNavigationArrows = imagesProxied.length > 1 && (isHovered || isMobile)

  return (
    <div 
      className="relative aspect-[4/3] overflow-hidden bg-slate-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0" style={heroTransitionStyle}>
        <Image
          src={displaySrc}
          alt={`${title} - Photo ${currentIndex + 1}`}
          fill
          sizes={imageSizes}
          placeholder="blur"
          blurDataURL={blurDataURL}
          unoptimized={unoptimized}
          className={cn(
            'object-cover transition-transform duration-500 ease-out will-change-transform',
            imageLoaded ? 'opacity-100' : 'opacity-0',
            'group-hover:scale-[1.06]',
          )}
          onLoad={handleLoad}
          onError={() => {
            setFailed((f) => ({ ...f, [currentIndex]: true }))
            setImageLoaded(true)
          }}
          priority={priority && currentIndex === 0}
        />
      </div>
      {detailHref ? (
        <Link
          href={detailHref}
          onClick={handleDetailNavigate}
          className="absolute inset-0 z-[1]"
          aria-label={title ? String(title) : 'Open listing'}
          tabIndex={-1}
        >
          <span className="sr-only">{title}</span>
        </Link>
      ) : null}

      {topLeftBadge ? (
        <div
          className="pointer-events-none absolute left-2 top-2 z-[18] max-w-[calc(100%-4rem)]"
          aria-hidden
        >
          {topLeftBadge}
        </div>
      ) : null}
      
      {/* Navigation arrows */}
      {showNavigationArrows && (
        <>
          <button
            type="button"
            onClick={prevImage}
            className={cn(
              'absolute left-2 top-1/2 z-[15] -translate-y-1/2 rounded-full bg-white/90 shadow-md transition-all',
              'flex min-h-11 min-w-11 items-center justify-center p-0',
              isMobile ? 'opacity-90' : 'opacity-0 group-hover:opacity-100',
              'hover:bg-white',
            )}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={nextImage}
            className={cn(
              'absolute right-2 top-1/2 z-[15] -translate-y-1/2 rounded-full bg-white/90 shadow-md transition-all',
              'flex min-h-11 min-w-11 items-center justify-center p-0',
              isMobile ? 'opacity-90' : 'opacity-0 group-hover:opacity-100',
              'hover:bg-white',
            )}
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        </>
      )}
      
      {/* Action buttons stack: Share + Favorite */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        {onShareClick && (
          <button
            type="button"
            onClick={onShareClick}
            data-testid="card-share-button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 p-0 shadow-md transition-all hover:bg-white hover:scale-105 active:scale-95"
            aria-label={shareLabel || 'Share'}
            title={shareLabel || 'Share'}
          >
            <Share2 className="h-4 w-4 text-slate-700" />
          </button>
        )}
        <button
          type="button"
          onClick={onFavoriteClick}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 p-0 shadow-md transition-all hover:bg-white hover:scale-105 active:scale-95"
          aria-label={isFavorite ? (favoriteRemoveLabel || 'Remove from favorites') : (favoriteAddLabel || 'Add to favorites')}
          title={isFavorite ? favoriteRemoveLabel : favoriteAddLabel}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-red-500 text-red-500" : "text-slate-700"
            )}
          />
        </button>
      </div>
      
      {/* Image indicators */}
      {imagesProxied.length > 1 && (
        <div className="absolute bottom-2 left-1/2 z-[8] flex -translate-x-1/2 gap-1">
          {imagesProxied.map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                idx === currentIndex ? "bg-white w-4" : "bg-white/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
