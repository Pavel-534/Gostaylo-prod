/**
 * Commission Rate API
 * GET - Fetch effective commission rate for a partner
 * 
 * Query params:
 * - partnerId: Get personalized rate for specific partner (optional)
 * 
 * Returns:
 * - systemRate: The global system commission rate
 * - personalRate: Partner's personal rate (if set)
 * - effectiveRate: The rate that should be used (personal || system)
 */

import { NextResponse } from 'next/server'
import {
  resolveDefaultCommissionPercent,
  resolveChatInvoiceRateMultiplier,
} from '@/lib/services/currency.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')

    // 1. Get system commission rate via direct REST API to bypass any SDK caching
    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=eq.general&select=value`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      }
    )
    
    const settingsData = await settingsRes.json()
    const general = settingsData?.[0]?.value || {}
    const rawSystem = general?.hostCommissionPercent ?? general?.defaultCommissionRate
    const parsedSystem = parseFloat(rawSystem)
    const parsedGuestFee = parseFloat(
      general?.guestServiceFeePercent ?? general?.serviceFeePercent
    )
    const parsedInsurance = parseFloat(general?.insuranceFundPercent)
    const parsedMarkup = parseFloat(general?.chatInvoiceRateMultiplier)
    const systemRate =
      Number.isFinite(parsedSystem) && parsedSystem >= 0 && parsedSystem <= 100
        ? parsedSystem
        : await resolveDefaultCommissionPercent()
    const guestServiceFeePercent =
      Number.isFinite(parsedGuestFee) && parsedGuestFee >= 0 && parsedGuestFee <= 100
        ? parsedGuestFee
        : 5
    const insuranceFundPercent =
      Number.isFinite(parsedInsurance) && parsedInsurance >= 0 && parsedInsurance <= 100
        ? parsedInsurance
        : 0.5
    const chatInvoiceRateMultiplier =
      Number.isFinite(parsedMarkup) && parsedMarkup >= 1 && parsedMarkup <= 1.5
        ? parsedMarkup
        : await resolveChatInvoiceRateMultiplier()

    // 2. If partnerId provided, check for personal rate
    let personalRate = null
    if (partnerId) {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${partnerId}&select=custom_commission_rate`,
        {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Cache-Control': 'no-cache'
          },
          cache: 'no-store'
        }
      )
      
      const profileData = await profileRes.json()
      if (profileData?.[0]?.custom_commission_rate !== null && profileData?.[0]?.custom_commission_rate !== undefined) {
        const p = parseFloat(profileData[0].custom_commission_rate)
        if (Number.isFinite(p) && p >= 0 && p <= 100) personalRate = p
      }
    }

    // 3. Calculate effective rate
    const effectiveRate = personalRate !== null ? personalRate : systemRate

    return NextResponse.json({
      success: true,
      data: {
        systemRate,
        personalRate,
        effectiveRate,
        partnerEarningsPercent: 100 - effectiveRate,
        guestServiceFeePercent,
        hostCommissionPercent: effectiveRate,
        insuranceFundPercent,
        chatInvoiceRateMultiplier,
      }
    })

  } catch (error) {
    console.error('Commission API error:', error)
    const fallback = await resolveDefaultCommissionPercent()
    return NextResponse.json({
      success: true,
      data: {
        systemRate: fallback,
        personalRate: null,
        effectiveRate: fallback,
        partnerEarningsPercent: 100 - fallback,
        guestServiceFeePercent: 5,
        hostCommissionPercent: fallback,
        insuranceFundPercent: 0.5,
        chatInvoiceRateMultiplier: await resolveChatInvoiceRateMultiplier(),
      },
    })
  }
}
