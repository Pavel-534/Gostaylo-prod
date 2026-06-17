'use client'

import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { getHostMoneyStage } from '@/lib/booking/host-money-stage'

const FLOW = ['protected', 'releasing', 'ready', 'paid_out']

function stepLabel(step, language) {
  if (step === 'protected') return getUIText('hostTimeline_protected', language)
  if (step === 'releasing') return getUIText('hostTimeline_releasing', language)
  if (step === 'ready') return getUIText('hostTimeline_ready', language)
  return getUIText('hostTimeline_paid', language)
}

/**
 * Compact host money timeline visual for partner surfaces.
 */
export function HostMoneyTimelineChip({
  status,
  language = 'ru',
  bookingContext = null,
  className,
  compact = false,
}) {
  const stage = getHostMoneyStage(status, language, bookingContext)
  if (!stage) return null
  if (!FLOW.includes(stage.stage)) return null

  const currentIdx = FLOW.indexOf(stage.stage)
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2',
        compact ? 'space-y-1.5' : 'space-y-2',
        className,
      )}
      data-testid="host-money-timeline-chip"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {getUIText('hostTimeline_title', language)}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {FLOW.map((step, idx) => {
          const done = idx <= currentIdx
          return (
            <div key={step} className="min-w-0">
              <div
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors',
                  done ? 'bg-brand' : 'bg-slate-200',
                )}
              />
              <p
                className={cn(
                  'mt-1 leading-tight',
                  compact ? 'text-[10px]' : 'text-[11px]',
                  done ? 'text-slate-800 font-medium' : 'text-slate-400',
                )}
              >
                {stepLabel(step, language)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

