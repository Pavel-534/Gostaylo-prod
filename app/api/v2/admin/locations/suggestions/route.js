/**
 * GET /api/v2/admin/locations/suggestions
 * Stage 160 — PENDING location suggestion queue (ADMIN + MODERATOR).
 *
 * Query: status (default PENDING), limit, offset
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { listLocationSuggestionsQueue } from '@/lib/services/location-suggestion-queue.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    const data = await listLocationSuggestionsQueue({ status, limit, offset })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[ADMIN LOCATION SUGGESTIONS]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
