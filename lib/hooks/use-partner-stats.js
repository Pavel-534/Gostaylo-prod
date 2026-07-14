/**
 * usePartnerStats - TanStack Query hook for partner dashboard stats
 * Stage 187.0 — lite mode for dashboard; no silent mock on failure.
 */

'use client'

import { useQuery } from '@tanstack/react-query'

export const partnerStatsKeys = {
  all: ['partner-stats'],
  data: (partnerId, mode = 'lite') => [...partnerStatsKeys.all, 'data', partnerId, mode],
}

async function fetchPartnerStats(partnerId, { lite = true } = {}) {
  const qs = new URLSearchParams()
  if (partnerId) qs.set('partnerId', partnerId)
  if (lite) qs.set('lite', 'true')

  const res = await fetch(`/api/v2/partner/stats?${qs.toString()}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
  })

  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new Error('Invalid stats response')
  }

  const json = await res.json()
  if (!res.ok || json.status === 'error') {
    throw new Error(json.error || 'Failed to load partner stats')
  }

  if (!json.data) {
    throw new Error('Empty stats payload')
  }

  return json.data
}

export function usePartnerStats(partnerId, options = {}) {
  const { enabled = true, lite = true } = options

  return useQuery({
    queryKey: partnerStatsKeys.data(partnerId, lite ? 'lite' : 'full'),
    queryFn: () => fetchPartnerStats(partnerId, { lite }),
    enabled: !!partnerId && enabled,
    staleTime: 60 * 1000,
    retry: 2,
  })
}

export default usePartnerStats
