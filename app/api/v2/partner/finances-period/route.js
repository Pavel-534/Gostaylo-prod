/**
 * GET /api/v2/partner/finances-period?from=&to=&axis=created|checkout
 * Stage 211.2 — period statement pack (read-model bookings + settled payouts + acts).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { parsePartnerFinancesExportParams } from '@/lib/services/partner-finances-export.service'
import { computePartnerFinancesPeriodPack } from '@/lib/services/partner-finances-period.service'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = parsePartnerFinancesExportParams({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      format: 'csv',
      axis: searchParams.get('axis'),
    })
    if (!parsed.ok) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error,
          hint: parsed.hint,
          maxDays: parsed.maxDays,
        },
        { status: parsed.status },
      )
    }

    const result = await computePartnerFinancesPeriodPack({
      partnerId: userId,
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      axis: parsed.axis,
    })
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'period' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId: userId,
        ...result.data,
      },
    })
  } catch (e) {
    console.error('[FINANCES-PERIOD]', e)
    return NextResponse.json({ success: false, error: e.message || 'period' }, { status: 500 })
  }
}
