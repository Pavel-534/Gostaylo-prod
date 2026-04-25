/**
 * GET /api/v2/partner/finances-summary
 * Aggregated partner money buckets + ledger reconciliation (Stage 45.3).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { computePartnerFinancesSummary } from '@/lib/services/partner-finances-summary.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 })
    }

    const result = await computePartnerFinancesSummary(userId)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'summary' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: userId,
        ...result.data,
      },
    })
  } catch (e) {
    console.error('[PARTNER FINANCES-SUMMARY]', e)
    return NextResponse.json({ success: false, error: e.message || 'summary' }, { status: 500 })
  }
}
