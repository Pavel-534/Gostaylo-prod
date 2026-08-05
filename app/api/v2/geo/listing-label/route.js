/**
 * GET /api/v2/geo/listing-label
 * Stage 200.39 — enrich listing location display from geo_locations (client cards / orders).
 */

import { NextResponse } from 'next/server'
import { formatListingLocationLine } from '@/lib/locations/geo-display-label'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const language = searchParams.get('lang') || 'ru'
    const line = await formatListingLocationLine({
      countryCode: searchParams.get('country') || searchParams.get('countryCode'),
      regionCode: searchParams.get('region') || searchParams.get('regionCode'),
      cityCode: searchParams.get('city') || searchParams.get('cityCode'),
      district: searchParams.get('district'),
      cityLabel: searchParams.get('cityLabel') || searchParams.get('city_label'),
      language,
    })
    return NextResponse.json({
      success: true,
      data: { label: line || null },
    })
  } catch (e) {
    console.error('[geo/listing-label]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
