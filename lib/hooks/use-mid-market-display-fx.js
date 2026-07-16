'use client'

import { useCallback, useMemo } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { useCurrency } from '@/contexts/currency-context'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { formatDisplayPriceInCurrency } from '@/lib/pricing/fx-display-client'
import {
  hasAmbassadorFxRate,
  mergeAmbassadorDisplayRateMaps,
} from '@/lib/pricing/ambassador-display-rate-map.js'

const THB_ONLY = { THB: 1 }

/**
 * Stage 180.1 — shared mid-market FX for ledger obligations (ambassador + partner host).
 * Витрина / checkout — только `useFxRatesQuery({ retail: true })`.
 */
export function useMidMarketDisplayFx() {
  const { language } = useI18n()
  const { currency } = useCurrency()
  const midQuery = useFxRatesQuery({ retail: false })
  const retailQuery = useFxRatesQuery({ retail: true })
  const displayCurrency = String(currency || 'THB').toUpperCase()
  const isConvertedDisplay = displayCurrency !== 'THB'

  const rateMap = useMemo(
    () => mergeAmbassadorDisplayRateMaps(midQuery.data ?? THB_ONLY, retailQuery.data ?? THB_ONLY),
    [midQuery.data, retailQuery.data],
  )

  const fxReady = hasAmbassadorFxRate(rateMap, displayCurrency)
  const fxLoading =
    (midQuery.isLoading || midQuery.isFetching || retailQuery.isLoading || retailQuery.isFetching) &&
    !fxReady

  const formatThbAsDisplay = useCallback(
    (thbAmount) => formatDisplayPriceInCurrency(thbAmount, currency, rateMap, language),
    [currency, rateMap, language],
  )

  return {
    currency: displayCurrency,
    exchangeRates: rateMap,
    rateMap,
    loading: fxLoading,
    fxReady,
    language,
    isConvertedDisplay,
    formatThbAsDisplay,
  }
}
