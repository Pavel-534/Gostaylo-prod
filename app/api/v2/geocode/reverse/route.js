/**
 * GoStayLo - Reverse Geocoding API (Nominatim / OpenStreetMap)
 * GET /api/v2/geocode/reverse?lat=7.88&lon=98.39
 * Converts coordinates to address. Free, no API key. Rate limit: 1 req/sec.
 */

import { NextResponse } from 'next/server'
import { getNominatimUserAgent } from '@/lib/http-client-identity'

export const dynamic = 'force-dynamic'

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat'))
    const lon = parseFloat(searchParams.get('lon'))
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { success: false, error: 'Valid lat and lon required' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'en',
    })

    const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
      headers: {
        'User-Agent': getNominatimUserAgent(),
        'Accept-Language': 'en',
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'Reverse geocoding unavailable' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const addr = data?.address || {}
    // Build district: prefer suburb > neighbourhood > city > municipality > state
    const district = addr.suburb || addr.neighbourhood || addr.city || addr.municipality || addr.state || addr.county || ''
    const city = addr.city || addr.municipality || addr.state || addr.county || ''
    const country = addr.country || ''

    return NextResponse.json({
      success: true,
      data: {
        displayName: data.display_name || '',
        district,
        city,
        country,
        address: addr,
      },
    })
  } catch (error) {
    console.error('[REVERSE GEOCODE ERROR]', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
