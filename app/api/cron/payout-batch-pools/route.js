/**
 * POST /api/cron/payout-batch-pools — Mon/Thu payout pool draft (Stage 97.0.5)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('payout-batch-pools')
  try {
    const result = await PayoutBatchService.createDraftPoolForToday({
      rail: 'TBANK_RU',
      fromCron: true,
    })
    await finishOpsJobRun(run, { status: 'success', stats: result })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    message: 'Creates DRAFT payout batch from READY_FOR_PAYOUT bookings (Mon/Thu)',
  })
}
