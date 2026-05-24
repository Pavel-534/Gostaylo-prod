'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  resolveImageMainUrl,
  resolveImageThumbDisplayUrl,
} from '@/lib/image-display-url'

/**
 * Thumbnail strip + lightbox for review image URLs (proxy or absolute).
 */
export function ReviewPhotosGallery({ photos = [], className = '' }) {
  const rawList = Array.isArray(photos) ? photos.filter(Boolean) : []
  const thumbs = useMemo(
    () => rawList.map((p) => resolveImageThumbDisplayUrl(p) || resolveImageMainUrl(p)).filter(Boolean),
    [rawList],
  )
  const fullUrls = useMemo(
    () => rawList.map((p) => resolveImageMainUrl(p)).filter(Boolean),
    [rawList],
  )
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  if (thumbs.length === 0) {
    return null
  }

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {thumbs.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => {
              setIndex(i)
              setOpen(true)
            }}
            className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-4">
          <DialogTitle className="sr-only">Review photo</DialogTitle>
          <img
            src={fullUrls[index] || thumbs[index]}
            alt=""
            className="mx-auto max-h-[70vh] w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
