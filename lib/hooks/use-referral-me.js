'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReferralMe } from '@/lib/api/referral-me-client'

export const REFERRAL_ME_QUERY_KEY = ['referral-me']

/**
 * Shared cache for `/profile/referral` and `/profile/status` (Stage 114.1 / 114.5).
 */
export function useReferralMeQuery(options = {}) {
  const { enabled = true, includeTeam = true, teamLimit = 80, teamOffset = 0 } = options
  return useQuery({
    queryKey: [...REFERRAL_ME_QUERY_KEY, { includeTeam, teamLimit, teamOffset }],
    queryFn: async () => {
      const { ok, data, json } = await fetchReferralMe({ includeTeam, teamLimit, teamOffset })
      if (!ok) {
        throw new Error(json?.error || json?.error_code || 'REFERRAL_ME_FAILED')
      }
      return data
    },
    enabled,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
  })
}

export function invalidateReferralMeQuery(queryClient) {
  if (!queryClient) return Promise.resolve()
  return queryClient.invalidateQueries({ queryKey: REFERRAL_ME_QUERY_KEY })
}

export function useInvalidateReferralMe() {
  const qc = useQueryClient()
  return () => invalidateReferralMeQuery(qc)
}
