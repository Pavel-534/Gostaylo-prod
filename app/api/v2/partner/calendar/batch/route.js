/**
 * POST /api/v2/partner/calendar/batch — batch calendar mutations (Stage 188.0).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { applyPartnerCalendarBatch } from '@/lib/services/calendar/partner-calendar-batch.service.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ status: 'error', error: 'Authentication required' }, { status: 401 })
    }

    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ status: 'error', error: 'Partner access denied' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const operations = Array.isArray(body.operations) ? body.operations : []

    if (operations.length === 0) {
      return NextResponse.json(
        { status: 'error', error: 'operations array is required' },
        { status: 400 },
      )
    }

    if (operations.length > 50) {
      return NextResponse.json(
        { status: 'error', error: 'Too many operations (max 50)' },
        { status: 400 },
      )
    }

    const batch = await applyPartnerCalendarBatch({ partnerId: userId, operations })

    const httpStatus = batch.failed === batch.total ? 422 : 200

    return NextResponse.json(
      {
        status: batch.partial ? 'partial' : batch.ok ? 'success' : 'error',
        data: batch,
        meta: { partnerId: userId, operationCount: batch.total },
      },
      { status: httpStatus },
    )
  } catch (error) {
    console.error('[CALENDAR BATCH ERROR]', error)
    return NextResponse.json(
      { status: 'error', error: error.message || 'Batch failed' },
      { status: 500 },
    )
  }
}
