/**
 * Platform cron — daily Telegram reminder: partners with linked Telegram and draft listings.
 * POST /api/cron/draft-digest — cron trigger (x-cron-secret / Authorization)
 * GET  /api/cron/draft-digest?secret=... — только для ручного теста (секрет в URL попадает в логи прокси)
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/services/notification.service'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

async function runDigest() {
  return NotificationService.runDailyDraftDigestReminders()
}

async function handle(request, method) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('draft-digest')
  try {
    const result = await runDigest()
    const critical = Boolean(result?.error)
    await finishOpsJobRun(run, {
      status: critical ? 'error' : 'success',
      stats: {
        sent: Number(result?.sent || 0),
        partners_with_drafts: Number(result?.partnersWithDrafts || 0),
      },
      errorMessage: critical ? String(result.error) : null,
    })
    if (critical) {
      return NextResponse.json({ success: false, ...result }, { status: 503 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const err = e?.message || 'error'
    console.error(`[CRON DRAFT DIGEST ${method}]`, e)
    await finishOpsJobRun(run, {
      status: 'error',
      stats: {},
      errorMessage: err,
    })
    void notifySystemAlert(
      `⏰ <b>Cron: draft-digest</b> (${method})\n<code>${escapeSystemAlertHtml(err)}</code>`,
    )
    return NextResponse.json({ success: false, error: err }, { status: 500 })
  }
}

export async function GET(request) {
  return handle(request, 'GET')
}

export async function POST(request) {
  return handle(request, 'POST')
}
