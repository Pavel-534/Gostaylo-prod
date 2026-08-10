/**
 * GET /api/v2/admin/concierge/batches/[id]
 * ADR-210 Slice 7 — listings for one Concierge import batch (ADMIN).
 */

import { NextResponse } from 'next/server'
import { requireConciergeAdmin } from '@/lib/services/concierge/require-concierge-admin.js'
import { listConciergeBatchListings } from '@/lib/services/concierge/concierge-admin.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request, context) {
  const { error } = await requireConciergeAdmin(request)
  if (error) return error

  const params = await context?.params
  const batchId = params?.id

  const result = await listConciergeBatchListings({ batchId })
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({
    success: true,
    batch: result.batch,
    listings: result.listings,
  })
}
