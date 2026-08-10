/**
 * GET /api/v2/admin/concierge/batches
 * ADR-210 Slice 7 — Concierge import batch journal (ADMIN).
 */

import { NextResponse } from 'next/server'
import { requireConciergeAdmin } from '@/lib/services/concierge/require-concierge-admin.js'
import { listConciergeImportBatches } from '@/lib/services/concierge/concierge-admin.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { error } = await requireConciergeAdmin(request)
  if (error) return error

  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page') || 1)
  const limit = Number(url.searchParams.get('limit') || 20)

  const result = await listConciergeImportBatches({ page, limit })
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({
    success: true,
    page: result.page,
    limit: result.limit,
    total: result.total,
    items: result.items,
  })
}
