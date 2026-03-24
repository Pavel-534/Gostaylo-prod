/**
 * GalleryModal Component
 * Full-screen image gallery with navigation
 */

'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export function GalleryModal({
  open,
  onOpenChange,
  images,
  currentIndex,
  onIndexChange,
  listingTitle
}) {
  const handlePrev = () => {
    onIndexChange((currentIndex - 1 + images.length) % images.length)
  }
  
  const handleNext = () => {
    onIndexChange((currentIndex + 1) % images.length)
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
        <div className="relative flex h-full w-full items-center justify-center bg-black">
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
            <Image
              src={images[currentIndex]}
              alt={`${listingTitle} ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
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
