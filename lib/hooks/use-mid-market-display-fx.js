'use client'

import { useCallback } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { formatDisplayPriceInCurrency } from '@/lib/pricing/fx-display-client'

/**
 * Stage 180.1 — shared mid-market FX for ledger obligations (ambassador + partner host).
 * Витрина / checkout — только `useFxRatesQuery({ retail: true })`.
 *
 * @returns {{
 *   currency: string,
 *   exchangeRates: Record<string, number>,
 *   language: string,
 *   isConvertedDisplay: boolean,
 *   formatThbAsDisplay: (thbAmount: number) => string,
 * }}
 */
export function useMidMarketDisplayFx() {
  const { language } = useI18n()
  const { currency } = useCurrency()
  const { data: exchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: false })
  const displayCurrency = String(currency || 'THB').toUpperCase()
  const isConvertedDisplay = displayCurrency !== 'THB'

  const formatThbAsDisplay = useCallback(
    (thbAmount) => formatDisplayPriceInCurrency(thbAmount, currency, exchangeRates, language),
    [currency, exchangeRates, language],
  )

  return {
    currency: displayCurrency,
    exchangeRates,
    language,
    isConvertedDisplay,
    formatThbAsDisplay,
  }
}
