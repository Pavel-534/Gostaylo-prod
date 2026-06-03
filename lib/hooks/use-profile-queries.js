'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuthMe } from '@/lib/api/auth-client'
import { queryFetchJson } from '@/lib/api/query-fetch'
import { queryKeys, queryScopeId } from '@/lib/query-keys'

const PROFILE_STALE_MS = 60 * 1000
const PARTNER_STATUS_STALE_MS = 60 * 1000

/**
 * Профиль текущего пользователя (SSOT: `/api/v2/auth/me`).
 * @param {{ enabled?: boolean, profileId?: string | null }} [options]
 */
export function useProfileMeQuery(options = {}) {
  const { enabled = true, profileId = null } = options
  const scope = queryScopeId(profileId)

  return useQuery({
    queryKey: queryKeys.profile.me(scope),
    queryFn: async () => {
      const { ok, user } = await fetchAuthMe()
      if (!ok || !user) throw new Error('PROFILE_ME_FAILED')
      return user
    },
    enabled: enabled && scope !== 'public',
    staleTime: PROFILE_STALE_MS,
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * Статус заявки партнёра (`GET /api/v2/partner/application-status`).
 * @param {{ enabled?: boolean, profileId?: string | null }} [options]
 */
export function usePartnerApplicationStatusQuery(options = {}) {
  const { enabled = true, profileId = null } = options
  const scope = queryScopeId(profileId)

  return useQuery({
    queryKey: queryKeys.profile.partnerApplicationStatus(scope),
    queryFn: () => queryFetchJson('/api/v2/partner/application-status'),
    enabled: enabled && scope !== 'public',
    staleTime: PARTNER_STATUS_STALE_MS,
    gcTime: 10 * 60 * 1000,
  })
}

export function invalidateProfileQueries(queryClient, profileId) {
  const scope = queryScopeId(profileId)
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me(scope) })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.profile.partnerApplicationStatus(scope),
  })
}

export function useInvalidateProfileQueries() {
  const qc = useQueryClient()
  return (profileId) => invalidateProfileQueries(qc, profileId)
}
