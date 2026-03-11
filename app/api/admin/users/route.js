/**
 * Admin User Update API
 * PATCH - Update user profile (commission, verification, role)
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request) {
  try {
    const body = await request.json()
    const { userId, updates } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Validate allowed fields
    const allowedFields = [
      'custom_commission_rate',
      'role',
      'is_verified',
      'verification_status'
    ]

    const sanitizedUpdates = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        sanitizedUpdates[key] = updates[key]
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    // Update profile using service role key (bypasses RLS)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(sanitizedUpdates)
      }
    )

    if (!res.ok) {
      const errorText = await res.text()
      console.error('Failed to update user:', errorText)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    const updated = await res.json()

    return NextResponse.json({ 
      success: true, 
      data: updated[0] || null
    })

  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
