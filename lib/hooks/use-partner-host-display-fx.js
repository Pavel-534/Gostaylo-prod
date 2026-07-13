'use client'

import { useCallback } from 'react'
import { formatPrice } from '@/lib/currency'
import { useMidMarketDisplayFx } from '@/lib/hooks/use-mid-market-display-fx'
import { formatServerPayoutAmount } from '@/components/partner/finances/partner-payout-preview-display'

/**
 * Stage 180.1 — SSOT mid FX for partner host finances UI.
 * Ledger buckets: header currency via mid (`retail: false`).
 * Payout lines: server `amountInPayoutCurrency` primary; THB accounting secondary.
 *
 * @returns {ReturnType<typeof useMidMarketDisplayFx> & {
 *   formatLedgerThb: (thbAmount: number) => string,
 *   formatThbLedgerSecondary: (thbAmount: number) => string,
 *   getPayoutDisplay: (preview: object | null | undefined) => {
 *     primary: string,
 *     secondary: string | null,
 *     usesServerPayout: boolean,
 *     payoutCurrency: string | null,
 *   },
 * }}
 */
export function usePartnerHostDisplayFx() {
  const mid = useMidMarketDisplayFx()

  const formatLedgerThb = mid.formatThbAsDisplay

  const formatThbLedgerSecondary = useCallback(
    (thbAmount) => formatPrice(thbAmount, 'THB', { THB: 1 }, mid.language),
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

      if (hasServerPayout) {
        const finalThb = Number(preview.finalAmountThb ?? preview.baseAmountThb ?? 0)
        return {
          primary: formatServerPayoutAmount(payoutAmt, payoutCur, mid.language),
          secondary: formatThbLedgerSecondary(finalThb),
          usesServerPayout: true,
          payoutCurrency: payoutCur,
        }
      }

      const thbBase = Number(preview.finalAmountThb ?? preview.baseAmountThb ?? 0)
      return {
        primary: formatLedgerThb(thbBase),
        secondary: null,
        usesServerPayout: false,
        payoutCurrency: payoutCur === 'THB' ? 'THB' : null,
      }
    },
    [formatLedgerThb, formatThbLedgerSecondary, mid.language],
  )

  return {
    ...mid,
    formatLedgerThb,
    formatThbLedgerSecondary,
    getPayoutDisplay,
  }
}
