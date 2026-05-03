'use client'

/**
 * PartnerCTA — секция привлечения хостов/партнёров.
 * Дизайн: bg-slate-900 (тёмный), белый текст, teal-акценты.
 * Размещается перед футером на главной странице.
 * SSOT: все переводы через getUIText + getCategoryName, ссылка на /partner/dashboard.
 */

import Link from 'next/link'
import { ArrowRight, Building2, Car, Anchor } from 'lucide-react'
import { getUIText, getCategoryName } from '@/lib/translations'

const CATEGORY_PILLS = [
  { icon: Building2, slug: 'property' },
  { icon: Car,       slug: 'vehicles' },
  { icon: Anchor,    slug: 'yachts'   },
]

export function PartnerCTA({ language = 'ru' }) {
  return (
    <section className="bg-slate-900">
      <div className="container mx-auto px-6 py-12 sm:py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:flex-row sm:items-center sm:gap-16 sm:text-left">

          {/* Left: Text content */}
          <div className="flex-1">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-teal-400">
              {getUIText('partnerCtaEyebrow', language)}
            </p>

            <h2 className="font-serif mb-4 text-[28px] font-semibold leading-tight tracking-[-0.01em] text-white sm:text-[38px]">
              {getUIText('partnerCtaTitle', language)}
            </h2>

            <p className="max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
              {getUIText('partnerCtaDesc', language)}
            </p>

            {/* Category pills */}
            <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
              {CATEGORY_PILLS.map(({ icon: Icon, slug }) => (
                <span
                  key={slug}
                  className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300"
                >
                  <Icon className="h-3.5 w-3.5 text-teal-400" />
                  {getCategoryName(slug, language)}
                </span>
              ))}
            </div>
          </div>

          {/* Right: CTA button */}
          <div className="shrink-0">
            <Link
              href="/partner/dashboard"
              className="group inline-flex items-center gap-3 rounded-2xl bg-teal-500 px-8 py-4 text-base font-bold text-white shadow-[0_12px_32px_rgba(0,153,153,0.35)] transition-all duration-300 hover:bg-teal-400 hover:shadow-[0_16px_40px_rgba(0,153,153,0.5)] active:scale-[0.97]"
            >
              {getUIText('partnerCtaBtn', language)}
              <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <p className="mt-3 text-center text-xs text-slate-500">
              {getUIText('partnerCtaFree', language)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

