/**
 * GET /api/v2/listing-views/resolve?ids=lst-a,lst-b
 * Public — hydrate localStorage recent views with ACTIVE catalog cards only.
 */

import { NextResponse } from 'next/server'
import { resolveActiveRecentListingCards } from '@/lib/recommendations/listing-views.service'
import { RECENTLY_VIEWED_MAX } from '@/lib/recommendations/recently-viewed-merge'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const raw = request.nextUrl.searchParams.get('ids') || ''
    const orderedIds = raw
      .split(',')
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .slice(0, RECENTLY_VIEWED_MAX)

    if (!orderedIds.length) {
      return NextResponse.json({ success: true, items: [], count: 0 })
    }

    const items = await resolveActiveRecentListingCards(orderedIds)
    return NextResponse.json({ success: true, items, count: items.length })
  } catch (error) {
    console.error('[LISTING VIEWS RESOLVE]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
