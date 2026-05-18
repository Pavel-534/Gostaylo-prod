'use client'

import { formatPrice } from '@/lib/currency'
import {
  formatServerPayoutAmount,
  interpolateTemplate,
} from '@/components/partner/finances/partner-payout-preview-display'

/**
 * Per-booking payout line from server preview (partner-payout-fx via preview-batch).
 */
export function PartnerBookingPayoutPreviewLine({ t, language, preview, loading }) {
  if (loading) {
    return <p className="text-xs text-slate-500">…</p>
  }
  if (!preview || preview.error) {
    return null
  }

  const netThb = formatPrice(preview.baseAmountThb ?? 0, 'THB', { THB: 1 }, language)
  const feeThb = formatPrice(preview.feeAmountThb ?? 0, 'THB', { THB: 1 }, language)
  const finalThb = formatPrice(preview.finalAmountThb ?? 0, 'THB', { THB: 1 }, language)
  const payoutCur = String(preview.payoutCurrency || 'THB').toUpperCase()
  const payoutApprox =
    payoutCur === 'THB'
      ? finalThb
      : formatServerPayoutAmount(preview.amountInPayoutCurrency, payoutCur, language)

  return (
    <p className="text-xs text-indigo-700">
      {interpolateTemplate(t('partnerFinances_payoutLineDetail'), {
        netThb,
        feeThb,
        finalThb,
        payoutApprox,
      })}
    </p>
  )
}
