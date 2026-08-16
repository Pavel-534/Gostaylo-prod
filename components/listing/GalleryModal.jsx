/**
 * GalleryModal — full-screen image gallery with navigation.
 * Lightbox URLs + sizes from `lib/media/image-delivery.js` (Stage 171.21).
 * Stage 201.70 — intrinsic image sizing + forced Dialog height (fixes empty dark overlay
 * when shared DialogContent `sm:!h-auto` collapsed next/image `fill`).
 */

'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { isRemoteHttpImageSrc } from '@/lib/public-image-url'
import { LISTING_CARD_BLUR_DATA_URL } from '@/lib/listing-image-blur'
import { resolvePdpImageSizes } from '@/lib/media/image-delivery'
import { useNetworkQuality } from '@/hooks/use-network-quality'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export function GalleryModal({
  open,
  onOpenChange,
  images,
  currentIndex,
  onIndexChange,
  listingTitle,
  blurDataURL = LISTING_CARD_BLUR_DATA_URL,
}) {
  const touchStartXRef = useRef(null)
  const touchStartYRef = useRef(null)
  const SWIPE_THRESHOLD_PX = 40
  const SWIPE_VERTICAL_GUARD_PX = 48

  const isMobile = useIsMobile()
  const networkQuality = useNetworkQuality()
  const lightboxSizes = resolvePdpImageSizes('lightbox', networkQuality)
  const currentSrc = images[currentIndex]

  const handlePrev = () => {
    onIndexChange((currentIndex - 1 + images.length) % images.length)
  }

  const handleNext = () => {
    onIndexChange((currentIndex + 1) % images.length)
  }

  const handleTouchStart = (event) => {
    if (!isMobile) return
    const touch = event.touches?.[0]
    if (!touch) return
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
  }

  const handleTouchEnd = (event) => {
    if (!isMobile) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    const startX = touchStartXRef.current
    const startY = touchStartYRef.current
    touchStartXRef.current = null
    touchStartYRef.current = null
    if (startX == null || startY == null || images.length <= 1) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY

    // Horizontal swipe only; ignore mostly-vertical gestures to keep scroll feel stable.
    if (Math.abs(deltaY) > SWIPE_VERTICAL_GUARD_PX) return
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return

    if (deltaX < 0) handleNext()
    else handlePrev()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{ height: '100dvh', maxHeight: '100dvh' }}
        className={cn(
          'gap-0 border-0 bg-black p-0 shadow-none',
          // Beat DialogContent defaults (`sm:!h-auto`) so the lightbox has real box size.
          '!inset-0 !left-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none',
          '!translate-x-0 !translate-y-0 rounded-none',
          'sm:!inset-auto sm:!left-[50%] sm:!top-[50%] sm:!h-[90vh] sm:!max-h-[90vh]',
          'sm:!w-full sm:!max-w-6xl sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:rounded-lg sm:shadow-2xl',
        )}
      >
        <div
          className="relative flex h-full min-h-[50vh] w-full flex-col items-center justify-center bg-black touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <DialogClose
            className="absolute z-20 focus:outline-none"
            style={{
              top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
              right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
            }}
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-11 w-11 rounded-full border-0 bg-white/95 text-slate-900 shadow-lg hover:bg-white"
              aria-label="Close gallery"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>

          <div className="flex max-h-full w-full flex-1 items-center justify-center px-2 py-14 sm:px-4">
            {currentSrc ? (
              <Image
                key={currentSrc}
                src={currentSrc}
                alt={`${listingTitle} ${currentIndex + 1}`}
                width={1600}
                height={1200}
                className="h-auto max-h-[min(85dvh,900px)] w-auto max-w-[min(96vw,1152px)] object-contain"
                sizes={lightboxSizes}
                placeholder="blur"
                blurDataURL={blurDataURL}
                unoptimized={isRemoteHttpImageSrc(currentSrc)}
                priority
              />
            ) : null}
          </div>

          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border-0 bg-white/90 shadow-md sm:left-4"
                onClick={handlePrev}
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 z-10 h-11 w-11 -translate-y-1/2 rounded-full border-0 bg-white/90 shadow-md sm:right-4"
                onClick={handleNext}
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          <div
            className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm text-white"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
