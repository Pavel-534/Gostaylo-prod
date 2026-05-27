/**
 * GET /api/v2/admin/exchange-rates-health
 * Снимок устаревания дисплей-курсов по БД (без вызова внешнего FX API). Только ADMIN.
 */

import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getDisplayFxStaleHealthFromDb } from '@/lib/services/currency.service'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) {
    return access.error
  }

  try {
    const health = await getDisplayFxStaleHealthFromDb()
    return NextResponse.json({
      success: true,
      data: {
        stale: health.stale,
        staleCodes: health.staleCodes,
        lastUpdateLabel: health.lastUpdateLabel,
        oldestStaleIso: health.oldestStaleIso,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || String(e) },
      { status: 500 },
    )
  }
}
