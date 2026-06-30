/**
 * Platform cron — POST /api/cron/promote-ready-for-payout
 * THAWED → READY_FOR_PAYOUT after 24h hold (Stage 98).
 * Run hourly via cron-job.org (see docs/CRON_EXTERNAL_FINANCIAL.md).
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'

function resolvePromoteOps(result) {
  if (result?.error) {
    return { status: 'error', errorMessage: String(result.error) }
  }
  return { status: 'success', errorMessage: null }
}

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('promote-ready-for-payout')
  try {
    const result = await PayoutBatchService.promoteThawedToReadyForPayout()
    const ops = resolvePromoteOps(result)
    await finishOpsJobRun(run, {
      status: ops.status,
      stats: {
        promoted: Number(result?.promoted || 0),
        skipped_hold: Number(result?.skipped_hold || 0),
      },
      errorMessage: ops.errorMessage,
    })
    if (ops.status === 'error') {
      return NextResponse.json({ success: false, ...result }, { status: 503 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const err = e?.message || 'promote-ready-for-payout failed'
    console.error('[CRON promote-ready-for-payout]', e)
    await finishOpsJobRun(run, { status: 'error', stats: {}, errorMessage: err })
    void notifySystemAlert(
      `💰 <b>Cron: promote-ready-for-payout</b>\n<code>${escapeSystemAlertHtml(err)}</code>`,
    )
    return NextResponse.json({ success: false, error: err }, { status: 500 })
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
