'use client'

/**
 * BentoGallery — Airbnb-style image grid (desktop) + swipe carousel (mobile).
 * URLs: main quality from `getPdpHeroImageUrls` (SSOT `lib/media/image-delivery.js`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { getUIText } from '@/lib/translations'
import {
  PDP_HERO_DESKTOP_CLASS,
  PDP_HERO_MOBILE_CLASS,
  PDP_HERO_SECTION_MB,
} from '@/lib/listing/pdp-hero-layout'

const MOBILE_SHELL = `md:hidden relative ${PDP_HERO_SECTION_MB} rounded-2xl overflow-hidden ${PDP_HERO_MOBILE_CLASS}`
const MOBILE_SLIDE = `relative block w-full ${PDP_HERO_MOBILE_CLASS} bg-slate-100`

export function BentoGallery({
  images,
  title,
  language = 'en',
  onImageClick,
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
}) {
  const displayUrls = useMemo(() => (images || []).filter(Boolean), [images])
  const [carouselApi, setCarouselApi] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const showBentoSecondary = displayUrls.length > 1

  const openAt = useCallback(
    (index) => {
      const i = Math.max(0, Math.min(index, (displayUrls?.length || 1) - 1))
      onImageClick?.(i)
    },
    [displayUrls?.length, onImageClick],
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

  if (!displayUrls.length) {
    return null
  }

  return (
    <>
      {/* Mobile — explicit slide heights (Embla viewport inherits via carousel.jsx h-full). */}
      <div className={MOBILE_SHELL} data-testid="listing-pdp-hero-mobile">
        <Carousel
          setApi={setCarouselApi}
          opts={{ align: 'start', loop: displayUrls.length > 1 }}
          className="h-full w-full"
        >
          <CarouselContent className="-ml-0 h-full">
            {displayUrls.map((src, idx) => (
              <CarouselItem key={`${src}-${idx}`} className="pl-0 basis-full h-full">
                <button
                  type="button"
                  className={MOBILE_SLIDE}
                  onClick={() => openAt(idx)}
                >
                  <Image
                    src={src}
                    alt={idx === 0 ? title : `${title} ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={idx === 0}
                    placeholder="blur"
                    blurDataURL={blurDataURL}
                    unoptimized={isRemoteHttpImageSrc(src)}
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {displayUrls.length > 1 ? (
          <>
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {displayUrls.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === carouselIndex ? 'w-6 bg-white shadow' : 'w-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
            <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
              {carouselIndex + 1}/{displayUrls.length}
            </div>
          </>
        ) : null}
      </div>

      {/* Desktop — Airbnb bento 1+4 */}
      <div
        data-testid="listing-pdp-hero-desktop"
        className={`hidden md:grid grid-cols-4 grid-rows-2 gap-2 ${PDP_HERO_DESKTOP_CLASS} ${PDP_HERO_SECTION_MB} cursor-pointer overflow-hidden rounded-2xl`}
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
        {displayUrls[0] ? (
          <div
            className={`group relative overflow-hidden bg-slate-100 ${
              showBentoSecondary ? 'col-span-2 row-span-2' : 'col-span-4 row-span-2'
            }`}
          >
            <Image
              src={displayUrls[0]}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              sizes="50vw"
              priority
              placeholder="blur"
              blurDataURL={blurDataURL}
              unoptimized={isRemoteHttpImageSrc(displayUrls[0])}
            />
            {!showBentoSecondary && displayUrls.length > 1 ? (
              <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
                +{displayUrls.length - 1} {getUIText('listingGallery_morePhotos', language)}
              </div>
            ) : null}
          </div>
        ) : null}

        {showBentoSecondary
          ? displayUrls.slice(1, 5).map((img, idx) => (
              <div key={`${img}-${idx}`} className="group relative overflow-hidden bg-slate-100">
                <Image
                  src={img}
                  alt={`${title} ${idx + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  sizes="25vw"
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                  unoptimized={isRemoteHttpImageSrc(img)}
                />
                {idx === 3 && displayUrls.length > 5 ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Button variant="secondary" size="sm" type="button">
                      +{displayUrls.length - 5} {getUIText('listingGallery_morePhotos', language)}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          : null}
      </div>
    </>
  )
}
