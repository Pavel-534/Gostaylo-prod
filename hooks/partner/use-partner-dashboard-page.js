'use client'

import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '@/contexts/i18n-context'
import { usePartnerStats } from '@/lib/hooks/use-partner-stats'
import { usePartnerDashboardBookingActions } from '@/hooks/partner/use-partner-dashboard-booking-actions'

/**
 * Stage 111.0 — состояние и данные партнёрского дашборда.
 */
export function usePartnerDashboardPage() {
  const { language } = useI18n()
  const [partnerId, setPartnerId] = useState(null)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      setPartnerId(parsed.id)
      setUserName(parsed.name || parsed.first_name || 'Partner')
      const hasSeenWelcome = localStorage.getItem(`welcome_partner_${parsed.id}`)
      if (parsed.role === 'PARTNER' && !hasSeenWelcome) {
        setShowWelcomeModal(true)
        localStorage.setItem(`welcome_partner_${parsed.id}`, 'true')
      }
    } catch {
      /* ignore */
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

  const { handleApprove, handleDecline } = usePartnerDashboardBookingActions(partnerId)

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
    showWelcomeModal,
    setShowWelcomeModal,
    userName,
  }
}
