'use client'

import { useCallback } from 'react'
import { formatThbAmountAsCode } from '@/lib/currency'
import { formatPayoutRailAmount } from '@/lib/partner/partner-money-display'
import { useMidMarketDisplayFx } from '@/lib/hooks/use-mid-market-display-fx'

/**
 * Stage 180.1 / 186.0 — SSOT mid FX for partner host finances UI.
 * Ledger buckets + payout card primary: header display currency (mid).
 * Payout rail (USDT/RUB): secondary line with explicit ISO code for USDT.
 */
export function usePartnerHostDisplayFx() {
  const mid = useMidMarketDisplayFx()

  const formatLedgerThb = mid.formatThbAsDisplay

  const formatThbLedgerSecondary = useCallback(
    (thbAmount) => formatThbAmountAsCode(thbAmount, mid.language),
    [mid.language],
  )

  const getPayoutDisplay = useCallback(
    (preview) => {
      if (!preview || preview.error) {
        return { primary: '—', secondary: null, usesServerPayout: false, payoutCurrency: null }
      }

      const payoutCur = String(preview.payoutCurrency || 'THB').toUpperCase()
      const payoutAmt = preview.amountInPayoutCurrency
      const hasServerPayout =
        payoutCur !== 'THB' && payoutAmt != null && Number.isFinite(Number(payoutAmt))

      const finalThb = Number(preview.finalAmountThb ?? preview.baseAmountThb ?? 0)

      if (hasServerPayout) {
        return {
          primary: formatLedgerThb(finalThb),
          secondary: formatPayoutRailAmount(payoutAmt, payoutCur, mid.language),
          usesServerPayout: true,
          payoutCurrency: payoutCur,
        }
      }

      return {
        primary: formatLedgerThb(finalThb),
        secondary: null,
        usesServerPayout: false,
        payoutCurrency: payoutCur === 'THB' ? 'THB' : null,
      }
    },
    [formatLedgerThb, mid.language],
  )

  return {
    ...mid,
    formatLedgerThb,
    formatThbLedgerSecondary,
    getPayoutDisplay,
  }
}
