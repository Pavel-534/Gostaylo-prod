'use client'

import { useCallback, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProxiedImage } from '@/components/proxied-image'
import { cn } from '@/lib/utils'

/**
 * Sortable photo grid — pointer reorder (touch + mouse) + cover badge on index 0.
 */
export function ListingPhotoSortGrid({
  images = [],
  onReorder,
  onRemove,
  coverLabel = 'Cover',
  reorderHint = '',
}) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const dragIndexRef = useRef(null)
  const overIndexRef = useRef(null)

  const setDragState = useCallback((from, to) => {
    dragIndexRef.current = from
    overIndexRef.current = to
    setDragIndex(from)
    setOverIndex(to)
  }, [])

  const clearDragState = useCallback(() => {
    dragIndexRef.current = null
    overIndexRef.current = null
    setDragIndex(null)
    setOverIndex(null)
  }, [])

  const findIndexAtPoint = useCallback((x, y) => {
    if (typeof document === 'undefined') return null
    const el = document.elementFromPoint(x, y)
    const node = el?.closest('[data-photo-index]')
    if (!node) return null
    const idx = Number(node.getAttribute('data-photo-index'))
    return Number.isFinite(idx) ? idx : null
  }, [])

  const finishDrag = useCallback(
    (from, to) => {
      if (from !== null && to !== null && from !== to) {
        onReorder?.(from, to)
      }
      clearDragState()
    },
    [onReorder, clearDragState],
  )

  const handleGripPointerDown = useCallback(
    (e, idx) => {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      setDragState(idx, idx)
    },
    [setDragState],
  )

  const handleGripPointerMove = useCallback(
    (e) => {
      if (dragIndexRef.current === null) return
      const target = findIndexAtPoint(e.clientX, e.clientY)
      if (target !== null) {
        overIndexRef.current = target
        setOverIndex(target)
      }
    },
    [findIndexAtPoint],
  )

  const handleGripPointerUp = useCallback(
    (e) => {
      if (dragIndexRef.current === null) return
      e.preventDefault()
      const target =
        findIndexAtPoint(e.clientX, e.clientY) ?? overIndexRef.current ?? dragIndexRef.current
      finishDrag(dragIndexRef.current, target)
    },
    [finishDrag, findIndexAtPoint],
  )

  const handleGripPointerCancel = useCallback(() => {
    clearDragState()
  }, [clearDragState])

  const handleDragStart = useCallback(
    (e, idx) => {
      setDragState(idx, idx)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(idx))
    },
    [setDragState],
  )

  const handleDragOver = useCallback((e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    overIndexRef.current = idx
    setOverIndex(idx)
  }, [])

  const handleDrop = useCallback(
    (e, idx) => {
      e.preventDefault()
      const from =
        dragIndexRef.current ??
        (() => {
          const raw = e.dataTransfer.getData('text/plain')
          const n = parseInt(raw, 10)
          return Number.isFinite(n) ? n : null
        })()
      finishDrag(from, idx)
    },
    [finishDrag],
  )

  if (!images.length) return null

  return (
    <div className="space-y-2">
      {reorderHint ? <p className="text-xs text-slate-500">{reorderHint}</p> : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4">
        {images.map((img, idx) => {
          const isDragging = dragIndex === idx
          const isDropTarget = overIndex === idx && dragIndex !== null && dragIndex !== idx

          return (
            <div
              key={`${img}-${idx}`}
              data-photo-index={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleGripPointerCancel}
              className={cn(
                'group relative aspect-square touch-manipulation overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition-shadow',
                isDragging && 'z-10 scale-[0.97] opacity-80 shadow-lg ring-2 ring-brand/40',
                isDropTarget && 'ring-2 ring-brand ring-offset-2',
              )}
            >
              <ProxiedImage src={img} alt="" fill className="object-cover" sizes="25vw" draggable={false} />
              {idx === 0 ? (
                <Badge className="absolute left-2 top-2 z-[2] bg-brand text-white shadow-sm">
                  {coverLabel}
                </Badge>
              ) : null}
              <button
                type="button"
                aria-label="Reorder photo"
                className="absolute bottom-2 left-2 z-[2] flex min-h-[44px] min-w-[44px] cursor-grab items-center justify-center rounded-lg border border-white/80 bg-black/45 text-white active:cursor-grabbing touch-none"
                onPointerDown={(e) => handleGripPointerDown(e, idx)}
                onPointerMove={handleGripPointerMove}
                onPointerUp={handleGripPointerUp}
                onPointerCancel={handleGripPointerCancel}
              >
                <GripVertical className="h-5 w-5" aria-hidden />
              </button>
              <Button
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 z-[2] min-h-[44px] min-w-[44px] opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove?.(idx)
                }}
              >
                ×
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
