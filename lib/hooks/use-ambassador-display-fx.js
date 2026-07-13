'use client'

import { useMidMarketDisplayFx } from '@/lib/hooks/use-mid-market-display-fx'

/**
 * Stage 179.7 / 180.1 — SSOT mid-market FX for ambassador hub (ledger obligations, payout parity).
 * Витрина / checkout — только `useFxRatesQuery({ retail: true })`.
 *
 * @returns {ReturnType<typeof useMidMarketDisplayFx>}
 */
export function useAmbassadorDisplayFx() {
  return useMidMarketDisplayFx()
}
