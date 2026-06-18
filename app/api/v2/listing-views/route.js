/**
 * GET /api/v2/listing-views — recent views (lite cards)
 * POST /api/v2/listing-views — upsert viewed_at { listingId }
 */

import { NextResponse } from 'next/server'
import { verifySessionFromCookies } from '@/lib/auth/session-from-cookie'
import {
  fetchRecentListingViews,
  upsertListingView,
} from '@/lib/recommendations/listing-views.service'

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

export async function GET() {
  try {
    const session = await getUserOrError()
    if (session.error) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status })
    }
    const user = session.user
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const items = await fetchRecentListingViews(user.userId)
    return NextResponse.json({ success: true, items, count: items.length })
  } catch (error) {
    console.error('[LISTING VIEWS GET]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getUserOrError()
    if (session.error) {
      return NextResponse.json({ success: false, error: session.error }, { status: session.status })
    }
    const user = session.user
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const listingId = String(body?.listingId || '').trim()
    if (!listingId) {
      return NextResponse.json({ success: false, error: 'listingId required' }, { status: 400 })
    }

    const result = await upsertListingView(user.userId, listingId)
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.reason || 'upsert_failed' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      listingId,
      viewedAt: result.viewedAt,
    })
  } catch (error) {
    console.error('[LISTING VIEWS POST]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
