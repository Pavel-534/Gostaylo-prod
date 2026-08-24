/**
 * POST /api/cron/reconcile-yookassa-pending
 * Stage 202.7 — poll INITIATED MIR_RU intents via GET /v3/payments/{id} when webhooks lag.
 *
 * Vercel Hobby: daily fallback in vercel.json only.
 * Production: cron-job.org every ~10 minutes — see docs/runbooks/CRON_EXTERNAL_FINANCIAL.md
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { reconcileInitiatedYookassaIntents } from '@/lib/payment/reconcile-initiated-yookassa-intents.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { runStaleCronMonitor } from '@/lib/ops/stale-cron-monitor.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('reconcile-yookassa-pending')
  try {
    const result = await reconcileInitiatedYookassaIntents({ limit: 30 })
    const errCount = Number(result.failed) || 0
    const failed = result.success === false || errCount > 0
    await finishOpsJobRun(run, {
      status: failed ? 'error' : 'success',
      stats: {
        summary: result.summary,
        processed: result.processed,
        settled: result.settled,
        canceled: result.canceled,
        pending: result.pending,
        failed: errCount,
        skipped: result.skipped,
      },
      errorMessage: failed
        ? errCount > 0
          ? `${errCount} yookassa pending poll failures`
          : String(result.error || 'reconcile_yookassa_pending_failed')
        : null,
    })

    if (errCount > 0 || failed) {
      void notifySystemAlert(
        `🔧 <b>Cron: reconcile-yookassa-pending</b> — ${escapeSystemAlertHtml(result.summary || '')}\n` +
          `<code>${escapeSystemAlertHtml(JSON.stringify(result.errors || []).slice(0, 400))}</code>`,
      )
    }

    void runStaleCronMonitor().catch(() => {})
    return NextResponse.json({ success: !failed, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    void notifySystemAlert(
      `🔧 <b>Cron: reconcile-yookassa-pending</b> exception\n<code>${escapeSystemAlertHtml(e?.message || '')}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message || 'failed' }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
