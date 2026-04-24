/**
 * CardImageCarousel Component
 * Image carousel for listing cards with navigation
 */

'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mapPublicImageUrls, isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'

const PLACEHOLDER = '/placeholder.svg'

export function CardImageCarousel({
  images,
  title,
  isFavorite,
  onFavoriteClick,
  onImageLoad,
  /** Ссылка на карточку: прозрачный оверлей под сердцем и стрелками (кнопки не внутри одного anchor). */
  detailHref = null,
  /** Stage 33 — бейдж скидки поверх фото (pointer-events: none). */
  topLeftBadge = null,
  /** Низкокачественный плейсхолдер (LQIP), иначе нейтральный blur. */
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
}) {
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

  return (
    <div 
      className="relative aspect-[4/3] overflow-hidden bg-slate-100 md:group-hover:overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image
        src={displaySrc}
        alt={`${title} - Photo ${currentIndex + 1}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        placeholder="blur"
        blurDataURL={blurDataURL}
        unoptimized={unoptimized}
        className={cn(
          'object-cover transition-all duration-500',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          'group-hover:scale-105'
        )}
        onLoad={handleLoad}
        onError={() => {
          setFailed((f) => ({ ...f, [currentIndex]: true }))
          setImageLoaded(true)
        }}
        priority={currentIndex === 0}
      />
      {detailHref ? (
        <Link
          href={detailHref}
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
      {imagesProxied.length > 1 && isHovered && (
        <>
          <button
            type="button"
            onClick={prevImage}
            className="absolute left-2 top-1/2 z-[15] -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md transition-all hover:bg-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={nextImage}
            className="absolute right-2 top-1/2 z-[15] -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-md transition-all hover:bg-white"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        </>
      )}
      
      {/* Favorite button */}
      <button
        type="button"
        onClick={onFavoriteClick}
        className="absolute right-3 top-3 z-20 rounded-full bg-white/90 p-2 shadow-md transition-all hover:bg-white"
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart 
          className={cn(
            "h-4 w-4 transition-colors",
            isFavorite ? "fill-red-500 text-red-500" : "text-slate-700"
          )} 
        />
      </button>
      
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
