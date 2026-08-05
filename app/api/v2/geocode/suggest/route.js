/**
 * GET /api/v2/geocode/suggest?q=...&country=TH
 * Catalog-first autocomplete (geo_locations + synonyms) + Nominatim via GeoService.
 * Alias of resolveFromQuery for map-first wizard (Stage 200.36).
 */

import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { GeoService } from '@/lib/services/geo/geo.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const rl = await rateLimitCheck(request, 'geocode')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    const country = searchParams.get('country') || searchParams.get('country_code') || undefined
    if (!q || q.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query too short (min 3 chars)' },
        { status: 400 },
      )
    }

    const results = await GeoService.resolveFromQuery(q, country)
    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('[GEOCODE SUGGEST]', error)
    const status =
      error?.code === 'GEO_QUERY_SHORT' ? 400 : error?.code === 'NOMINATIM_UNAVAILABLE' ? 502 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
