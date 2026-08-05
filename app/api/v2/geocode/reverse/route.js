/**
 * Reverse geocoding via GeoService (Stage 200.35) — Nominatim + cache.
 * GET /api/v2/geocode/reverse?lat=&lon=
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
    const lat = parseFloat(searchParams.get('lat'))
    const lon = parseFloat(searchParams.get('lon'))
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { success: false, error: 'Valid lat and lon required' },
        { status: 400 },
      )
    }

    const resolved = await GeoService.resolveFromPin(lat, lon)
    if (!resolved.ok && resolved.degraded) {
      return NextResponse.json({
        success: true,
        degraded: true,
        data: {
          displayName: '',
          district: '',
          city: '',
          country: '',
          countryCode: null,
          state: null,
          address: {},
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        displayName: resolved.displayName || '',
        district: resolved.district || '',
        city: resolved.city_name || '',
        country: resolved.address?.country || '',
        countryCode: resolved.country_code || null,
        state: resolved.address?.state || resolved.region_code || null,
        address: resolved.address || {},
        // Stage 200.35 extras (backward-compatible; clients may ignore)
        regionCode: resolved.region_code || null,
        cityCode: resolved.city_code || null,
        timezone: resolved.timezone || null,
        currencyCode: resolved.currency_code || null,
        geoSource: resolved.geo_source || null,
      },
    })
  } catch (error) {
    console.error('[REVERSE GEOCODE ERROR]', error)
    const status = error?.code === 'GEO_INVALID_COORDS' ? 400 : error?.code === 'NOMINATIM_UNAVAILABLE' ? 502 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
