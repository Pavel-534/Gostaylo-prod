'use client'

import { useQuery } from '@tanstack/react-query'

export const PARTNER_REPUTATION_HEALTH_QUERY_KEY = ['partner', 'reputation-health']

/**
 * Кэшированный снимок reputation-health (Stage 28.0) — общий ключ для дашборда и календаря.
 * @param {boolean} [enabled]
 */
export function usePartnerReputationHealthQuery(enabled = true) {
  return useQuery({
    queryKey: PARTNER_REPUTATION_HEALTH_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/v2/partner/reputation-health', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'load_failed')
      }
      return json.data
    },
    enabled: Boolean(enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}
