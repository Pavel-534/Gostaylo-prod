'use client'

/**
 * PDP gallery — desktop Airbnb bento (1+4), mobile aspect-[4/3] scroll-snap (catalog parity).
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { isHostedListingImageUrl } from '@/lib/listing-image-host-utils'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { getUIText } from '@/lib/translations'
import {
  PDP_HERO_DESKTOP_CLASS,
  PDP_HERO_MOBILE_ASPECT_CLASS,
  PDP_HERO_SECTION_MB,
} from '@/lib/listing/pdp-hero-layout'

function pdpImageUnoptimized(src) {
  return isRemoteHttpImageSrc(src) || isHostedListingImageUrl(src)
}

function PdpHeroImage({ src, alt, sizes, priority = false, blurDataURL, className = 'object-cover' }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      placeholder="blur"
      blurDataURL={blurDataURL}
      unoptimized={pdpImageUnoptimized(src)}
    />
  )
}

export function BentoGallery({
  images,
  title,
  language = 'en',
  onImageClick,
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
}) {
  const displayUrls = useMemo(() => (images || []).filter(Boolean), [images])
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef(null)

  const multiPhoto = displayUrls.length > 1
  const showBentoSecondary = multiPhoto

  const openAt = useCallback(
    (index) => {
      const i = Math.max(0, Math.min(index, displayUrls.length - 1))
      onImageClick?.(i)
    },
    [displayUrls.length, onImageClick],
  )

  const onMobileScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || el.clientWidth <= 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(Math.max(0, Math.min(idx, displayUrls.length - 1)))
  }, [displayUrls.length])

  if (!displayUrls.length) {
    return null
  }

  return (
    <>
      {/* Mobile — catalog-style aspect ratio; no Embla (zero-height bugs on PWA). */}
      <div
        className={`md:hidden ${PDP_HERO_SECTION_MB}`}
        data-testid="listing-pdp-hero-mobile"
      >
        <div
          className={`relative overflow-hidden rounded-2xl bg-slate-100 ${PDP_HERO_MOBILE_ASPECT_CLASS}`}
        >
          {!multiPhoto ? (
            <button
              type="button"
              className="absolute inset-0 block"
              onClick={() => openAt(0)}
            >
              <PdpHeroImage
                src={displayUrls[0]}
                alt={title}
                sizes="100vw"
                priority
                blurDataURL={blurDataURL}
              />
            </button>
          ) : (
            <div
              ref={scrollRef}
              onScroll={onMobileScroll}
              className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            >
              {displayUrls.map((src, idx) => (
                <button
                  key={`${src}-${idx}`}
                  type="button"
                  className="relative h-full min-w-full flex-[0_0_100%] snap-center snap-always"
                  onClick={() => openAt(idx)}
                >
                  <PdpHeroImage
                    src={src}
                    alt={idx === 0 ? title : `${title} ${idx + 1}`}
                    sizes="100vw"
                    priority={idx === 0}
                    blurDataURL={blurDataURL}
                  />
                </button>
              ))}
            </div>
          )}
          {multiPhoto ? (
            <>
              <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {displayUrls.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeIndex ? 'w-6 bg-white shadow' : 'w-1.5 bg-white/60'
                    }`}
                  />
                ))}
              </div>
              <div className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
                {activeIndex + 1}/{displayUrls.length}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Desktop — Airbnb bento; single photo = lead 2×2 + gray placeholders (not full-width banner). */}
      <div
        data-testid="listing-pdp-hero-desktop"
        className={`hidden md:grid grid-cols-4 grid-rows-2 gap-2 ${PDP_HERO_DESKTOP_CLASS} ${PDP_HERO_SECTION_MB} overflow-hidden rounded-2xl`}
      >
        <button
          type="button"
          className="group relative col-span-2 row-span-2 overflow-hidden bg-slate-100 text-left"
          onClick={() => openAt(0)}
        >
          <PdpHeroImage
            src={displayUrls[0]}
            alt={title}
            sizes="50vw"
            priority
            blurDataURL={blurDataURL}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </button>

        {showBentoSecondary
          ? displayUrls.slice(1, 5).map((img, idx) => (
              <button
                key={`${img}-${idx}`}
                type="button"
                className="group relative overflow-hidden bg-slate-100"
                onClick={() => openAt(idx + 1)}
              >
                <PdpHeroImage
                  src={img}
                  alt={`${title} ${idx + 2}`}
                  sizes="25vw"
                  blurDataURL={blurDataURL}
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
                {idx === 3 && displayUrls.length > 5 ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-md bg-white px-3 py-1.5 text-sm font-medium">
                      +{displayUrls.length - 5} {getUIText('listingGallery_morePhotos', language)}
                    </span>
                  </div>
                ) : null}
              </button>
            ))
          : [0, 1, 2, 3].map((slot) => (
              <div
                key={`placeholder-${slot}`}
                className="bg-slate-100"
                aria-hidden
              />
            ))}
      </div>
    </>
  )
}
