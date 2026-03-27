'use client'

/**
 * ChatImageCollage — группирует 2+ последовательных изображений одного отправителя
 * в компактный коллаж-сетку с Lightbox-просмотром.
 *
 * Использование:
 *   <ChatImageCollage images={[{id, url, alt}]} onOpenLightbox={(idx) => ...} />
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'

// ─── Сетка коллажа ────────────────────────────────────────────────────────────

const GRID_CFG = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2',      // 2+1
  4: 'grid-cols-2',
  5: 'grid-cols-3',
  6: 'grid-cols-3',
}

function gridClass(n) {
  return GRID_CFG[Math.min(n, 6)] || 'grid-cols-3'
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

export function ChatLightbox({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const n = images.length
  const prev = () => setIdx((i) => (i > 0 ? i - 1 : n - 1))
  const next = () => setIdx((i) => (i < n - 1 ? i + 1 : 0))

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Просмотр фото"
    >
      {/* Закрыть */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
        aria-label="Закрыть"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Счётчик */}
      {n > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium tabular-nums">
          {idx + 1} / {n}
        </div>
      )}

      {/* Изображение */}
      <img
        src={images[idx].url}
        alt={images[idx].alt || ''}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Стрелки */}
      {n > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); prev() }}
            aria-label="Предыдущее"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); next() }}
            aria-label="Следующее"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Превью-стрипа */}
      {n > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80vw] overflow-x-auto px-2">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={(e) => { e.stopPropagation(); setIdx(i) }}
              className={cn(
                'shrink-0 rounded overflow-hidden border-2 transition-all',
                i === idx ? 'border-white opacity-100' : 'border-transparent opacity-50 hover:opacity-75',
              )}
            >
              <img src={img.url} alt="" className="w-10 h-10 object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Коллаж ───────────────────────────────────────────────────────────────────

/**
 * @param {{ id: string, url: string, alt?: string }[]} images
 * @param {boolean} isOwn
 */
export function ChatImageCollage({ images, isOwn }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [singleLoaded, setSingleLoaded] = useState(false)

  const visible = images.slice(0, 6)
  const extra = images.length > 6 ? images.length - 6 : 0
  const n = visible.length

  if (n === 0) return null

  const single = n === 1
  const singleUrl = single ? visible[0]?.url : null

  useEffect(() => {
    setSingleLoaded(false)
  }, [singleUrl])

  return (
    <>
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          isOwn ? 'rounded-tr-none' : 'rounded-tl-none',
          single ? 'max-w-[min(100%,280px)]' : 'w-[min(100%,280px)]',
        )}
      >
        {single ? (
          <button
            type="button"
            className="relative block w-full max-w-[min(100%,280px)] group text-left"
            onClick={() => setLightboxIdx(0)}
            aria-label="Открыть фото"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
              {!singleLoaded && (
                <div
                  className="absolute inset-0 z-[1] animate-pulse bg-slate-200"
                  aria-hidden
                />
              )}
              <img
                src={visible[0].url}
                alt={visible[0].alt || ''}
                className={cn(
                  'h-full w-full object-cover transition-opacity duration-200',
                  singleLoaded ? 'opacity-100' : 'opacity-0',
                )}
                loading="lazy"
                decoding="async"
                onLoad={() => setSingleLoaded(true)}
              />
            </div>
            <span className="pointer-events-none absolute inset-0 z-[2] bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ZoomIn className="h-6 w-6 text-white drop-shadow" />
            </span>
          </button>
        ) : (
          <div className={cn('grid gap-0.5', gridClass(n))}>
            {visible.map((img, i) => {
              const isLast = i === n - 1 && extra > 0
              return (
                <button
                  type="button"
                  key={img.id ?? i}
                  className="relative overflow-hidden aspect-square group bg-slate-100"
                  onClick={() => setLightboxIdx(i)}
                  aria-label={`Фото ${i + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || ''}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                    decoding="async"
                  />
                  {isLast ? (
                    <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-lg font-bold">
                      +{extra}
                    </span>
                  ) : (
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <ChatLightbox
          images={images}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  )
}

/**
 * Группирует сообщения-изображения от одного отправителя в массивы.
 * Возвращает новый список «рендер-элементов», где группы изображений
 * превратились в { _imageGroup: true, messages: [...] }.
 *
 * @param {object[]} messages
 * @returns {object[]}
 */
export function groupConsecutiveImages(messages) {
  const result = []
  let i = 0
  while (i < messages.length) {
    const msg = messages[i]
    const type = (msg.type || '').toLowerCase()
    const hasUrl = !!(msg.metadata?.image_url || msg.metadata?.url)

    if (type === 'image' && hasUrl) {
      const group = [msg]
      while (
        i + 1 < messages.length &&
        (messages[i + 1].type || '').toLowerCase() === 'image' &&
        !!(messages[i + 1].metadata?.image_url || messages[i + 1].metadata?.url) &&
        messages[i + 1].sender_id === msg.sender_id
      ) {
        i++
        group.push(messages[i])
      }
      if (group.length >= 2) {
        result.push({ _imageGroup: true, id: `_grp_${msg.id}`, messages: group })
      } else {
        result.push(msg)
      }
    } else {
      result.push(msg)
    }
    i++
  }
  return result
}
