'use client'

/**
 * ADR-210 Slice 5/7.1 — post-claim / existing-partner welcome on listings.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ConciergePartnerChecklist } from '@/components/partner/listings/ConciergePartnerChecklist'

export function PartnerConciergeWelcomeBanner({
  count,
  onDismiss,
  onReviewDrafts,
  t,
  className,
}) {
  const n = Math.max(0, Number(count) || 0)
  const body = String(t('partnerListings_conciergeWelcomeBody') || '')
    .replace(/\{count\}/g, String(n))
    .replace(/\{n\}/g, String(n))

  return (
    <div
      className={cn(
        'mx-4 mb-2 flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/5 px-3 py-3 max-sm:mx-0 max-sm:rounded-none max-sm:border-x-0 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
      data-testid="concierge-welcome-banner"
      role="status"
    >
      <div className="min-w-0 flex-1 pr-1">
        <p className="text-sm font-semibold text-slate-900">
          {t('partnerListings_conciergeWelcomeTitle')}
        </p>
        <p className="mt-1 text-sm leading-snug text-slate-700">{body}</p>
        <ConciergePartnerChecklist t={t} />
      </div>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="brand"
          className="min-h-[44px] w-full sm:w-auto"
          onClick={onReviewDrafts}
          data-testid="concierge-welcome-review-btn"
        >
          {t('partnerListings_conciergeWelcomeCta')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] min-w-[44px] text-slate-600"
          onClick={onDismiss}
          aria-label={t('partnerListings_conciergeWelcomeDismiss')}
          data-testid="concierge-welcome-dismiss-btn"
        >
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
