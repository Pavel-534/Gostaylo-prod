/**
 * POST /api/v2/partner/geo/provisional
 * Upsert provisional city/neighborhood into geo_locations (Stage 200.36 / 200.45).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { GeoService } from '@/lib/services/geo/geo.service'
import {
  normalizeGeoPlaceKey,
  normalizeGeoPlaceName,
} from '@/lib/geo/normalize-geo-place-name'

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
    const name = normalizeGeoPlaceName(body.name || body.cityLabel || '')
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

    await GeoService.ensureCountryLocation({ code: country_code })

    // Reuse existing city with same normalized label under country when possible
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('geo_locations')
        .select('code,level,parent_code,label_en,label_ru,country_code,timezone,centroid_lat,centroid_lng')
        .eq('country_code', country_code)
        .eq('level', level)
        .eq('is_active', true)
        .limit(200)
      const needle = normalizeGeoPlaceKey(name)
      const hit = (existing || []).find((r) => {
        const en = normalizeGeoPlaceKey(r.label_en)
        const ru = normalizeGeoPlaceKey(r.label_ru)
        return en === needle || ru === needle
      })
      if (hit) {
        // Stage 200.47 — backfill centroid / TZ when reuse + pin available
        const hasPin = Number.isFinite(lat) && Number.isFinite(lng)
        const needsCentroid =
          hasPin && (hit.centroid_lat == null || hit.centroid_lng == null)
        if (needsCentroid || (hasPin && body.timezone)) {
          const { resolveListingPlaceTimezone } = await import(
            '@/lib/geo/listing-timezone-guess'
          )
          const patch = {
            updated_at: new Date().toISOString(),
          }
          if (needsCentroid) {
            patch.centroid_lat = lat
            patch.centroid_lng = lng
          }
          if (hasPin || body.timezone) {
            patch.timezone = resolveListingPlaceTimezone({
              lat: hasPin ? lat : hit.centroid_lat,
              lon: hasPin ? lng : hit.centroid_lng,
              explicitTimezone: body.timezone || hit.timezone,
              countryCode: country_code,
            })
          }
          const { data: updated } = await supabaseAdmin
            .from('geo_locations')
            .update(patch)
            .eq('code', hit.code)
            .select(
              'code,level,parent_code,label_en,label_ru,country_code,timezone,centroid_lat,centroid_lng',
            )
            .maybeSingle()
          return NextResponse.json({
            success: true,
            data: updated || { ...hit, ...patch },
            reused: true,
          })
        }
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
