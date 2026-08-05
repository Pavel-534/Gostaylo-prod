/**
 * GET /api/v2/locations — legacy City → District hierarchy from ACTIVE listings.
 * Stage 200.37 — no Phuket default; prefer /api/v2/search/locations.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LISTINGS_PUBLIC_CATALOG_VIEW } from '@/lib/db/listings-public-catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from(LISTINGS_PUBLIC_CATALOG_VIEW)
      .select('district, city_code, region_code, country_code, metadata')
      .not('district', 'is', null)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const districtByCity = new Map()
    for (const l of listings || []) {
      const meta =
        l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata)
          ? l.metadata
          : {}
      const city =
        String(meta.city_label || meta.city || '').trim() ||
        String(l.city_code || '').trim() ||
        String(l.region_code || '').trim() ||
        String(l.country_code || '').trim() ||
        'Other'
      const district = (l.district || '').trim()
      if (!district) continue
      if (!districtByCity.has(city)) {
        districtByCity.set(city, new Set())
      }
      districtByCity.get(city).add(district)
    }

    const cities = Array.from(districtByCity.keys()).sort()
    const locations = cities.map((city) => ({
      city,
      districts: Array.from(districtByCity.get(city)).sort(),
    }))

    return NextResponse.json({ success: true, data: { cities, locations } })
  } catch (err) {
    console.error('[LOCATIONS API]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
