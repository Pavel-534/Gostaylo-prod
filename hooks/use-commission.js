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

/**
 * getCommissionRate - Server-side function to get commission rate
 * Use this in API routes or server components
 */
export async function getCommissionRate(partnerId = null) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const { resolveDefaultCommissionPercent } = await import('@/lib/services/currency.service')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )

    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'general').single()

    const raw = settings?.value?.defaultCommissionRate
    const parsed = parseFloat(raw)
    const systemRate =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : await resolveDefaultCommissionPercent()

    let personalRate = null
    if (partnerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .single()

      if (profile?.custom_commission_rate !== null && profile?.custom_commission_rate !== undefined) {
        personalRate = profile.custom_commission_rate
      }
    }

    const effectiveRate = personalRate !== null ? personalRate : systemRate

    const g = parseFloat(settings?.value?.guestServiceFeePercent ?? settings?.value?.serviceFeePercent)
    const guestServiceFeePercent =
      Number.isFinite(g) && g >= 0 && g <= 100 ? g : PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent

    const ins = parseFloat(settings?.value?.insuranceFundPercent)
    const insuranceFundPercent =
      Number.isFinite(ins) && ins >= 0 && ins <= 100 ? ins : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent

    return {
      systemRate,
      personalRate,
      effectiveRate,
      partnerEarningsPercent: 100 - effectiveRate,
      guestServiceFeePercent,
      hostCommissionPercent: effectiveRate,
      insuranceFundPercent,
    }
  } catch (error) {
    console.error('getCommissionRate error:', error)
    const { resolveDefaultCommissionPercent } = await import('@/lib/services/currency.service')
    const fallback = await resolveDefaultCommissionPercent()
    return {
      systemRate: fallback,
      personalRate: null,
      effectiveRate: fallback,
      partnerEarningsPercent: 100 - fallback,
      guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: fallback,
      insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    }
  }
}
