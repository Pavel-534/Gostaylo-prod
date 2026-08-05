/**
 * GET /api/v2/search/locations
 * Cities / districts from ACTIVE catalog listings (geo codes + metadata — no Phuket hardcode).
 * Stage 200.37
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { LISTINGS_PUBLIC_CATALOG_VIEW } from '@/lib/db/listings-public-catalog'
import { GeoService } from '@/lib/services/geo/geo.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data: listings, error } = await supabaseAdmin
      .from(LISTINGS_PUBLIC_CATALOG_VIEW)
      .select('district, city_code, region_code, country_code, metadata')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const districtsByCity = new Map()
    const allDistricts = new Set()
    const codeLabels = new Map()

    for (const l of listings || []) {
      const meta =
        l.metadata && typeof l.metadata === 'object' && !Array.isArray(l.metadata)
          ? l.metadata
          : {}
      const cityKey =
        String(l.city_code || '').trim() ||
        String(meta.city_label || meta.city || '').trim() ||
        String(l.region_code || '').trim() ||
        String(l.country_code || '').trim() ||
        'Other'
      const district = String(l.district || '').trim()
      if (district) {
        allDistricts.add(district)
        if (!districtsByCity.has(cityKey)) districtsByCity.set(cityKey, new Set())
        districtsByCity.get(cityKey).add(district)
      } else if (!districtsByCity.has(cityKey)) {
        districtsByCity.set(cityKey, new Set())
      }
      if (l.city_code) codeLabels.set(l.city_code, null)
    }

    // Resolve display labels for city codes from geo_locations
    for (const code of codeLabels.keys()) {
      try {
        const row = await GeoService.getByCode(code)
        const label = row?.label_en || row?.label_ru || code
        codeLabels.set(code, label)
      } catch {
        codeLabels.set(code, code)
      }
    }

    const cities = Array.from(districtsByCity.keys())
      .map((k) => codeLabels.get(k) || k)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))

    const districtsByCityLabeled = {}
    for (const [key, set] of districtsByCity.entries()) {
      const label = codeLabels.get(key) || key
      districtsByCityLabeled[label] = Array.from(set).sort((a, b) => a.localeCompare(b))
    }

    const result = {
      cities,
      districtsByCity: districtsByCityLabeled,
      allDistricts: Array.from(allDistricts).sort((a, b) => a.localeCompare(b)),
    }

    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    console.error('[LOCATIONS API]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
