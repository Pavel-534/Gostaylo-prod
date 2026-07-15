'use client'

import { useCallback, useMemo } from 'react'
import { useCurrency } from '@/contexts/currency-context'
import { useAmbassadorDisplayFx } from '@/lib/hooks/use-ambassador-display-fx'
import {
  convertAmbassadorDisplayToThb,
  convertAmbassadorDisplayToThbGuarded,
  convertThbToAmbassadorDisplayRounded,
  formatAmbassadorAmountFromThb,
  formatAmbassadorAmountLineFromThb,
} from '@/lib/pricing/ambassador-display-amount.js'

/**
 * SSOT for ambassador hub ledger amounts (Stage 188.1–188.3).
 * Mid-market FX; no THB leak in UI; no hybrid ≈ lines.
 */
export function useReferralLedgerDisplay() {
  const { currency } = useCurrency()
  const { rateMap, loading: fxLoading } = useAmbassadorDisplayFx()

  const formatThbAsDisplay = useCallback(
    (amountThb) => formatAmbassadorAmountFromThb(amountThb, currency, rateMap),
    [currency, rateMap],
  )

  const formatLedgerLine = useCallback(
    (amountThb) => formatAmbassadorAmountLineFromThb(amountThb, currency, rateMap),
    [currency, rateMap],
  )

  const formatMinPayoutThreshold = useCallback(
    (minPayoutThb) => formatThbAsDisplay(minPayoutThb),
    [formatThbAsDisplay],
  )

  const convertThbToDisplay = useCallback(
    (amountThb) => convertThbToAmbassadorDisplayRounded(amountThb, currency, rateMap),
    [currency, rateMap],
  )

  const convertDisplayToThb = useCallback(
    (amountDisplay) => convertAmbassadorDisplayToThb(amountDisplay, currency, rateMap),
    [currency, rateMap],
  )

  /** Withdrawal input → THB with min-payout snap guard (Stage 188.3). */
  const convertDisplayToThbForWithdrawal = useCallback(
    (amountDisplay, minPayoutThb) =>
      convertAmbassadorDisplayToThbGuarded(amountDisplay, currency, rateMap, minPayoutThb),
    [currency, rateMap],
  )

  return useMemo(
    () => ({
      currency,
      rateMap,
      fxLoading,
      formatThbAsDisplay,
      formatLedgerLine,
      formatLedgerAmount: formatLedgerLine,
      formatLedgerWithApprox: formatLedgerLine,
      formatMinPayoutThreshold,
      convertThbToDisplay,
      convertDisplayToThb,
      convertDisplayToThbForWithdrawal,
    }),
    [
      currency,
      rateMap,
      fxLoading,
      formatThbAsDisplay,
      formatLedgerLine,
      formatMinPayoutThreshold,
      convertThbToDisplay,
      convertDisplayToThb,
      convertDisplayToThbForWithdrawal,
    ],
  )
}
