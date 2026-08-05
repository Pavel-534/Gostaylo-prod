/**
 * POST /api/v2/partner/geo/provisional
 * Upsert provisional city/neighborhood into geo_locations (Stage 200.36).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { GeoService } from '@/lib/services/geo/geo.service'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const userId = await getUserIdFromSession(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner only' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const name = String(body.name || body.cityLabel || '').trim()
    const country_code = String(body.country_code || body.countryCode || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    const parent_code = body.parent_code || body.parentCode || body.region_code || body.regionCode || null
    const level = body.level === 'neighborhood' ? 'neighborhood' : 'city'
    const lat = body.lat != null ? Number(body.lat) : null
    const lng = body.lng != null ? Number(body.lng) : body.lon != null ? Number(body.lon) : null

    if (!name || name.length < 2) {
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 })
    }
    if (!/^[A-Z]{2}$/.test(country_code)) {
      return NextResponse.json({ success: false, error: 'country_code required' }, { status: 400 })
    }

    // Reuse existing city with same label under country when possible
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('geo_locations')
        .select('code,level,parent_code,label_en,label_ru,country_code')
        .eq('country_code', country_code)
        .eq('level', level)
        .eq('is_active', true)
        .limit(100)
      const needle = name.toLowerCase()
      const hit = (existing || []).find(
        (r) =>
          String(r.label_en || '').toLowerCase() === needle ||
          String(r.label_ru || '').toLowerCase() === needle,
      )
      if (hit) {
        return NextResponse.json({ success: true, data: hit, reused: true })
      }
    }

    const row = await GeoService.upsertProvisionalLocation({
      name,
      level,
      parent_code,
      lat,
      lng,
      country_code,
      timezone: body.timezone || null,
    })

    return NextResponse.json({ success: true, data: row, reused: false })
  } catch (e) {
    console.error('[partner/geo/provisional]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Failed', code: e.code },
      { status: e.code === 'GEO_COUNTRY_REQUIRED' ? 400 : 500 },
    )
  }
}
