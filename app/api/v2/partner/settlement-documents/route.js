/**
 * GET /api/v2/partner/settlement-documents — PDF-акты партнёра (Stage 102.4).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { listPartnerSettlementDocuments } from '@/lib/services/partner-settlement-documents.service.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const partnerId = await getUserIdFromSession()
  if (!partnerId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await listPartnerSettlementDocuments(partnerId)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: { documents: result.rows },
  })
}
