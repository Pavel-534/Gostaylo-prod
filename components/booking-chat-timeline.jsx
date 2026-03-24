'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'inquiry', labelRu: 'Запрос', labelEn: 'Inquiry' },
  { key: 'confirmed', labelRu: 'Подтверждено', labelEn: 'Confirmed' },
  { key: 'paid', labelRu: 'Оплачено', labelEn: 'Paid' },
  { key: 'completed', labelRu: 'Завершено', labelEn: 'Completed' },
]

function stepStates(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'COMPLETED') {
    return STEPS.map(() => ({ done: true, current: false }))
  }
  if (s === 'PAID' || s === 'PAID_ESCROW') {
    return STEPS.map((_, i) => ({
      done: i < 2,
      current: i === 2,
    }))
  }
  if (s === 'CONFIRMED') {
    return STEPS.map((_, i) => ({
      done: i < 1,
      current: i === 1,
    }))
  }
  return STEPS.map((_, i) => ({
    done: false,
    current: i === 0,
  }))
}

/**
 * Горизонтальный прогресс брони для шапки чата.
 */
export function BookingChatTimeline({ booking, language = 'ru' }) {
  if (!booking?.status) return null
  const st = String(booking.status).toUpperCase()
  const isRu = language !== 'en'

  if (['CANCELLED', 'REFUNDED', 'REJECTED'].includes(st)) {
    return (
      <div className="px-4 pb-3 pt-0 border-t border-slate-100 bg-rose-50/80">
        <p className="text-xs font-medium text-rose-900 py-2 text-center">
          {isRu
            ? st === 'REFUNDED'
              ? 'Бронь возвращена / возврат'
              : 'Бронирование отменено'
            : st === 'REFUNDED'
              ? 'Booking refunded'
              : 'Booking cancelled'}
        </p>
      </div>
    )
  }

  const states = stepStates(st)

  return (
    <div className="px-3 sm:px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/90">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2 text-center sm:text-left">
        {isRu ? 'Статус бронирования' : 'Booking progress'}
      </p>
      <div className="flex items-start justify-center sm:justify-start w-full max-w-xl">
        {STEPS.map((step, idx) => {
          const { done, current } = states[idx]
          const label = isRu ? step.labelRu : step.labelEn
          const showLine = idx < STEPS.length - 1
          const lineGreen = states[idx].done

          return (
            <div key={step.key} className="flex items-start flex-1 min-w-0 max-w-[5.5rem] sm:max-w-none">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={cn(
                    'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition-colors',
                    done
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : current
                        ? 'bg-white border-teal-500 text-teal-700 ring-2 ring-teal-200'
                        : 'bg-white border-slate-200 text-slate-400'
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] sm:text-xs font-medium text-center leading-tight px-0.5 w-full',
                    done || current ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {showLine ? (
                <div
                  className={cn(
                    'h-0.5 flex-1 mt-3.5 sm:mt-4 min-w-[4px] rounded-full shrink',
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
