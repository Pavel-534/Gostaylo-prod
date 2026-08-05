/**
 * GET /api/v2/geo/resolve-where?q=Пхукет&lang=ru
 * Stage 200.37 — public where resolve for TrustBar / map viewport (DB-first).
 */

import { NextResponse } from 'next/server'
import {
  resolveWhereTarget,
  centroidFromWhereTarget,
} from '@/lib/locations/resolve-where-target'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || searchParams.get('where') || ''
    const lang = searchParams.get('lang') || 'ru'
    if (!q.trim() || q === 'all') {
      return NextResponse.json({
        success: true,
        data: null,
      })
    }

    const target = await resolveWhereTarget(q, { lang })
    if (!target) {
      return NextResponse.json({ success: true, data: null })
    }

    const center = centroidFromWhereTarget(target)
    return NextResponse.json({
      success: true,
      data: {
        ...target,
        center,
        zoom: target.mapZoom ?? 10,
      },
    })
  } catch (e) {
    console.error('[geo/resolve-where]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
