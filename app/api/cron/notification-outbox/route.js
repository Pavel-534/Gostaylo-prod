/**
 * Platform cron — GET/POST /api/cron/notification-outbox — Vercel cron entry for outbox worker (Stage 59.0).
 */
import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runNotificationOutboxWorker } from '@/lib/services/notifications/process-notification-outbox.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('notification-outbox')
  try {
    const result = await runNotificationOutboxWorker({ limit: 20 })
    const critical = Boolean(result?.error)
    await finishOpsJobRun(run, {
      status: critical ? 'error' : 'success',
      stats: {
        scanned: Number(result?.scanned || 0),
        claimed: Number(result?.claimed || 0),
        sent: Number(result?.sent || 0),
        failed: Number(result?.failed || 0),
        permanent_failure: Number(result?.permanentFailure || 0),
        skipped: Number(result?.skipped || 0),
        reclaimed: Number(result?.reclaimed || 0),
      },
      errorMessage: critical ? String(result.error) : null,
    })
    if (critical) {
      return NextResponse.json({ success: false, ...result }, { status: 503 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const err = e?.message || 'Internal error'
    console.error('[CRON notification-outbox]', e)
    await finishOpsJobRun(run, {
      status: 'error',
      stats: {},
      errorMessage: err,
    })
    void notifySystemAlert(
      `⏰ <b>Cron: notification-outbox</b> — исключение\n<code>${escapeSystemAlertHtml(err)}</code>`,
    )
    return NextResponse.json({ success: false, error: err }, { status: 500 })
  }
}

export async function GET(request) {
  return handle(request)
}

export async function POST(request) {
  return handle(request)
}
