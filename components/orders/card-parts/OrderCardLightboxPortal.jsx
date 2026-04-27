'use client'

import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getUIText } from '@/lib/translations'

export function OrderCardLightboxPortal({
  language,
  lightboxUrl,
  photoLightboxIndex,
  checkInPhotoUrlsLength,
  onClose,
  onPrev,
  onNext,
}) {
  if (typeof document === 'undefined' || !lightboxUrl) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-black/95 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={getUIText('orderCheckInPhotos_lightboxTitle', language)}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-[2] rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label={getUIText('orderHelp_close', language)}
      >
        <X className="h-6 w-6" />
      </button>
      {checkInPhotoUrlsLength > 1 ? (
        <button
          type="button"
          className="absolute left-2 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:left-6"
          onClick={(e) => {
            e.stopPropagation()
            onPrev()
          }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>
      ) : null}
      {checkInPhotoUrlsLength > 1 ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:right-6"
          onClick={(e) => {
            e.stopPropagation()
            onNext()
          }}
          aria-label="Next"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lightboxUrl}
        alt=""
        className="max-h-[min(92vh,920px)] max-w-[min(96vw,1200px)] object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-center text-xs text-white/70 tabular-nums">
        {photoLightboxIndex != null ? `${photoLightboxIndex + 1} / ${checkInPhotoUrlsLength}` : ''}
      </p>
    </div>,
    document.body,
  )
}
