'use client'

import { useCallback, useMemo } from 'react'
import { useCurrency } from '@/contexts/currency-context'
import { useAmbassadorDisplayFx } from '@/lib/hooks/use-ambassador-display-fx'
import { hasAmbassadorFxRate } from '@/lib/pricing/ambassador-display-rate-map.js'
import {
  convertAmbassadorDisplayToThb,
  convertAmbassadorDisplayToThbGuarded,
  convertThbToAmbassadorDisplayRounded,
  formatAmbassadorAmountFromThb,
  formatAmbassadorAmountLineFromThb,
} from '@/lib/pricing/ambassador-display-amount.js'

const DEFAULT_MIN_PAYOUT_THB = 1000

function resolveMinPayoutThbInput(minPayoutThb) {
  const n = Number(minPayoutThb)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_PAYOUT_THB
}

/**
 * SSOT for ambassador hub ledger amounts (Stage 188.1–188.3).
 * Mid-market FX; no THB leak in UI; no hybrid ≈ lines.
 */
export function useReferralLedgerDisplay() {
  const { currency: headerCurrency } = useCurrency()
  const {
    currency,
    exchangeRates,
    rateMap,
    loading: fxLoading,
    fxReady,
    language,
    isConvertedDisplay,
  } = useAmbassadorDisplayFx()

  const displayCurrency = currency || headerCurrency

  const formatThbAsDisplay = useCallback(
    (amountThb) => formatAmbassadorAmountFromThb(amountThb, displayCurrency, rateMap, language),
    [displayCurrency, rateMap, language],
  )

  const formatLedgerLine = useCallback(
    (amountThb) => formatAmbassadorAmountLineFromThb(amountThb, displayCurrency, rateMap, language),
    [displayCurrency, rateMap, language],
  )

  const formatMinPayoutThreshold = useCallback(
    (minPayoutThb) => {
      const minThb = resolveMinPayoutThbInput(minPayoutThb)
      if (String(displayCurrency || 'THB').toUpperCase() !== 'THB' && fxLoading && !fxReady) {
        return '…'
      }
      return formatThbAsDisplay(minThb)
    },
    [displayCurrency, fxLoading, fxReady, formatThbAsDisplay],
  )

  const convertThbToDisplay = useCallback(
    (amountThb) => convertThbToAmbassadorDisplayRounded(amountThb, displayCurrency, rateMap),
    [displayCurrency, rateMap],
  )

  const convertDisplayToThb = useCallback(
    (amountDisplay) => convertAmbassadorDisplayToThb(amountDisplay, displayCurrency, rateMap),
    [displayCurrency, rateMap],
  )

  /** Withdrawal input → THB with min-payout snap guard (Stage 188.3). */
  const convertDisplayToThbForWithdrawal = useCallback(
    (amountDisplay, minPayoutThb) =>
      convertAmbassadorDisplayToThbGuarded(amountDisplay, displayCurrency, rateMap, minPayoutThb),
    [displayCurrency, rateMap],
  )

  return useMemo(
    () => ({
      currency: displayCurrency,
      exchangeRates,
      rateMap,
      fxLoading,
      fxReady: fxReady || hasAmbassadorFxRate(rateMap, displayCurrency),
      language,
      isConvertedDisplay,
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
      displayCurrency,
      exchangeRates,
      rateMap,
      fxLoading,
      fxReady,
      language,
      isConvertedDisplay,
      formatThbAsDisplay,
      formatLedgerLine,
      formatMinPayoutThreshold,
      convertThbToDisplay,
      convertDisplayToThb,
      convertDisplayToThbForWithdrawal,
    ],
  )
}
