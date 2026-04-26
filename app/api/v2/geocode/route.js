/**
 * GoStayLo - Geocoding API (Nominatim / OpenStreetMap)
 * GET /api/v2/geocode?q=Rawai+Phuket+Thailand
 * Free, no API key required. Rate limit: 1 req/sec.
 */

import { NextResponse } from 'next/server'
import { getNominatimUserAgent } from '@/lib/http-client-identity'

export const dynamic = 'force-dynamic'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')
    if (!q || q.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query too short (min 3 chars)' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      q: q.trim(),
      format: 'json',
      limit: '5',
      addressdetails: '1',
    })

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        'User-Agent': getNominatimUserAgent(),
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Geocoding service unavailable' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const results = (Array.isArray(data) ? data : []).map((r) => ({
      lat: parseFloat(r.lat),
      lon: parseFloat(r.lon),
      displayName: r.display_name,
      type: r.type,
      address: r.address || {},
    }))

    return NextResponse.json({ success: true, data: results })
  } catch (error) {
    console.error('[GEOCODE ERROR]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
