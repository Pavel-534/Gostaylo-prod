'use client'

import { CalendarListingPriceDisplay } from '@/components/calendar/calendar-listing-price-display'
import { resolvePartnerListingPriceParts } from '@/lib/partner/partner-listing-price-display'

/**
 * Stage 180.6 / 200.32 — partner listings card: L1 asset primary, header ≈ secondary (mid).
 */
export function PartnerListingBasePriceDisplay({
  amount,
  baseCurrency = 'THB',
  basePriceAsset = null,
  metadata = null,
  className,
  priceClassName = 'text-sm font-semibold text-slate-900',
}) {
  const parts = resolvePartnerListingPriceParts({
    basePriceThb: amount,
    baseCurrency,
    basePriceAsset,
    metadata,
  })

  return (
    <CalendarListingPriceDisplay
      amountThb={parts.ledgerThb}
      baseCurrency={parts.primaryCurrency}
      amountAsset={parts.hasAssetAmount ? parts.primaryAmount : null}
      className={className}
      priceClassName={priceClassName}
    />
  )
}
