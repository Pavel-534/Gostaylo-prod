/**
 * GET/POST /api/cron/unpaid-checkout-nudge — Wave H1 soft FCM for AWAITING_PAYMENT.
 * Production: cron-job.org every ~5 min (see docs/CRON_SCHEDULING.md).
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { processUnpaidCheckoutNudges } from '@/lib/booking/unpaid-checkout-retention.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('unpaid-checkout-nudge')
  try {
    const meta = await processUnpaidCheckoutNudges()
    const critical = Boolean(meta?.error) && meta?.success === false
    await finishOpsJobRun(run, {
      status: critical ? 'error' : 'success',
      stats: {
        scanned: Number(meta?.scanned || 0),
        sent: Number(meta?.sent || 0),
        skipped: Number(meta?.skipped || 0),
        errors: Number(meta?.errors || 0),
      },
      errorMessage: critical ? String(meta.error) : null,
    })
    if (critical) {
      return NextResponse.json({ success: false, meta }, { status: 503 })
    }
    return NextResponse.json({ success: true, meta })
  } catch (e) {
    console.error('[CRON unpaid-checkout-nudge]', e)
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    void notifySystemAlert(
      `⏰ <b>Cron: unpaid-checkout-nudge</b>\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST(request) {
  return handle(request)
}

export async function GET(request) {
  return handle(request)
}
