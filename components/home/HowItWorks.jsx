'use client'

/**
 * HowItWorks — секция «Как это работает» на главной.
 * 3 шага: Найти → Забронировать → Наслаждаться.
 *
 * Дизайн: Premium Air — белый фон, тонкие линии-коннекторы, sans-serif + editorial номера.
 * SSOT: переводы через getUIText, все 4 языка.
 */

import { Search, ShieldCheck, Sunset } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { GSL_BRAND_SHADOW_SOFT_HOVER } from '@/lib/theme/product-ui'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    icon: Search,
    titleKey: 'howStep1Title',
    descKey: 'howStep1Desc',
    number: '01',
  },
  {
    icon: ShieldCheck,
    titleKey: 'howStep2Title',
    descKey: 'howStep2Desc',
    number: '02',
  },
  {
    icon: Sunset,
    titleKey: 'howStep3Title',
    descKey: 'howStep3Desc',
    number: '03',
  },
]

export function HowItWorks({ language = 'ru' }) {
  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="container mx-auto px-6">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {getUIText('howItWorksEyebrow', language)}
          </p>
          <h2 className="font-serif text-[34px] font-semibold leading-tight tracking-[-0.01em] text-slate-900 sm:text-[44px]">
            {getUIText('howItWorksTitle', language)}
          </h2>
        </div>

        {/* Steps */}
        <div className="relative mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">

          {/* Connector line (desktop only) */}
          <div
            className="absolute left-[16.5%] right-[16.5%] top-[28px] hidden h-px bg-gradient-to-r from-brand/15 via-brand/30 to-brand/15 sm:block"
            aria-hidden
          />

          {STEPS.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={idx}
                className="group flex flex-col items-center text-center"
              >
                {/* Circle with icon */}
                <div
                  className={cn(
                    'relative mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/25 bg-white shadow-sm transition-all duration-300 group-hover:border-brand/40',
                    GSL_BRAND_SHADOW_SOFT_HOVER,
                  )}
                >
                  <Icon className="h-6 w-6 text-brand transition-colors group-hover:text-brand-hover" />
                  {/* Step number — editorial accent */}
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-black leading-none text-white">
                    {idx + 1}
                  </span>
                </div>

                {/* Content */}
                <h3 className="mb-2 text-[17px] font-bold tracking-tight text-slate-900">
                  {getUIText(step.titleKey, language)}
                </h3>
                <p className="max-w-[200px] text-sm leading-relaxed text-slate-500">
                  {getUIText(step.descKey, language)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
