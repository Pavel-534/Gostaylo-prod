'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPartnerBalanceBreakdown } from '@/lib/api/partner-finances-client'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'

export const partnerDashboardMoneyKeys = {
  all: ['partner-dashboard-money'],
  breakdown: () => [...partnerDashboardMoneyKeys.all, 'breakdown'],
}

/**
 * Stage 187.0 — escrow ledger + marketing wallet for dashboard money card.
 */
export function usePartnerDashboardMoney(options = {}) {
  const { enabled = true } = options

  const walletQuery = useWalletMeQuery({ enabled })
  const breakdownQuery = useQuery({
    queryKey: partnerDashboardMoneyKeys.breakdown(),
    queryFn: () => fetchPartnerBalanceBreakdown({ limit: 0 }),
    enabled,
    staleTime: 60 * 1000,
    retry: 2,
  })

  const wd = Number(
    walletQuery.data?.balances?.withdrawableBalanceThb
      ?? walletQuery.data?.wallet?.withdrawable_balance_thb
      ?? 0,
  )
  const internal = Number(
    walletQuery.data?.balances?.internalCreditsThb
      ?? walletQuery.data?.wallet?.internal_credits_thb
      ?? 0,
  )
  const bonusesThb = Math.max(0, wd + internal)

  const breakdown = breakdownQuery.data
  const availableThb = Number(breakdown?.availableBalanceThb ?? 0)
  const inProcessingThb = Math.max(
    0,
    Number(breakdown?.frozenBalanceThb ?? 0)
      + Number(breakdown?.thawHoldBalanceThb ?? 0)
      + Number(breakdown?.pendingPayoutsThb ?? 0),
  )

  return {
    availableThb,
    inProcessingThb,
    bonusesThb,
    showBonuses: bonusesThb > 0,
    isLoading: walletQuery.isLoading || breakdownQuery.isLoading,
    isError: walletQuery.isError || breakdownQuery.isError,
    refetch: async () => {
      await Promise.all([walletQuery.refetch(), breakdownQuery.refetch()])
    },
  }
}
