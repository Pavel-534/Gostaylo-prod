'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { buildOrderTimelineModel, normalizeOrderType } from '@/lib/orders/order-timeline'

/**
 * Горизонтальный прогресс брони для шапки чата (компактно на мобилках).
 * @param {'default'|'slim'} [variant] — slim: без заголовка, меньше круги (админ-тред).
 */
export function BookingChatTimeline({ booking, language = 'ru', variant = 'default' }) {
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

  const type = normalizeOrderType(
    booking?.unified_order?.type ||
      booking?.listing?.category_slug ||
      booking?.listings?.category_slug ||
      booking?.metadata?.listing_category_slug,
  )
  const steps = buildOrderTimelineModel({
    status: st,
    type,
    mode: 'chat',
    reviewed: false,
    checkOutIso: booking?.check_out || booking?.checkOut || null,
  })
  const title = getUIText('chatBookingTimelineTitle', language)
  const slim = variant === 'slim'

  return (
    <div
      className={cn(
        'border-t border-slate-100/90 bg-slate-50/80 backdrop-blur-[2px]',
        slim ? 'px-2 py-0.5 pb-1' : 'px-2 pb-1.5 pt-1 md:px-3 md:pb-2 md:pt-1.5'
      )}
    >
      {!slim ? (
        <p className="mb-0.5 text-center text-[8px] font-semibold uppercase tracking-wide text-slate-500 md:mb-1 md:text-left md:text-[9px]">
          {title}
        </p>
      ) : null}
      <div className="flex w-full max-w-none items-start justify-between gap-0.5 md:justify-start md:gap-1">
        {steps.map((step, idx) => {
          const { done, current } = step
          const label = getUIText(step.labelKey, language)
          const showLine = idx < steps.length - 1
          const lineGreen = steps[idx].done

          return (
            <div key={step.id} className="flex min-w-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full border-2 font-bold transition-colors',
                    slim
                      ? 'h-3 w-3 text-[5px] sm:h-3.5 sm:w-3.5 sm:text-[6px]'
                      : 'h-4 w-4 text-[7px] sm:h-5 sm:w-5 sm:text-[8px] md:h-6 md:w-6 md:text-[10px]',
                    done
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : current
                        ? 'border-teal-500 bg-white text-teal-700 ring-1 ring-teal-200/80'
                        : 'border-slate-200 bg-white text-slate-400'
                  )}
                >
                  {done ? (
                    <Check
                      className={cn(
                        slim ? 'h-1.5 w-1.5' : 'h-2 w-2 sm:h-2.5 sm:w-2.5 md:h-3 md:w-3'
                      )}
                      strokeWidth={3}
                    />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-0.5 w-full px-0.5 text-center font-medium leading-[1.1]',
                    slim
                      ? 'text-[5px] sm:text-[6px]'
                      : 'text-[6px] sm:text-[7px] md:mt-1 md:text-[9px]',
                    done || current ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {showLine ? (
                <div
                  className={cn(
                    'h-px min-w-[2px] flex-1 shrink self-start rounded-full',
                    slim ? 'mt-1.5' : 'mt-2 sm:mt-2.5 md:mt-3',
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
