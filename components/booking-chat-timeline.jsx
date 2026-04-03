'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'

const STEP_KEYS = [
  'chatBookingStep_request',
  'chatBookingStep_confirmed',
  'chatBookingStep_paid',
  'chatBookingStep_completed',
]

function stepStates(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'COMPLETED') {
    return STEP_KEYS.map(() => ({ done: true, current: false }))
  }
  if (s === 'PAID' || s === 'PAID_ESCROW') {
    return STEP_KEYS.map((_, i) => ({
      done: i < 2,
      current: i === 2,
    }))
  }
  if (s === 'CONFIRMED') {
    return STEP_KEYS.map((_, i) => ({
      done: i < 1,
      current: i === 1,
    }))
  }
  return STEP_KEYS.map((_, i) => ({
    done: false,
    current: i === 0,
  }))
}

/**
 * Горизонтальный прогресс брони для шапки чата (компактно на мобилках).
 */
export function BookingChatTimeline({ booking, language = 'ru' }) {
  if (!booking?.status) return null
  const st = String(booking.status).toUpperCase()

  if (['CANCELLED', 'REFUNDED', 'REJECTED', 'DECLINED'].includes(st)) {
    const banner =
      st === 'REFUNDED'
        ? getUIText('chatBookingStatus_REFUNDED', language)
        : st === 'DECLINED'
          ? getUIText('chatBookingStatus_DECLINED', language)
          : getUIText('chatBookingStatus_CANCELLED', language)
    return (
      <div className="border-t border-slate-100 bg-rose-50/80 px-2 py-1 md:px-3 md:py-1.5">
        <p className="text-center text-[10px] font-medium text-rose-900 md:text-xs">{banner}</p>
      </div>
    )
  }

  const states = stepStates(st)
  const title = getUIText('chatBookingTimelineTitle', language)

  return (
    <div className="border-t border-slate-100/90 bg-slate-50/80 px-2 pb-1.5 pt-1 backdrop-blur-[2px] md:px-3 md:pb-2 md:pt-1.5">
      <p className="mb-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-500 md:mb-1 md:text-left md:text-[9px]">
        {title}
      </p>
      <div className="flex w-full max-w-none items-start justify-between gap-0.5 md:justify-start md:gap-1">
        {STEP_KEYS.map((stepKey, idx) => {
          const { done, current } = states[idx]
          const label = getUIText(stepKey, language)
          const showLine = idx < STEP_KEYS.length - 1
          const lineGreen = states[idx].done

          return (
            <div key={stepKey} className="flex min-w-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[7px] font-bold transition-colors sm:h-5 sm:w-5 sm:text-[8px] md:h-6 md:w-6 md:text-[10px]',
                    done
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : current
                        ? 'border-teal-500 bg-white text-teal-700 ring-1 ring-teal-200/80'
                        : 'border-slate-200 bg-white text-slate-400'
                  )}
                >
                  {done ? (
                    <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-0.5 w-full px-0.5 text-center text-[6px] font-medium leading-[1.1] sm:text-[7px] md:mt-1 md:text-[9px]',
                    done || current ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {showLine ? (
                <div
                  className={cn(
                    'mt-2 h-px min-w-[2px] flex-1 shrink self-start rounded-full sm:mt-2.5 md:mt-3',
                    lineGreen ? 'bg-teal-500' : 'bg-slate-200'
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
