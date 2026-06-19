/**
 * GET /api/v2/listings/[id]/similar — PDP similar listings (lite cards).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimitCheck } from '@/lib/rate-limit'
import { verifySessionFromCookies } from '@/lib/auth/session-from-cookie'
import { findSimilarListings } from '@/lib/recommendations/similar-listings.service'
import { SIMILAR_DEFAULT_LIMIT } from '@/lib/recommendations/constants'
import { readGuestViewedFromNextCookies } from '@/lib/guest/guest-signals-server'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const rl = await rateLimitCheck(request, 'search')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  const listingId = String(params?.id || '').trim()
  if (!listingId) {
    return NextResponse.json({ success: false, error: 'listing id required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = parseInt(searchParams.get('limit'), 10)
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 4), 20)
    : SIMILAR_DEFAULT_LIMIT

  let guestViewItems = []
  try {
    const session = await verifySessionFromCookies()
    if (!session.ok) {
      guestViewItems = readGuestViewedFromNextCookies(await cookies())
    }
  } catch {
    guestViewItems = readGuestViewedFromNextCookies(await cookies())
  }

  try {
    const { listings, meta } = await findSimilarListings(listingId, { limit, guestViewItems })
    return NextResponse.json({
      success: true,
      listings,
      meta,
    })
  } catch (error) {
    console.error('[similar listings API]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
