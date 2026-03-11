/**
 * useCommission Hook
 * Fetches the effective commission rate from the database
 * Falls back to 15% if API fails
 */

import { useState, useEffect } from 'react'

export function useCommission(partnerId = null) {
  const [commission, setCommission] = useState({
    systemRate: 15,
    personalRate: null,
    effectiveRate: 15,
    partnerEarningsPercent: 85,
    loading: true,
    error: null
  })

  useEffect(() => {
    const fetchCommission = async () => {
      try {
        const url = partnerId 
          ? `/api/v2/commission?partnerId=${partnerId}`
          : '/api/v2/commission'
        
        const res = await fetch(url)
        const data = await res.json()
        
        if (data.success) {
          setCommission({
            ...data.data,
            loading: false,
            error: null
          })
        } else {
          throw new Error(data.error || 'Failed to fetch')
        }
      } catch (error) {
        console.error('useCommission error:', error)
        setCommission(prev => ({
          ...prev,
          loading: false,
          error: error.message
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
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Get system rate
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .single()

    const systemRate = settings?.value?.defaultCommissionRate || 15

    // Get personal rate if partnerId provided
    let personalRate = null
    if (partnerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .single()

      if (profile?.custom_commission_rate !== null) {
        personalRate = profile.custom_commission_rate
      }
    }

    const effectiveRate = personalRate !== null ? personalRate : systemRate

    return {
      systemRate,
      personalRate,
      effectiveRate,
      partnerEarningsPercent: 100 - effectiveRate
    }
  } catch (error) {
    console.error('getCommissionRate error:', error)
    return {
      systemRate: 15,
      personalRate: null,
      effectiveRate: 15,
      partnerEarningsPercent: 85
    }
  }
}
