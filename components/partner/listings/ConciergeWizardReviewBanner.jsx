'use client'

/**
 * ADR-210 Slice 5/7.1 — guidance strip when editing a Concierge-imported draft.
 */

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConciergePartnerChecklist } from '@/components/partner/listings/ConciergePartnerChecklist'

export function ConciergeWizardReviewBanner({ t, className }) {
  return (
    <div
      className={cn(
        'mb-4 flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-3 py-3 sm:px-4',
        className,
      )}
      data-testid="concierge-wizard-review-banner"
      role="status"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-slate-800">
          {t('partnerEdit_conciergeReviewHint')}
        </p>
        <ConciergePartnerChecklist t={t} />
      </div>
    </div>
  )
}
