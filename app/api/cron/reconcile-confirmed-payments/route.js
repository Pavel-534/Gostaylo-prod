/**
 * POST /api/cron/reconcile-confirmed-payments
 * AUDIT_03 C3.4 — CONFIRMED payments whose bookings never reached PAID_ESCROW.
 *
 * Vercel Hobby: daily fallback in vercel.json only.
 * Production cadence: cron-job.org hourly — see docs/runbooks/CRON_EXTERNAL_FINANCIAL.md
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { reconcileConfirmedPaymentsWithoutEscrow } from '@/lib/payment/reconcile-confirmed-without-escrow.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('reconcile-confirmed-payments')
  try {
    const result = await reconcileConfirmedPaymentsWithoutEscrow({ limit: 50 })
    await finishOpsJobRun(run, {
      status: result.failed > 0 ? 'error' : 'success',
      stats: {
        processed: result.processed,
        healed: result.healed,
        failed: result.failed,
        skipped: result.skipped,
      },
      errorMessage: result.failed > 0 ? `${result.failed} escrow heal failures` : null,
    })
    if (result.failed > 0) {
      void notifySystemAlert(
        `🔧 <b>Cron: reconcile-confirmed-payments</b> — healed ${result.healed}, failed ${result.failed}\n` +
          `<code>${escapeSystemAlertHtml(JSON.stringify(result.errors || []).slice(0, 400))}</code>`,
      )
    }
    return NextResponse.json({ success: result.success !== false, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    void notifySystemAlert(
      `🔧 <b>Cron: reconcile-confirmed-payments</b>\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    message:
      'Heals payments.status=CONFIRMED when booking is not yet in escrow pipeline (moveToEscrow retry)',
  })
}
