/**
 * POST /api/admin/settings/legal/draft
 * Body: { doc: "guest"|"partner", changeSummary, textLastUpdated }
 */

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { LegalVersionsService } from '@/lib/services/legal-versions.service.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const doc = String(body?.doc || 'guest').toLowerCase()
  if (!['guest', 'partner'].includes(doc)) {
    return NextResponse.json({ success: false, error: 'doc must be guest or partner' }, { status: 400 })
  }

  const result = await LegalVersionsService.createOrUpdateDraft(
    doc,
    {
      changeSummary: body?.changeSummary,
      textLastUpdated: body?.textLastUpdated,
    },
    gate.profile?.id || null,
  )

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: result,
  })
}
