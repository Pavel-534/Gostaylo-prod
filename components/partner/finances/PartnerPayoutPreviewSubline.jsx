'use client'

import { PartnerHostPayoutAmount } from '@/components/partner/finances/partner-host-amount-display'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'

/**
 * Server preview payout amount in partner rail currency (no client FX).
 */
export function PartnerPayoutPreviewSubline({ preview, className = 'text-xs text-indigo-700' }) {
  const { getPayoutDisplay } = usePartnerHostDisplayFx()

  if (!preview?.amountInPayoutCurrency || !preview?.payoutCurrency) return null
  const { usesServerPayout } = getPayoutDisplay(preview)
  if (!usesServerPayout) return null

  return (
    <div className={className}>
      <PartnerHostPayoutAmount preview={preview} className="items-start" />
    </div>
  )
}
