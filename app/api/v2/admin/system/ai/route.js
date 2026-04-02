/**
 * GET /api/v2/admin/system/ai?period=today|7d|month|all
 * Агрегаты и последние операции по ai_usage_logs. Только role ADMIN.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { getAiUsageDashboardData } from '@/lib/ai/usage-log'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production'

const PERIODS = new Set(['today', '7d', 'month', 'all'])

function verifyAdminOnly() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('gostaylo_session')
  if (!sessionCookie?.value) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }
  try {
    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET)
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

export async function GET(request) {
  const auth = verifyAdminOnly()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('period') || 'month'
  const period = PERIODS.has(raw) ? raw : 'month'

  const data = await getAiUsageDashboardData(period)

  return NextResponse.json({
    success: true,
    data: {
      period: data.period,
      totalUsd: data.totalUsd,
      telegramUsd: data.telegramUsd,
      webUsd: data.webUsd,
      embeddingUsd: data.embeddingUsd,
      requestCount: data.requestCount,
      recent: data.recent,
      approximate: true,
      ...(data.error ? { note: 'partial_aggregation', aggregationNote: data.error } : {}),
    },
  })
}
