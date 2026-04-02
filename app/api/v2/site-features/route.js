/**
 * GET /api/v2/site-features — публично: флаги витрины (кэш на CDN/браузер короткий).
 */

import { NextResponse } from 'next/server'
import { getSemanticSearchSiteEnabled } from '@/lib/ai/site-search-settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const semanticSearchOnSite = await getSemanticSearchSiteEnabled()
  return NextResponse.json(
    { success: true, data: { semanticSearchOnSite } },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  )
}
