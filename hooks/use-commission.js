/**
 * useCommission Hook
 * Fetches the effective commission rate from /api/v2/commission (backed by DB + CurrencyService).
 */

import { useState, useEffect } from 'react'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { platformDefaultChatInvoiceRateMultiplier } from '@/lib/services/currency-last-resort.js'

export function useCommission(partnerId = null) {
  const [commission, setCommission] = useState({
    systemRate: null,
    personalRate: null,
    effectiveRate: null,
    partnerEarningsPercent: null,
    guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
    hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    chatInvoiceRateMultiplier: platformDefaultChatInvoiceRateMultiplier(),
    taxRatePercent: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const fetchCommission = async () => {
      try {
        const url = partnerId
          ? `/api/v2/commission?partnerId=${partnerId}`
          : '/api/v2/commission'

        const res = await fetch(url, { credentials: 'include' })
        const data = await res.json()

        if (data.success && data.data) {
          setCommission({
            ...data.data,
            loading: false,
            error: null,
          })
        } else {
          throw new Error(data.error || 'Failed to fetch')
        }
      } catch (error) {
        console.error('useCommission error:', error)
        setCommission((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }))
      }
    }

    fetchCommission()
  }, [partnerId])

  return commission
}
