'use client'

import { CalendarListingPriceDisplay } from '@/components/calendar/calendar-listing-price-display'

/**
 * Stage 180.6 — partner listings card: asset base currency primary, header ≈ secondary (mid).
 */
export function PartnerListingBasePriceDisplay({
  amount,
  baseCurrency = 'THB',
  className,
  priceClassName = 'text-sm font-semibold text-slate-900',
}) {
  return (
    <CalendarListingPriceDisplay
      amountThb={amount}
      baseCurrency={baseCurrency}
      className={className}
      priceClassName={priceClassName}
    />
  )
}
