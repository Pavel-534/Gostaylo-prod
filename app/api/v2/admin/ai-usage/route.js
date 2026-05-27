/**
 * GET /api/v2/admin/ai-usage — суммарные затраты OpenAI за текущий месяц (UTC) по всем пользователям.
 * Только role ADMIN (не модератор).
 */

import { NextResponse } from 'next/server'
import { sumGlobalAiCostUsdForMonth } from '@/lib/ai/usage-log'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

async function verifyAdminOnly() {
  const access = await requireAdminStaff(request)
  if (access.error) return { error: access.error }
  return { ok: true }
}

export async function GET(request) {
  const auth = await verifyAdminOnly()
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
