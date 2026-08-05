/**
 * GET /api/v2/geo/locations
 * Catalog nodes from geo_locations (Stage 200.36 map-first wizard).
 * ?level=country | ?parent=CODE | ?code=CODE
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function mapRow(row, lang = 'ru') {
  const label =
    (lang === 'en' && row.label_en) ||
    (lang === 'th' && row.label_th) ||
    (lang === 'zh' && row.label_zh) ||
    row.label_ru ||
    row.label_en ||
    row.code
  return {
    code: row.code,
    level: row.level,
    parentCode: row.parent_code,
    label,
    labelEn: row.label_en,
    labelRu: row.label_ru,
    countryCode: row.country_code || row.iso_country,
    centroidLat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
    centroidLng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
    timezone: row.timezone || null,
    currencyCode: row.currency_code || null,
    isAutoImported: row.is_auto_imported === true,
  }
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'DB unavailable' }, { status: 503 })
    }
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level')
    const parent = searchParams.get('parent')
    const code = searchParams.get('code')
    const lang = searchParams.get('lang') || 'ru'

    let q = supabaseAdmin
      .from('geo_locations')
      .select(
        'code,level,parent_code,label_en,label_ru,label_th,label_zh,country_code,iso_country,centroid_lat,centroid_lng,timezone,currency_code,is_auto_imported,is_active',
      )
      .eq('is_active', true)

    if (code) {
      q = q.eq('code', code)
    } else if (parent) {
      q = q.eq('parent_code', parent)
      if (level) q = q.eq('level', level)
    } else if (level) {
      q = q.eq('level', level)
    } else {
      return NextResponse.json(
        { success: false, error: 'Provide level, parent, or code' },
        { status: 400 },
      )
    }

    q = q.order('label_en', { ascending: true }).limit(200)
    const { data, error } = await q
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: (data || []).map((r) => mapRow(r, lang)),
    })
  } catch (e) {
    console.error('[geo/locations]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
