'use client'

import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { cn } from '@/lib/utils'

/**
 * Ledger / escrow bucket amount in header currency (mid FX under the hood).
 * Plain display currency only — no approximate-prefix or course footnote in UI.
 */
export function PartnerHostLedgerAmount({ thb, className }) {
  const { formatLedgerThb } = usePartnerHostDisplayFx()
  const formatted = formatLedgerThb(Number(thb) || 0)
  return <span className={cn('tabular-nums', className)}>{formatted}</span>
}

/**
 * Ledger row: amount in header display currency.
 */
export function PartnerHostLedgerAmountCell({ thb, className }) {
  const { formatThbLedgerSecondary, isConvertedDisplay } = usePartnerHostDisplayFx()
  const amount = Number(thb) || 0

  if (isConvertedDisplay) {
    return (
      <span className={cn('inline-flex tabular-nums font-semibold whitespace-nowrap', className)}>
        <PartnerHostLedgerAmount thb={amount} />
      </span>
    )
  }

  return (
    <span className={cn('tabular-nums font-semibold whitespace-nowrap', className)}>
      {formatThbLedgerSecondary(amount)}
    </span>
  )
}

/**
 * Payout preview: display currency primary; payout rail (e.g. USDT) secondary.
 */
export function PartnerHostPayoutAmount({ preview, className, secondaryClassName }) {
  const { getPayoutDisplay } = usePartnerHostDisplayFx()
  const { primary, secondary, usesServerPayout } = getPayoutDisplay(preview)

  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5', className)}>
      <span className="whitespace-nowrap tabular-nums font-semibold">{primary}</span>
      {usesServerPayout && secondary ? (
        <span className={cn('text-xs text-slate-500 tabular-nums font-normal', secondaryClassName)}>
          {secondary}
        </span>
      ) : null}
    </span>
  )
}
