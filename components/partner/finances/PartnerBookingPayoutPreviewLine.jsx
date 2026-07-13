'use client'

import { interpolateTemplate } from '@/components/partner/finances/partner-payout-preview-display'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'

/**
 * Per-booking payout line from server preview (partner-payout-fx via preview-batch).
 */
export function PartnerBookingPayoutPreviewLine({ t, preview, loading }) {
  const { getPayoutDisplay, formatThbLedgerSecondary } = usePartnerHostDisplayFx()

  if (loading) {
    return <p className="text-xs text-slate-500">…</p>
  }
  if (!preview || preview.error) {
    return null
  }

  const { primary, usesServerPayout } = getPayoutDisplay(preview)
  const netThb = formatThbLedgerSecondary(preview.baseAmountThb ?? 0)
  const feeThb = formatThbLedgerSecondary(preview.feeAmountThb ?? 0)
  const finalThb = formatThbLedgerSecondary(preview.finalAmountThb ?? 0)

  if (usesServerPayout) {
    return (
      <div className="text-xs text-indigo-700 space-y-0.5">
        <p className="font-medium tabular-nums">
          {interpolateTemplate(t('partnerFinances_payoutLinePrimary'), { payoutPrimary: primary })}
        </p>
        <p className="text-slate-500 tabular-nums">
          {interpolateTemplate(t('partnerFinances_payoutLineThbAccounting'), {
            netThb,
            feeThb,
            finalThb,
          })}
        </p>
      </div>
    )
  }

  return (
    <p className="text-xs text-indigo-700 tabular-nums">
      {interpolateTemplate(t('partnerFinances_payoutLineDetail'), {
        netThb,
        feeThb,
        finalThb,
        payoutApprox: primary,
      })}
    </p>
  )
}
