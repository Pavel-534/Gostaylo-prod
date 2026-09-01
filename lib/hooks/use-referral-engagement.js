'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchReferralEngagement } from '@/lib/api/referral-engagement-client'

export const REFERRAL_ENGAGEMENT_QUERY_KEY = ['referral-engagement']

/**
 * Local Leader tier + quests + roadmap (`/api/v2/referral/me/engagement`).
 */
export function useReferralEngagementQuery(options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: REFERRAL_ENGAGEMENT_QUERY_KEY,
    queryFn: async () => {
      const { ok, data, json } = await fetchReferralEngagement()
      if (!ok) {
        throw new Error(json?.error || json?.error_code || 'REFERRAL_ENGAGEMENT_FAILED')
      }
      return data
    },
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}
