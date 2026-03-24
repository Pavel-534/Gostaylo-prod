'use client'

/**
 * BentoGallery - Airbnb-style image grid (desktop) + swipe carousel (mobile).
 */

import React, { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'

export function BentoGallery({ images, title, language = 'en', onImageClick }) {
  const [carouselApi, setCarouselApi] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const openAt = useCallback(
    (index) => {
      const i = Math.max(0, Math.min(index, (images?.length || 1) - 1))
      onImageClick?.(i)
    },
    [images?.length, onImageClick]
  )

  useEffect(() => {
    if (!carouselApi) return
    const onSelect = () => setCarouselIndex(carouselApi.selectedScrollSnap())
    onSelect()
    carouselApi.on('select', onSelect)
    return () => {
      carouselApi.off('select', onSelect)
    }
  }, [carouselApi])

  if (!images || images.length === 0) {
    return null
  }

  return (
    <>
      {/* Mobile: swipeable gallery */}
      <div className="md:hidden relative mb-12 rounded-2xl overflow-hidden h-[50vh] min-h-[280px] max-h-[520px]">
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: 'start', loop: images.length > 1 }}
          className="h-full w-full"
        >
          <CarouselContent className="-ml-0 h-full">
            {images.map((src, idx) => (
              <CarouselItem key={idx} className="pl-0 basis-full h-full">
                <button
                  type="button"
                  className="relative block w-full h-[50vh] min-h-[280px] max-h-[520px] bg-slate-100"
                  onClick={() => openAt(idx)}
                >
                  <Image
                    src={src}
                    alt={idx === 0 ? title : `${title} ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={idx === 0}
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {images.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === carouselIndex ? 'w-6 bg-white shadow' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
        {images.length > 1 && (
          <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
            {carouselIndex + 1}/{images.length}
          </div>
        )}
      </div>

      {/* Desktop: bento grid */}
      <div
        className="hidden md:grid grid-cols-4 gap-2 h-[50vh] min-h-[400px] max-h-[600px] rounded-2xl overflow-hidden mb-12 cursor-pointer"
        onClick={() => openAt(0)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openAt(0)
          }
        }}
      >
        {images[0] && (
          <div className="relative md:col-span-2 md:row-span-2 bg-slate-100">
            <Image
              src={images[0]}
              alt={title}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="50vw"
              priority
            />
          </div>
        )}

        {images.slice(1, 5).map((img, idx) => (
          <div key={idx} className="relative bg-slate-100">
            <Image
              src={img}
              alt={`${title} ${idx + 2}`}
              fill
              className="object-cover hover:scale-105 transition-transform duration-300"
              sizes="25vw"
            />
            {idx === 3 && images.length > 5 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Button variant="secondary" size="sm">
                  +{images.length - 5} {language === 'ru' ? 'фото' : 'more'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
