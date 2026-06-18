/**
 * GET /api/v2/favorites/check?listingId= — O(1) favorite state (ADR-167 SSOT).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionFromCookies } from '@/lib/auth/session-from-cookie'

export const dynamic = 'force-dynamic'

async function getUserOrError() {
  const result = await verifySessionFromCookies()
  if (!result.ok && result.reason === 'misconfigured') {
    return { error: result.message, status: 500 }
  }
  if (!result.ok) {
    return { user: null, status: 401 }
  }
  return { user: result.payload, status: null }
}

export async function GET(request) {
  try {
    const session = await getUserOrError()
    if (session.error) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status })
    }
    const user = session.user
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const listingId = String(searchParams.get('listingId') || '').trim()
    if (!listingId) {
      return NextResponse.json({ success: false, error: 'listingId required' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.userId)
      .eq('listing_id', listingId)
      .maybeSingle()

    if (error) {
      console.error('[FAVORITES CHECK] Error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      listingId,
      isFavorite: Boolean(data?.id),
    })
  } catch (error) {
    console.error('[FAVORITES CHECK] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
