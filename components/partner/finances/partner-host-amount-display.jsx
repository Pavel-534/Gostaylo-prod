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
    <span className={className}>
      <span className="opacity-75 font-semibold" aria-hidden>
        ≈{' '}
      </span>
      {formatted}
    </span>
  )
}

/**
 * Server payout preview: payout rail primary, THB ledger secondary.
 */
export function PartnerHostPayoutAmount({ preview, className, secondaryClassName }) {
  const { getPayoutDisplay } = usePartnerHostDisplayFx()
  const { primary, secondary, usesServerPayout } = getPayoutDisplay(preview)

  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5', className)}>
      <span className="tabular-nums font-semibold">{primary}</span>
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
