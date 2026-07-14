'use client'

import { interpolateTemplate } from '@/components/partner/finances/partner-payout-preview-display'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'

/**
 * Per-booking payout line from server preview — display currency + payout rail only (Stage 185.2).
 */
export function PartnerBookingPayoutPreviewLine({ t, preview, loading }) {
  const { getPayoutDisplay, formatLedgerThb } = usePartnerHostDisplayFx()

  if (loading) {
    return <p className="text-xs text-slate-500">…</p>
  }
  if (!preview || preview.error) {
    return null
  }

  const { primary, secondary, usesServerPayout } = getPayoutDisplay(preview)
  const feeThb = Number(preview.feeAmountThb ?? 0)
  const feeDisplay =
    feeThb > 0 ? formatLedgerThb(feeThb) : null

  return (
    <div className="space-y-0.5 text-xs text-indigo-700">
      <p className="font-medium tabular-nums whitespace-nowrap">
        {interpolateTemplate(t('partnerFinances_payoutLineDisplay'), { amount: primary })}
      </p>
      {usesServerPayout && secondary ? (
        <p className="tabular-nums whitespace-nowrap text-slate-700">
          {interpolateTemplate(t('partnerFinances_payoutLineRail'), { amount: secondary })}
        </p>
      ) : null}
      {feeDisplay ? (
        <p className="text-slate-500 tabular-nums whitespace-nowrap">
          {interpolateTemplate(t('partnerFinances_payoutLineWithdrawFee'), { amount: feeDisplay })}
        </p>
      ) : null}
      <p className="text-[11px] leading-snug text-slate-500 pt-0.5">
        {t('partnerFinances_payoutPreviewLiveNote')}
      </p>
    </div>
  )
}
