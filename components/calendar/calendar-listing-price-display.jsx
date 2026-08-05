'use client'

import { useCallback } from 'react'
import { formatNativeAmountInCurrency } from '@/lib/currency'
import { formatDisplayPriceInCurrency } from '@/lib/pricing/fx-display-client'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { cn } from '@/lib/utils'

/**
 * Stage 180.5 / 200.32 — listing price for partner UI.
 * Primary = L1 asset (native amount + baseCurrency) when known; else mid FX from THB ledger → baseCurrency.
 * Secondary ≈ header currency from THB ledger (mid), only when header ≠ listing base.
 *
 * @param {number} amountThb — ledger THB (cell / listing)
 * @param {string} [baseCurrency]
 * @param {{ amountAsset?: number|null }} [opts]
 */
export function useCalendarListingPriceFormat() {
  const {
    language,
    formatLedgerThb,
    isConvertedDisplay,
    currency: headerCurrency,
    rateMap,
  } = usePartnerHostDisplayFx()

  const formatListingPrice = useCallback(
    (amountThb, baseCurrency = 'THB', opts = {}) => {
      const baseCur = String(baseCurrency || 'THB').toUpperCase()
      const ledger = Number(amountThb)
      const ledgerSafe = Number.isFinite(ledger) ? ledger : 0
      const assetRaw = opts.amountAsset
      const hasAsset = assetRaw != null && Number.isFinite(Number(assetRaw))

      let primary
      if (hasAsset) {
        primary = formatNativeAmountInCurrency(Number(assetRaw), baseCur, language)
      } else if (baseCur === 'THB') {
        primary = formatNativeAmountInCurrency(ledgerSafe, 'THB', language)
      } else {
        // Legacy row without metadata.base_price_asset: mid convert ledger → listing currency
        primary = formatDisplayPriceInCurrency(ledgerSafe, baseCur, rateMap, language)
      }

      const showApprox =
        isConvertedDisplay && String(headerCurrency || '').toUpperCase() !== baseCur
      return {
        primary,
        secondary: showApprox ? formatLedgerThb(ledgerSafe) : null,
        showApprox,
      }
    },
    [formatLedgerThb, headerCurrency, isConvertedDisplay, language, rateMap],
  )

  return { formatListingPrice, headerCurrency, isConvertedDisplay }
}

export function CalendarListingPriceDisplay({
  amountThb,
  baseCurrency = 'THB',
  amountAsset = null,
  className,
  priceClassName,
}) {
  const { formatListingPrice } = useCalendarListingPriceFormat()
  const { primary, secondary } = formatListingPrice(amountThb, baseCurrency, { amountAsset })

  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <span className={priceClassName}>{primary}</span>
      {secondary ? (
        <span className="text-[9px] font-normal text-slate-400 tabular-nums leading-none">≈ {secondary}</span>
      ) : null}
    </div>
  )
}
