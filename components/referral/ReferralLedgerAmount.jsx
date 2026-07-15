'use client'

import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { cn } from '@/lib/utils'

/**
 * Ambassador ledger amount in header display currency (mid FX, Stage 188.2 — no THB leak).
 */
export function ReferralLedgerAmount({ thb, className, as: Tag = 'span' }) {
  const { formatThbAsDisplay } = useReferralLedgerDisplay()
  const formatted = formatThbAsDisplay(Number(thb) || 0)

  return (
    <Tag className={cn('tabular-nums whitespace-nowrap break-words', className)}>{formatted}</Tag>
  )
}
