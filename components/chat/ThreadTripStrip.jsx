'use client'

import { CalendarRange, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { buildThreadTripStripModel } from '@/lib/chat/thread-trip-strip-model'

/**
 * Stage 196.0-C — tappable trip context under chat header → ThreadDealDetailsSheet.
 */
export function ThreadTripStrip({
  booking = null,
  language = 'ru',
  isHosting = false,
  onOpenDealDetails,
  className,
  compact = false,
}) {
  const model = buildThreadTripStripModel({
    booking,
    language,
    isHosting,
    getUIText,
  })
  if (!model || typeof onOpenDealDetails !== 'function') return null

  const segments = []
  if (model.datesLabel) {
    segments.push({ key: 'dates', node: <span>{model.datesLabel}</span> })
  }
  if (model.statusLabel) {
    segments.push({
      key: 'status',
      node: (
        <span className="inline-flex rounded-full bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-brand-hover ring-1 ring-brand/20">
          {model.statusLabel}
        </span>
      ),
    })
  }
  if (model.amountLabel) {
    segments.push({
      key: 'amount',
      node: <span className="font-semibold text-slate-900">{model.amountLabel}</span>,
    })
  }

  return (
    <button
      type="button"
      data-testid="thread-trip-strip"
      onClick={onOpenDealDetails}
      className={cn(
        'flex w-full min-h-11 items-center gap-2 border-t border-brand/15 bg-brand/5 px-3 text-left transition-colors',
        'hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-inset',
        compact ? 'py-2' : 'py-2.5',
        className,
      )}
      aria-label={getUIText('messengerThread_dealDetailsAria', language)}
    >
      <CalendarRange className="h-4 w-4 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 sm:text-sm">
        {segments.map((seg, idx) => (
          <span key={seg.key}>
            {idx > 0 ? (
              <span className="mx-1.5 text-slate-300" aria-hidden>
                •
              </span>
            ) : null}
            {seg.node}
          </span>
        ))}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-brand/70" aria-hidden />
    </button>
  )
}
