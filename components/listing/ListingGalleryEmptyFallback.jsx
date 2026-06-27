'use client'

import { AirentoMark } from '@/components/brand/airento-mark'
import { getUIText } from '@/lib/translations'
import {
  PDP_HERO_DESKTOP_CLASS,
  PDP_HERO_MOBILE_CLASS,
  PDP_HERO_SECTION_MB,
} from '@/lib/listing/pdp-hero-layout'

/**
 * Zero-photo listing hero — fixed height, branded placeholder (Stage 171.23).
 */
export function ListingGalleryEmptyFallback({ language = 'ru', className = '' }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-100 ${PDP_HERO_SECTION_MB} ${className}`}
      aria-hidden
    >
      <div
        className={`flex md:hidden w-full flex-col items-center justify-center gap-3 ${PDP_HERO_MOBILE_CLASS}`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <AirentoMark size={34} />
        </div>
        <p className="max-w-[12rem] text-center text-sm text-slate-500">
          {getUIText('listingGallery_noPhotos', language)}
        </p>
      </div>
      <div
        className={`hidden md:flex w-full flex-col items-center justify-center gap-3 ${PDP_HERO_DESKTOP_CLASS}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
          <AirentoMark size={40} />
        </div>
        <p className="max-w-xs text-center text-sm text-slate-500">
          {getUIText('listingGallery_noPhotos', language)}
        </p>
      </div>
    </div>
  )
}
