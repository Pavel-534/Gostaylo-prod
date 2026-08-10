/**
 * GET /api/v2/admin/concierge/partner-search
 * ADR-210 Slice 7 — async search of existing (non-shadow) PARTNER profiles.
 */

import { NextResponse } from 'next/server'
import { requireConciergeAdmin } from '@/lib/services/concierge/require-concierge-admin.js'
import { searchConciergePartnerProfiles } from '@/lib/services/concierge/concierge-admin.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const { error } = await requireConciergeAdmin(request)
  if (error) return error

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const limit = Number(url.searchParams.get('limit') || 15)

  const result = await searchConciergePartnerProfiles({ q, limit })
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: result.status || 500 },
    )
  }

  return NextResponse.json({ success: true, items: result.items })
}
