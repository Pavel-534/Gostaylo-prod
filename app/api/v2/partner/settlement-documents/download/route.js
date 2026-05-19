/**
 * GET /api/v2/partner/settlement-documents/download?source=payout|batch&refId=
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { getPartnerSettlementDocumentDownload } from '@/lib/services/partner-settlement-documents.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const partnerId = await getUserIdFromSession()
  if (!partnerId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const source = String(searchParams.get('source') || '').toLowerCase()
  const refId = searchParams.get('refId')?.trim()

  if (!['payout', 'batch'].includes(source) || !refId) {
    return NextResponse.json(
      { success: false, error: 'source and refId required' },
      { status: 400 },
    )
  }

  const result = await getPartnerSettlementDocumentDownload(partnerId, source, refId)
  if (!result.success) {
    const status = result.error === 'forbidden' ? 403 : result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ success: false, error: result.error }, { status })
  }

  return NextResponse.json({
    success: true,
    data: {
      signedUrl: result.signedUrl,
      expiresInSec: result.expiresInSec,
      document: result.document,
    },
  })
}
