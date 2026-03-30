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
      <div className="border-t border-slate-100 bg-rose-50/80 px-2 py-1.5 md:px-4 md:py-2">
        <p className="text-center text-[10px] font-medium text-rose-900 md:text-xs">{banner}</p>
      </div>
    )
  }

  const states = stepStates(st)
  const title = getUIText('chatBookingTimelineTitle', language)

  return (
    <div className="border-t border-slate-100 bg-slate-50/90 px-2 pb-2 pt-0.5 md:px-4 md:pb-3 md:pt-1">
      <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500 md:mb-2 md:text-left md:text-[10px]">
        {title}
      </p>
      <div className="flex w-full max-w-xl items-start justify-center md:justify-start">
        {STEP_KEYS.map((stepKey, idx) => {
          const { done, current } = states[idx]
          const label = getUIText(stepKey, language)
          const showLine = idx < STEP_KEYS.length - 1
          const lineGreen = states[idx].done

          return (
            <div key={stepKey} className="flex min-w-0 max-w-[4.25rem] flex-1 sm:max-w-none">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-colors md:h-7 md:w-7 md:text-xs sm:h-8 sm:w-8',
                    done
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : current
                        ? 'border-teal-500 bg-white text-teal-700 ring-1 ring-teal-200 md:ring-2'
                        : 'border-slate-200 bg-white text-slate-400'
                  )}
                >
                  {done ? (
                    <Check className="h-2.5 w-2.5 md:h-3.5 md:w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-0.5 w-full px-0.5 text-center text-[7px] font-medium leading-tight md:mt-1.5 md:text-[10px] sm:text-xs',
                    done || current ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {showLine ? (
                <div
                  className={cn(
                    'mt-2.5 h-0.5 min-w-[2px] flex-1 shrink rounded-full md:mt-3.5 sm:mt-4',
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
