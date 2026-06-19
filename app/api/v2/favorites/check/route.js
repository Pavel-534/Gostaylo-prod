/**
 * GET /api/v2/favorites/check
 * - ?listingId= — O(1) favorite state (PDP, ADR-167 SSOT)
 * - ?listingIds=a,b,c — batch map for catalog (ADR-167 §2.5)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySessionFromCookies } from '@/lib/auth/session-from-cookie'
import { buildFavoritesMap } from '@/lib/favorites/build-favorites-map.js'
import { parseListingIdsParam } from '@/lib/favorites/parse-listing-ids.js'

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
    const listingIdsRaw = searchParams.get('listingIds')
    const listingId = String(searchParams.get('listingId') || '').trim()

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (listingIdsRaw != null && String(listingIdsRaw).trim() !== '') {
      const parsed = parseListingIdsParam(listingIdsRaw)
      if (!parsed.ok) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
      }
      if (parsed.ids.length === 0) {
        return NextResponse.json({ success: true, favorites: {} })
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.userId)
        .in('listing_id', parsed.ids)

      if (error) {
        console.error('[FAVORITES CHECK BATCH] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        favorites: buildFavoritesMap(parsed.ids, data),
      })
    }

    if (!listingId) {
      return NextResponse.json(
        { success: false, error: 'listingId or listingIds required' },
        { status: 400 },
      )
    }

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
