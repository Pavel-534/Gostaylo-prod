/**
 * GET /api/v2/search/semantic?q=...&limit=20
 * Семантический поиск: эмбеддинг запроса + match_listings.
 * Лог: ai_usage_logs task_type search_query. Rate limit: 5/мин на IP.
 */

import { NextResponse } from 'next/server'
import { rateLimitCheck } from '@/lib/rate-limit'
import { fetchSemanticListingMatches, SEMANTIC_MIN_SIMILARITY } from '@/lib/search/semantic-listings'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const rl = rateLimitCheck(request, 'semantic_search')
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const trimmed = q.trim()

  if (trimmed.length < 2) {
    return NextResponse.json(
      { success: false, error: 'Query q is required (min 2 characters)' },
      { status: 400 },
    )
  }

  let limit = parseInt(searchParams.get('limit') || '20', 10)
  if (!Number.isFinite(limit) || limit < 1) limit = 20
  limit = Math.min(50, limit)

  const filterStatus = searchParams.get('status')?.trim() || 'ACTIVE'

  const hits = await fetchSemanticListingMatches(trimmed, {
    matchCount: Math.max(limit, 40),
    filterStatus,
    logToAiUsage: true,
  })

  const results = hits.slice(0, limit).map(({ id, similarity }) => ({
    id,
    similarity: Math.round(similarity * 1_000_000) / 1_000_000,
  }))

  console.log('[api/v2/search/semantic] diagnostic', {
    query: trimmed,
    isVillaProbe: trimmed.toLowerCase() === 'вилла',
    hitsFromFetcher: hits.length,
    returned: results.length,
    sample: results.slice(0, 15),
    minSimilarity: SEMANTIC_MIN_SIMILARITY,
  })

  return NextResponse.json({
    success: true,
    data: {
      query: trimmed,
      minSimilarity: SEMANTIC_MIN_SIMILARITY,
      results,
    },
  })
}
