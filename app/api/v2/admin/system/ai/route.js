/**
 * GET /api/v2/admin/system/ai?period=today|7d|month|all
 * Агрегаты и последние операции по ai_usage_logs. Только role ADMIN.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '@/lib/supabase'
import { getAiUsageDashboardData, TASK_EMBEDDING, TASK_LISTING_DESCRIPTION } from '@/lib/ai/usage-log'
import { LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING } from '@/lib/ai/listing-embedding-policy'
import {
  getSemanticSearchSiteEnabled,
  setSemanticSearchSiteEnabled,
} from '@/lib/ai/site-search-settings'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

export const dynamic = 'force-dynamic'

const PERIODS = new Set(['today', '7d', 'month', 'all'])

function verifyAdminOnly() {
  let secret
  try {
    secret = getJwtSecret()
  } catch (e) {
    return { error: NextResponse.json({ success: false, error: e.message }, { status: 500 }) }
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const decoded = jwt.verify(sessionCookie.value, secret)
    if (decoded.role !== 'ADMIN') {
      return {
        error: NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 }),
      }
    }
    return { ok: true }
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }) }
  }
}

async function getListingAiStats() {
  if (!supabaseAdmin) {
    return {
      activeListings: 0,
      withEmbeddingEligible: 0,
      aiLogsLinkedToListing: 0,
    }
  }
  const eligible = [...LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING]

  const [activeRes, indexedRes, logsRes] = await Promise.all([
    supabaseAdmin.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabaseAdmin
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .in('status', eligible)
      .not('embedding', 'is', null),
    supabaseAdmin
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .not('listing_id', 'is', null)
      .in('task_type', [TASK_LISTING_DESCRIPTION, TASK_EMBEDDING]),
  ])

  return {
    activeListings: activeRes.count ?? 0,
    withEmbeddingEligible: indexedRes.count ?? 0,
    aiLogsLinkedToListing: logsRes.count ?? 0,
  }
}

export async function GET(request) {
  const auth = verifyAdminOnly()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('period') || 'month'
  const period = PERIODS.has(raw) ? raw : 'month'

  const [data, stats, semanticSearchOnSite] = await Promise.all([
    getAiUsageDashboardData(period),
    getListingAiStats(),
    getSemanticSearchSiteEnabled(),
  ])

  return NextResponse.json({
    success: true,
    data: {
      period: data.period,
      totalUsd: data.totalUsd,
      telegramUsd: data.telegramUsd,
      webUsd: data.webUsd,
      embeddingUsd: data.embeddingUsd,
      searchQueryUsd: data.searchQueryUsd,
      searchQueryCount: data.searchQueryCount,
      requestCount: data.requestCount,
      recent: data.recent,
      stats,
      semanticSearchOnSite,
      approximate: true,
      ...(data.error ? { note: 'partial_aggregation', aggregationNote: data.error } : {}),
    },
  })
}

export async function PATCH(request) {
  const auth = verifyAdminOnly()
  if (auth.error) return auth.error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body?.semanticSearchOnSite !== 'boolean') {
    return NextResponse.json(
      { success: false, error: 'semanticSearchOnSite (boolean) is required' },
      { status: 400 }
    )
  }

  try {
    await setSemanticSearchSiteEnabled(body.semanticSearchOnSite)
  } catch (e) {
    console.error('[admin/system/ai] PATCH features', e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Failed to save settings' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    data: { semanticSearchOnSite: body.semanticSearchOnSite },
  })
}
