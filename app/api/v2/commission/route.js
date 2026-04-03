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
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'

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
    const rawSystem = settingsData?.[0]?.value?.defaultCommissionRate
    const parsedSystem = parseFloat(rawSystem)
    const systemRate =
      Number.isFinite(parsedSystem) && parsedSystem >= 0 && parsedSystem <= 100
        ? parsedSystem
        : await resolveDefaultCommissionPercent()

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
        personalRate = profileData[0].custom_commission_rate
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
        partnerEarningsPercent: 100 - effectiveRate
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
      },
    })
  }
}
