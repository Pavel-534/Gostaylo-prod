'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchPartnerReputationHealth } from '@/lib/api/partner-listing-client'

export const PARTNER_REPUTATION_HEALTH_QUERY_KEY = ['partner', 'reputation-health']

/**
 * Кэшированный снимок reputation-health (Stage 28.0) — общий ключ для дашборда и календаря.
 * @param {boolean} [enabled]
 */
export function usePartnerReputationHealthQuery(enabled = true) {
  return useQuery({
    queryKey: PARTNER_REPUTATION_HEALTH_QUERY_KEY,
    queryFn: async () => {
      const { ok, data, error } = await fetchPartnerReputationHealth()
      if (!ok) throw new Error(error || 'load_failed')
      return data
    },
    enabled: Boolean(enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}
