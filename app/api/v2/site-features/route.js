/**
 * GET /api/v2/site-features — публично: флаги витрины (кэш на CDN/браузер).
 * Stage 202.47 — edgeCacheResponseHeaders + longer s-maxage (flags change rarely).
 */

import { NextResponse } from 'next/server'
import { getSemanticSearchSiteEnabled } from '@/lib/ai/site-search-settings'
import {
  buildAnonymousPublicEdgeCacheControl,
  edgeCacheResponseHeaders,
} from '@/lib/api/public-edge-cache-control.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const semanticSearchOnSite = await getSemanticSearchSiteEnabled()
  const cacheControl = buildAnonymousPublicEdgeCacheControl({
    sMaxAge: 120,
    staleWhileRevalidate: 300,
  })
  return NextResponse.json(
    { success: true, data: { semanticSearchOnSite } },
    {
      headers: edgeCacheResponseHeaders(cacheControl),
    },
  )
}
