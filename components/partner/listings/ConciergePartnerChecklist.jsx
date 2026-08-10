'use client'

/**
 * ADR-210 Slice 7.1 — 3-step Concierge review checklist for partners.
 */

import { cn } from '@/lib/utils'

export function ConciergePartnerChecklist({ t, className }) {
  const steps = [
    t('partnerListings_conciergeCheckStep1'),
    t('partnerListings_conciergeCheckStep2'),
    t('partnerListings_conciergeCheckStep3'),
  ]

  return (
    <ol
      className={cn('mt-2 space-y-1.5 text-sm text-slate-700', className)}
      data-testid="concierge-partner-checklist"
    >
      {steps.map((label, idx) => (
        <li key={idx} className="flex gap-2 leading-snug">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand"
            aria-hidden
          >
            {idx + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}
