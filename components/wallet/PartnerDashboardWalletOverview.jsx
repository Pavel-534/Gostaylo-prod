'use client'

/**
 * Единый блок балансов на дашборде партнёра — тот же кэш `wallet-me`, что и в шапке.
 */

import { useMemo } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { UnifiedBalanceSummary } from '@/components/wallet/UnifiedBalanceSummary'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'

export function PartnerDashboardWalletOverview() {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { data: payload, isLoading } = useWalletMeQuery()

  if (isLoading || !payload) return null

  return <UnifiedBalanceSummary walletPayload={payload} t={t} />
}
