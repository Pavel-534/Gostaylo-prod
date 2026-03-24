/**
 * CardImageCarousel Component
 * Image carousel for listing cards with navigation
 */

'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mapPublicImageUrls } from '@/lib/public-image-url'

const PLACEHOLDER = '/placeholder.svg'

export function CardImageCarousel({
  images,
  title,
  isFavorite,
  onFavoriteClick,
  onImageLoad
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

  return (
    <div 
      className="relative aspect-[4/3] overflow-hidden group-hover:overflow-visible bg-slate-100"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image
        src={displaySrc}
        alt={`${title} - Photo ${currentIndex + 1}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className={cn(
          "object-cover transition-all duration-500",
          imageLoaded ? "opacity-100" : "opacity-0",
          "group-hover:scale-105"
        )}
        onLoad={handleLoad}
        onError={() => {
          setFailed((f) => ({ ...f, [currentIndex]: true }))
          setImageLoaded(true)
        }}
        priority={currentIndex === 0}
      />
      
      {/* Navigation arrows */}
      {imagesProxied.length > 1 && isHovered && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-4 w-4 text-slate-700" />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all z-10"
            aria-label="Next image"
          >
            <ChevronRight className="h-4 w-4 text-slate-700" />
          </button>
        </>
      )}
      
      {/* Favorite button */}
      <button
        onClick={onFavoriteClick}
        className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all z-10"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
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
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
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
