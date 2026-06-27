'use client'

/**
 * BentoGallery — Airbnb-style image grid (desktop) + swipe carousel (mobile).
 * Image delivery SSOT: `lib/media/image-delivery.js` (Stage 171.21).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import {
  resolvePdpHeroImagePriority,
  resolvePdpImageSizes,
  shouldMountPdpBentoSecondary,
  shouldMountPdpCarouselSlide,
} from '@/lib/media/image-delivery'
import { useNetworkQuality } from '@/hooks/use-network-quality'
import { useMediaQuery } from '@/hooks/use-media-query'
import { listingHeroTransitionStyle } from '@/lib/navigation/listing-hero-transition'
import { getUIText } from '@/lib/translations'
import {
  PDP_HERO_DESKTOP_CLASS,
  PDP_HERO_MOBILE_CLASS,
  PDP_HERO_SECTION_MB,
} from '@/lib/listing/pdp-hero-layout'

const MOBILE_GALLERY_CLASS = PDP_HERO_MOBILE_CLASS

export function BentoGallery({
  images,
  title,
  language = 'en',
  onImageClick,
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
  /** Stage 171.22 — shared element morph from catalog card. */
  listingId = null,
}) {
  const networkQuality = useNetworkQuality()
  const isDesktopViewport = useMediaQuery('(min-width: 768px)')
  const heroTransitionStyle = listingHeroTransitionStyle(listingId)
  const displayUrls = useMemo(() => (images || []).filter(Boolean), [images])
  const [carouselApi, setCarouselApi] = useState(null)
  const [carouselIndex, setCarouselIndex] = useState(0)

  const carouselSizes = resolvePdpImageSizes('carousel', networkQuality)
  const bentoLeadSizes = resolvePdpImageSizes('bento-lead', networkQuality)
  const bentoSecondarySizes = resolvePdpImageSizes('bento-secondary', networkQuality)
  /** Desktop: always Airbnb bento when 2+ photos; mobile/save-data may collapse to hero-only. */
  const showBentoSecondary =
    displayUrls.length > 1 &&
    (isDesktopViewport || shouldMountPdpBentoSecondary(networkQuality))

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

  if (!displayUrls || displayUrls.length === 0) {
    return null
  }

  const mobileShellClass = `md:hidden relative ${PDP_HERO_SECTION_MB} rounded-2xl overflow-hidden ${MOBILE_GALLERY_CLASS}`

  const renderMobileHeroImage = (src, idx, priority = false) => (
    <div
      className="absolute inset-0"
      style={idx === 0 ? heroTransitionStyle : undefined}
    >
      <Image
        src={src}
        alt={idx === 0 ? title : `${title} ${idx + 1}`}
        fill
        className="object-cover"
        sizes={carouselSizes}
        priority={priority || resolvePdpHeroImagePriority({ index: idx }, networkQuality)}
        placeholder="blur"
        blurDataURL={blurDataURL}
        unoptimized={isRemoteHttpImageSrc(src)}
      />
    </div>
  )

  return (
    <>
      {/* Mobile: single photo — no Embla (avoids zero-height viewport on 1-slide carousels). */}
      {displayUrls.length === 1 ? (
        <div className={mobileShellClass}>
          <button
            type="button"
            className="relative block h-full w-full bg-slate-100"
            onClick={() => openAt(0)}
          >
            {renderMobileHeroImage(displayUrls[0], 0, true)}
          </button>
        </div>
      ) : (
        <div className={mobileShellClass}>
          <div className="absolute inset-0">
            <Carousel
              setApi={setCarouselApi}
              opts={{ align: 'start', loop: displayUrls.length > 1 && !networkQuality.constrained }}
              className="h-full w-full"
            >
              <CarouselContent className="-ml-0 h-full">
                {displayUrls.map((src, idx) => (
                  <CarouselItem key={idx} className="pl-0 basis-full h-full">
                    <button
                      type="button"
                      className="relative block h-full w-full bg-slate-100"
                      onClick={() => openAt(idx)}
                    >
                      {shouldMountPdpCarouselSlide(idx, carouselIndex, networkQuality)
                        ? renderMobileHeroImage(src, idx)
                        : null}
                    </button>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
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
        </div>
      )}

      {/* Desktop: bento grid */}
      <div
        className={`hidden md:grid grid-cols-4 gap-2 ${PDP_HERO_DESKTOP_CLASS} rounded-2xl overflow-hidden ${PDP_HERO_SECTION_MB} cursor-pointer`}
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
        {displayUrls[0] && (
          <div
            className={`group relative overflow-hidden bg-slate-100 md:col-span-2 md:row-span-2 ${
              showBentoSecondary ? '' : 'md:col-span-4'
            }`}
            style={heroTransitionStyle}
          >
            <Image
              src={displayUrls[0]}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              sizes={bentoLeadSizes}
              priority={resolvePdpHeroImagePriority({ index: 0 }, networkQuality)}
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
        )}

        {showBentoSecondary
          ? displayUrls.slice(1, 5).map((img, idx) => (
              <div key={idx} className="group relative overflow-hidden bg-slate-100">
                <Image
                  src={img}
                  alt={`${title} ${idx + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  sizes={bentoSecondarySizes}
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                  unoptimized={isRemoteHttpImageSrc(img)}
                />
                {idx === 3 && displayUrls.length > 5 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Button variant="secondary" size="sm" type="button">
                      +{displayUrls.length - 5} {getUIText('listingGallery_morePhotos', language)}
                    </Button>
                  </div>
                )}
              </div>
            ))
          : null}
      </div>
    </>
  )
}
