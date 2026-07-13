'use client'

import { useCallback } from 'react'
import { formatPrice } from '@/lib/currency'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { cn } from '@/lib/utils'

/**
 * Stage 180.5 — calendar cell price: listing base currency primary, header currency ≈ secondary (mid).
 * Amounts in API are THB ledger; baseCurrency labels the host asset (default THB).
 */
export function useCalendarListingPriceFormat() {
  const { language, formatLedgerThb, isConvertedDisplay, currency: headerCurrency } =
    usePartnerHostDisplayFx()

  const formatListingPrice = useCallback(
    (amountThb, baseCurrency = 'THB') => {
      const baseCur = String(baseCurrency || 'THB').toUpperCase()
      const amount = Math.round(Number(amountThb) || 0)
      const primary = formatPrice(amount, baseCur, { THB: 1 }, language)
      const showApprox = isConvertedDisplay && headerCurrency !== baseCur
      return {
        primary,
        secondary: showApprox ? formatLedgerThb(amount) : null,
        showApprox,
      }
    },
    [formatLedgerThb, headerCurrency, isConvertedDisplay, language],
  )

  return { formatListingPrice, headerCurrency, isConvertedDisplay }
}

export function CalendarListingPriceDisplay({
  amountThb,
  baseCurrency = 'THB',
  className,
  priceClassName,
}) {
  const { formatListingPrice } = useCalendarListingPriceFormat()
  const { primary, secondary } = formatListingPrice(amountThb, baseCurrency)

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <span className={priceClassName}>{primary}</span>
      {secondary ? (
        <span className="text-[9px] font-normal text-slate-400 tabular-nums leading-none">≈ {secondary}</span>
      ) : null}
    </div>
  )
}
