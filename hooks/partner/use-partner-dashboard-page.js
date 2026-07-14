'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { usePartnerStats } from '@/lib/hooks/use-partner-stats'

async function shouldSuppressGenericWelcome(partnerId) {
  try {
    const res = await fetch('/api/v2/partner/referral-context', { cache: 'no-store' })
    if (!res.ok) return false
    const j = await res.json().catch(() => ({}))
    const ctx = j?.data
    return Boolean(
      ctx?.directReferrerId && !ctx?.hostActivationCompleted && ctx?.referredBy?.displayName,
    )
  } catch {
    return false
  }
}

/**
 * Stage 111.0 — партнёрский дашборд.
 * Stage 173.3 — partnerId из useAuth (не только localStorage); один refresh при гонке сессии.
 * Stage 187.0 — stats lite; money card loads balances separately.
 */
export function usePartnerDashboardPage() {
  const { language } = useI18n()
  const { user, loading: authLoading, isAuthenticated, refreshUserFromServer } = useAuth()
  const identityRefreshAttempted = useRef(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)

  const partnerId = user?.id ?? null
  const userName =
    user?.name || user?.first_name || user?.firstName || (partnerId ? 'Partner' : '')

  const authHydrating = authLoading || (isAuthenticated && !partnerId)

  useEffect(() => {
    if (authLoading || partnerId || !isAuthenticated || identityRefreshAttempted.current) return
    identityRefreshAttempted.current = true
    void refreshUserFromServer()
  }, [authLoading, partnerId, isAuthenticated, refreshUserFromServer])

  useEffect(() => {
    const uid = partnerId
    if (!uid || String(user?.role || '').toUpperCase() !== 'PARTNER') return

    let cancelled = false
    const hasSeenWelcome = localStorage.getItem(`welcome_partner_${uid}`)
    if (hasSeenWelcome) return

    void (async () => {
      const suppress = await shouldSuppressGenericWelcome(uid)
      if (cancelled) return
      localStorage.setItem(`welcome_partner_${uid}`, 'true')
      if (!suppress) setShowWelcomeModal(true)
    })()

    return () => {
      cancelled = true
    }
  }, [partnerId, user?.role])

  const { data: stats, isLoading, isError, refetch } = usePartnerStats(partnerId, {
    enabled: !!partnerId,
    lite: true,
  })

  return {
    language,
    partnerId,
    authHydrating,
    refreshIdentity: refreshUserFromServer,
    stats,
    isLoading,
    isError,
    refetch,
    showWelcomeModal,
    setShowWelcomeModal,
    userName,
  }
}
