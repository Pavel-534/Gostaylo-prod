/**
 * Admin Users List API  
 * GET - Fetch all users (bypasses RLS using SERVICE_ROLE_KEY)
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Fetch ALL profiles using SERVICE_ROLE_KEY (bypasses RLS)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=*&order=created_at.desc`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Cache-Control': 'no-cache'
        }
      }
    )

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[ADMIN USERS] Failed to fetch profiles:', errorText)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const profiles = await res.json()

    return NextResponse.json({
      success: true,
      data: profiles || [],
      count: profiles?.length || 0
    })

  } catch (error) {
    console.error('[ADMIN USERS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
