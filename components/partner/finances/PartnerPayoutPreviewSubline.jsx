'use client'

import { formatPrice } from '@/lib/currency'
import { formatServerPayoutAmount } from '@/components/partner/finances/partner-payout-preview-display'

/**
 * Server preview payout amount in partner rail currency (no client FX).
 */
export function PartnerPayoutPreviewSubline({ preview, language = 'ru', className = 'text-xs text-indigo-700' }) {
  if (!preview?.amountInPayoutCurrency || !preview?.payoutCurrency) return null
  const cur = String(preview.payoutCurrency).toUpperCase()
  if (cur === 'THB') {
    return (
      <p className={className}>
        ≈ {formatPrice(preview.amountInPayoutCurrency, 'THB', { THB: 1 }, language)}
      </p>
    )
  }
  return (
    <p className={className}>
      ≈ {formatServerPayoutAmount(preview.amountInPayoutCurrency, cur, language)}
    </p>
  )
}
