/**
 * Admin Single User API
 * GET - Fetch specific user profile with all related data
 * Uses SERVICE_ROLE_KEY to bypass RLS
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Fetch user profile using SERVICE_ROLE_KEY (bypasses RLS)
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Cache-Control': 'no-cache'
        }
      }
    )

    if (!profileRes.ok) {
      const errorText = await profileRes.text()
      console.error('[ADMIN USER] Failed to fetch profile:', errorText)
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }

    const profiles = await profileRes.json()

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const profile = profiles[0]

    // Fetch partner applications
    const appsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/partner_applications?user_id=eq.${userId}&select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Cache-Control': 'no-cache'
        }
      }
    )

    const applications = appsRes.ok ? await appsRes.json() : []

    // Fetch listings (if partner)
    let listings = []
    if (profile.role === 'PARTNER') {
      const listingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?owner_id=eq.${userId}&select=id,title,status,base_price_thb,category_id&order=created_at.desc&limit=10`,
        {
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Cache-Control': 'no-cache'
          }
        }
      )

      listings = listingsRes.ok ? await listingsRes.json() : []
    }

    return NextResponse.json({
      success: true,
      data: {
        profile,
        applications,
        listings
      }
    })

  } catch (error) {
    console.error('[ADMIN USER] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
