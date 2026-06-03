'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchExchangeRates, FX_RATES_UPDATED_EVENT } from '@/lib/client-data'
import { getQueryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

/** Согласовано с `EXCHANGE_RATES_TTL_MS` в `lib/client-data.js` и ADR. */
export const FX_RATES_STALE_MS = 2 * 60 * 60 * 1000

const THB_ONLY = { THB: 1 }

/**
 * @param {{ retail?: boolean }} [options]
 */
export function fxRatesQueryKey(options = {}) {
  const retail = options.retail !== false
  return queryKeys.fx.rates({ retail: retail ? '1' : '0' })
}

/**
 * SSOT display FX для UI (каталог, главная, checkout preview, PDP).
 * Обёртка над `fetchExchangeRates` (localStorage bundle + /api/v2/exchange-rates).
 */
export function useFxRatesQuery(options = {}) {
  const { retail = true } = options
  const queryClient = useQueryClient()
  const queryKey = fxRatesQueryKey({ retail })

  useEffect(() => {
    const onFx = (e) => {
      const rateMap = e?.detail
      if (!rateMap || typeof rateMap !== 'object') return
      queryClient.setQueryData(fxRatesQueryKey({ retail: true }), rateMap)
      queryClient.setQueryData(fxRatesQueryKey({ retail: false }), rateMap)
    }
    window.addEventListener(FX_RATES_UPDATED_EVENT, onFx)
    return () => window.removeEventListener(FX_RATES_UPDATED_EVENT, onFx)
  }, [queryClient])

  return useQuery({
    queryKey,
    queryFn: () => fetchExchangeRates({ retail, force: false }),
    staleTime: FX_RATES_STALE_MS,
    gcTime: FX_RATES_STALE_MS,
    refetchOnWindowFocus: true,
    placeholderData: THB_ONLY,
  })
}

/** Только TanStack Query (вызывается из `invalidateExchangeRatesCache`). */
export function invalidateFxRatesQueriesOnly(queryClient = getQueryClient()) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.fx.all })
}
