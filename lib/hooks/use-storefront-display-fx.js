'use client'

import { useCallback } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { formatPrice } from '@/lib/currency'
import { formatDisplayPriceInCurrency } from '@/lib/pricing/fx-display-client'

/**
 * Stage 180.6 — retail FX (+5%) for guest-facing storefront previews (wizard, ListingCard).
 * Ledger / partner income — `usePartnerHostDisplayFx` (mid only).
 */
export function useStorefrontDisplayFx() {
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: true })
  const displayCurrency = String(currency || 'THB').toUpperCase()

  const formatGuestThbAsDisplay = useCallback(
    (thbAmount) => formatDisplayPriceInCurrency(thbAmount, currency, exchangeRates, language),
    [currency, exchangeRates, language],
  )

  const formatInListingBase = useCallback(
    (amount, baseCurrency = 'THB') => {
      const code = String(baseCurrency || 'THB').toUpperCase()
      return formatPrice(Math.round(Number(amount) || 0), code, { THB: 1 }, language)
    },
    [language],
  )

  return {
    currency: displayCurrency,
    exchangeRates,
    language,
    formatGuestThbAsDisplay,
    formatInListingBase,
  }
}
