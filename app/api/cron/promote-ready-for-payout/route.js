/**
 * POST /api/cron/promote-ready-for-payout
 * THAWED → READY_FOR_PAYOUT after 24h hold (Stage 98).
 * Run hourly (or after escrow-thaw).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('promote-ready-for-payout')
  try {
    const result = await PayoutBatchService.promoteThawedToReadyForPayout()
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
    message: 'Promotes THAWED bookings to READY_FOR_PAYOUT after 24h escrow_thawed_at',
  })
}
