'use client'

import { useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

/**
 * Многострочное поле как в мессенджерах: растёт по высоте, Enter — отправка, Shift+Enter — новая строка.
 */
export function ChatGrowingTextarea({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  maxHeightPx = 128,
  minHeightPx = 40,
}) {
  const ref = useRef(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeightPx ? 'auto' : 'hidden'
  }, [maxHeightPx, minHeightPx])

  useEffect(() => {
    resize()
  }, [value, resize])

  return (
    <textarea
      ref={ref}
      data-testid="chat-composer-textarea"
      value={value}
      rows={1}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        'flex-1 min-w-0 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm',
        'ring-offset-background placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-none leading-snug',
        className
      )}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          e.currentTarget.form?.requestSubmit()
        }
      }}
    />
  )
}
