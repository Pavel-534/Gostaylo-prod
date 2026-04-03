/**
 * GET /api/v2/admin/ai-usage — суммарные затраты OpenAI за текущий месяц (UTC) по всем пользователям.
 * Только role ADMIN (не модератор).
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sumGlobalAiCostUsdForMonth } from '@/lib/ai/usage-log'
import { getJwtSecret } from '@/lib/auth/jwt-secret'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  const auth = verifyAdminOnly()
  if (auth.error) return auth.error

  const now = new Date()
  const { totalUsd, requestCount, error } = await sumGlobalAiCostUsdForMonth(now)

  if (error) {
    return NextResponse.json({
      success: true,
      data: {
        totalUsd: 0,
        requestCount: 0,
        month: now.toISOString().slice(0, 7),
        approximate: true,
        note: 'aggregation_unavailable',
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      totalUsd,
      requestCount,
      month: now.toISOString().slice(0, 7),
      approximate: true,
    },
  })
}
