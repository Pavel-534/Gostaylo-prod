'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchReferralMe } from '@/lib/api/referral-me-client'

export const REFERRAL_ME_QUERY_KEY = ['referral-me']

async function loadReferralMe() {
  const { ok, data, json } = await fetchReferralMe()
  if (!ok) {
    throw new Error(json?.error || json?.error_code || 'REFERRAL_ME_FAILED')
  }
  return data
}

/**
 * Shared cache for `/profile/referral` and `/profile/status` (Stage 114.1).
 */
export function useReferralMeQuery(options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: REFERRAL_ME_QUERY_KEY,
    queryFn: loadReferralMe,
    enabled,
    staleTime: 30_000,
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
