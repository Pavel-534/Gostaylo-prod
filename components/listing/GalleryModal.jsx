/**
 * GalleryModal — full-screen image gallery with navigation.
 * Lightbox URLs + sizes from `lib/media/image-delivery.js` (Stage 171.21).
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
        style={{ maxHeight: '100dvh' }}
        className={
          'h-[100dvh] w-full max-w-none gap-0 border-0 bg-black p-0 shadow-none ' +
          'left-0 top-0 translate-x-0 translate-y-0 rounded-none ' +
          'sm:left-[50%] sm:top-[50%] sm:h-[90vh] sm:max-w-6xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:shadow-2xl'
        }
      >
        <div
          className="relative flex h-full w-full items-center justify-center bg-black touch-pan-y"
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

          <div className="relative w-full h-full flex items-center justify-center">
            {currentSrc ? (
              <Image
                key={currentSrc}
                src={currentSrc}
                alt={`${listingTitle} ${currentIndex + 1}`}
                fill
                className="object-contain"
                sizes={lightboxSizes}
                placeholder="blur"
                blurDataURL={blurDataURL}
                unoptimized={isRemoteHttpImageSrc(currentSrc)}
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
