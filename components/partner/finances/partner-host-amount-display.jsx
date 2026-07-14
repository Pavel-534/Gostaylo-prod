'use client'

import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { cn } from '@/lib/utils'

/**
 * Ledger / escrow bucket amount in header currency (mid FX, ≈ when converted).
 */
export function PartnerHostLedgerAmount({ thb, className }) {
  const { formatLedgerThb, isConvertedDisplay } = usePartnerHostDisplayFx()
  const formatted = formatLedgerThb(Number(thb) || 0)

  if (!isConvertedDisplay) {
    return <span className={className}>{formatted}</span>
  }

  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap tabular-nums', className)}>
      <span className="opacity-75 font-semibold shrink-0" aria-hidden>
        ≈&nbsp;
      </span>
      <span>{formatted}</span>
    </span>
  )
}

/**
 * Ledger row: THB accounting primary; header-currency equivalent as subline when converted.
 */
export function PartnerHostLedgerAmountCell({ thb, className }) {
  const { formatThbLedgerSecondary, formatLedgerThb, isConvertedDisplay } = usePartnerHostDisplayFx()
  const amount = Number(thb) || 0
  const thbFormatted = formatThbLedgerSecondary(amount)

  if (!isConvertedDisplay) {
    return <span className={cn('tabular-nums font-semibold', className)}>{thbFormatted}</span>
  }

  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5 tabular-nums', className)}>
      <span className="font-semibold text-slate-900">{thbFormatted}</span>
      <span className="text-xs font-normal text-slate-500 inline-flex items-baseline whitespace-nowrap">
        <span className="opacity-75 shrink-0" aria-hidden>
          ≈&nbsp;
        </span>
        <span>{formatLedgerThb(amount)}</span>
      </span>
    </span>
  )
}

/**
 * Payout preview: display currency primary; payout rail (e.g. USDT) secondary.
 */
export function PartnerHostPayoutAmount({ preview, className, secondaryClassName }) {
  const { getPayoutDisplay, isConvertedDisplay } = usePartnerHostDisplayFx()
  const { primary, secondary, usesServerPayout } = getPayoutDisplay(preview)

  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5', className)}>
      <span className="inline-flex items-baseline whitespace-nowrap tabular-nums font-semibold">
        {isConvertedDisplay ? (
          <span className="opacity-75 font-semibold shrink-0" aria-hidden>
            ≈&nbsp;
          </span>
        ) : null}
        <span>{primary}</span>
      </span>
      {usesServerPayout && secondary ? (
        <span className={cn('text-xs text-slate-500 tabular-nums font-normal', secondaryClassName)}>
          {secondary}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Footnote for mid FX conversion on partner finances surfaces.
 */
export function PartnerHostMidFxFootnote({ t, className }) {
  const { isConvertedDisplay } = usePartnerHostDisplayFx()
  if (!isConvertedDisplay) return null

  return (
    <p className={cn('text-[10px] text-slate-500 leading-snug', className)}>{t('stage180_midFxHint')}</p>
  )
}
