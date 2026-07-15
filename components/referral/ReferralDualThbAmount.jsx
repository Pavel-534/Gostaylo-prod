'use client'

import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { cn } from '@/lib/utils'

/**
 * Stage 188.1 — legacy name; renders ledger THB in header display currency (mid FX).
 * @deprecated Prefer `<ReferralLedgerAmount thb={…} />` directly.
 */
export function ReferralDualThbAmount({
  thb,
  displayCurrency: _displayCurrency,
  midRateRubToThb: _midRateRubToThb,
  locale: _locale,
  className = '',
  primaryClassName = '',
  secondaryClassName: _secondaryClassName,
  emptyLabel = '—',
}) {
  const n = Number(thb)
  if (!Number.isFinite(n) || n <= 0) {
    return <span className={className}>{emptyLabel}</span>
  }

  return (
    <ReferralLedgerAmount
      thb={n}
      className={cn('tabular-nums', className, primaryClassName)}
    />
  )
}

export default ReferralDualThbAmount
