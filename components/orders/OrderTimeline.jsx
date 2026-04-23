'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { buildOrderTimelineModel } from '@/lib/orders/order-timeline'

export default function OrderTimeline({
  status,
  type = 'home',
  language = 'ru',
  reviewed = false,
  checkOut = null,
}) {
  const steps = buildOrderTimelineModel({
    status,
    type,
    mode: 'order',
    reviewed,
    checkOutIso: checkOut,
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {getUIText('orderTimeline_title', language)}
      </p>
      <div className="flex w-full items-start justify-between gap-1">
        {steps.map((step, idx) => {
          const showLine = idx < steps.length - 1
          return (
            <div key={step.id} className="flex min-w-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px] font-bold',
                    step.done
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : step.current
                        ? 'border-teal-500 bg-white text-teal-700 ring-1 ring-teal-200/80'
                        : 'border-slate-200 bg-white text-slate-400',
                    step.disabled ? 'opacity-50' : '',
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'mt-1 w-full px-0.5 text-center text-[10px] font-medium leading-tight',
                    step.done || step.current ? 'text-slate-800' : 'text-slate-400',
                    step.disabled ? 'opacity-70' : '',
                  )}
                >
                  {getUIText(step.labelKey, language)}
                </span>
              </div>
              {showLine ? (
                <div
                  className={cn(
                    'mt-2 h-px min-w-[4px] flex-1 rounded-full',
                    steps[idx].done ? 'bg-teal-500' : 'bg-slate-200',
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
