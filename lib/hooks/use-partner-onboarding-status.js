'use client'

import { useQuery } from '@tanstack/react-query'

export const partnerOnboardingStatusKeys = {
  all: ['partner-onboarding-status'],
}

async function fetchPartnerOnboardingStatus() {
  const res = await fetch('/api/v2/partner/onboarding-status', {
    credentials: 'include',
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || 'Failed to load onboarding status')
  }
  return json.data
}

/** Shared cache for checklist + next-steps (Stage 187.0 Iteration 4). */
export function usePartnerOnboardingStatus(options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: partnerOnboardingStatusKeys.all,
    queryFn: fetchPartnerOnboardingStatus,
    enabled,
    staleTime: 60 * 1000,
    retry: 2,
  })
}
