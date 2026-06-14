'use client'

import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { usePartnerStats } from '@/lib/hooks/use-partner-stats'
import { usePartnerDashboardBookingActions } from '@/hooks/partner/use-partner-dashboard-booking-actions'

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
 * Stage 111.0 — состояние и данные партнёрского дашборда.
 * Stage 143.1 — suppress generic welcome when referral strip is active.
 */
export function usePartnerDashboardPage() {
  const { language } = useI18n()
  const [partnerId, setPartnerId] = useState(null)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    let cancelled = false
    async function init() {
      const stored = localStorage.getItem('gostaylo_user')
      if (!stored) return
      try {
        const parsed = JSON.parse(stored)
        if (cancelled) return
        setPartnerId(parsed.id)
        setUserName(parsed.name || parsed.first_name || 'Partner')
        const hasSeenWelcome = localStorage.getItem(`welcome_partner_${parsed.id}`)
        if (parsed.role !== 'PARTNER' || hasSeenWelcome) return

        const suppress = await shouldSuppressGenericWelcome(parsed.id)
        if (cancelled) return
        localStorage.setItem(`welcome_partner_${parsed.id}`, 'true')
        if (!suppress) setShowWelcomeModal(true)
      } catch {
        /* ignore */
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  const { data: stats, isLoading, isError, refetch } = usePartnerStats(partnerId, {
    enabled: !!partnerId,
  })

  const incomeByMonthRows = stats?.financialV2?.incomeByMonth
  const incomeChartEmpty = useMemo(() => {
    const rows = incomeByMonthRows
    if (!rows?.length) return true
    return !rows.some((m) => Number(m?.amountThb) > 0)
  }, [incomeByMonthRows])

  const { handleApprove, handleDecline, isUpdatingBooking } = usePartnerDashboardBookingActions(
    partnerId,
    language,
  )

  return {
    language,
    partnerId,
    stats,
    isLoading,
    isError,
    refetch,
    incomeChartEmpty,
    handleApprove,
    handleDecline,
    isUpdatingBooking,
    showWelcomeModal,
    setShowWelcomeModal,
    userName,
  }
}
