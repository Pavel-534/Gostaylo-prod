/**
 * POST /api/v2/partner/geo/ensure-country
 * Upsert ISO country into geo_locations (Stage 200.45 wizard typeahead).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { GeoService } from '@/lib/services/geo/geo.service'
import { getIsoCountryLabel } from '@/lib/geo/iso-countries-catalog'

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
    const country_code = String(body.country_code || body.countryCode || body.code || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    if (!/^[A-Z]{2}$/.test(country_code)) {
      return NextResponse.json({ success: false, error: 'country_code required' }, { status: 400 })
    }

    const row = await GeoService.ensureCountryLocation({
      code: country_code,
      labelEn: body.label_en || body.labelEn || getIsoCountryLabel(country_code, 'en'),
      labelRu: body.label_ru || body.labelRu || getIsoCountryLabel(country_code, 'ru'),
      labelTh: body.label_th || body.labelTh || getIsoCountryLabel(country_code, 'th'),
      labelZh: body.label_zh || body.labelZh || getIsoCountryLabel(country_code, 'zh'),
    })

    return NextResponse.json({
      success: true,
      data: {
        code: row.code,
        level: row.level,
        labelEn: row.label_en,
        labelRu: row.label_ru,
        timezone: row.timezone,
        currencyCode: row.currency_code,
        centroidLat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
        centroidLng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
      },
    })
  } catch (e) {
    console.error('[partner/geo/ensure-country]', e)
    return NextResponse.json(
      { success: false, error: e.message || 'Failed', code: e.code },
      { status: e.code === 'GEO_COUNTRY_REQUIRED' ? 400 : 500 },
    )
  }
}
