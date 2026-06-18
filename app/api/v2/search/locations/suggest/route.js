/**
 * GET /api/v2/search/locations/suggest
 * Stage 158 — server-side location autocomplete ranked by ACTIVE listing inventory.
 *
 * Query: q (optional), lang (ru|en|zh|th, default en), limit (1–20, default 10)
 */

import { NextResponse } from 'next/server'
import {
  clampSuggestLimit,
  normalizeSuggestLang,
  suggestLocations,
} from '@/lib/locations/location-suggest.service'
import { recordLocationSuggestMetrics } from '@/lib/locations/location-suggest-metrics'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') ?? ''
    const langParam = searchParams.get('lang')
    const limitParam = searchParams.get('limit')

    if (langParam && !['ru', 'en', 'zh', 'th'].includes(String(langParam).toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'lang must be one of ru, en, zh, th' },
        { status: 400 },
      )
    }

    const lang = normalizeSuggestLang(langParam)
    const limit = clampSuggestLimit(limitParam)

    const t0 = performance.now()
    const data = await suggestLocations({ q: q.trim(), lang, limit })
    recordLocationSuggestMetrics(performance.now() - t0, data.items)
    const cacheControl =
      q.trim().length === 0
        ? 'public, s-maxage=60, stale-while-revalidate=120'
        : 'public, s-maxage=30, stale-while-revalidate=60'

    return NextResponse.json(
      { success: true, data },
      { headers: { 'Cache-Control': cacheControl } },
    )
  } catch (err) {
    console.error('[LOCATIONS SUGGEST]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
