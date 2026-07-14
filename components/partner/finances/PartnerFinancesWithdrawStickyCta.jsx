'use client'

import { ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isPartnerWithdrawDisabled } from '@/lib/partner/partner-withdraw-eligibility'

export { isPartnerWithdrawDisabled }

export function PartnerFinancesWithdrawStickyCta({
  t,
  summaryLoading,
  payoutPreviewLoading,
  partnerId,
  partnerProfileVerified,
  hasProfile,
  payoutPreview,
  onOpenWithdraw,
}) {
  const disabled = isPartnerWithdrawDisabled({
    summaryLoading,
    payoutPreviewLoading,
    partnerId,
    partnerProfileVerified,
    hasProfile,
    payoutPreview,
  })

  return (
    <div className="md:hidden sticky bottom-0 z-20 -mx-1 mt-4 border-t border-slate-200 bg-background/95 px-1 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <Button
        type="button"
        variant="brand"
        className="w-full min-h-[44px] gap-2"
        onClick={() => onOpenWithdraw(true)}
        disabled={disabled}
      >
        <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
        {t('partnerFinances_withdrawCta')}
      </Button>
    </div>
  )
}
