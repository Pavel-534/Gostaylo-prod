'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/**
 * Thumbnail strip + lightbox for review image URLs (proxy or absolute).
 */
export function ReviewPhotosGallery({ photos = [], className = '' }) {
  const list = Array.isArray(photos) ? photos.filter(Boolean) : []
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  if (list.length === 0) {
    return null
  }

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {list.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => {
              setIndex(i)
              setOpen(true)
            }}
            className="relative h-16 w-16 overflow-hidden rounded-md border border-slate-200 bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
          >
            <img src={src} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-2 sm:p-4">
          <DialogTitle className="sr-only">Review photo</DialogTitle>
          <img
            src={list[index]}
            alt=""
            className="mx-auto max-h-[70vh] w-full rounded-md object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
