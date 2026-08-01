/**
 * POST /api/cron/payout-batch-pools — Mon/Thu payout pool draft (Stage 97.0.5)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { resolvePayoutBatchPoolsOps } from '@/lib/ops/ops-job-outcome.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
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
    const ops = resolvePayoutBatchPoolsOps(result)
    await finishOpsJobRun(run, {
      status: ops.status,
      stats: ops.stats,
      errorMessage: ops.errorMessage,
    })
    if (ops.status === 'error') {
      void notifySystemAlert(
        `💰 <b>Cron: payout-batch-pools FAILED</b>\n<code>${escapeSystemAlertHtml(ops.errorMessage)}</code>`,
      )
      return NextResponse.json({ success: false, ...result }, { status: 503 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    void notifySystemAlert(
      `💰 <b>Cron: payout-batch-pools</b>\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
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
