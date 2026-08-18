/**
 * Контрольный крон обновления FX.
 * На Vercel Free: 1×/сутки (vercel.json); частый прогрев (например, каждые 3–6 часов) — через внешний cron-job.
 * GET/POST /api/cron/exchange-rates-refresh
 *
 * Auth: `assertCronAuthorized` (Bearer CRON_SECRET / x-cron-secret). Missing env → 503, bad/missing token → 401.
 * Skip: display rows in `exchange_rates` younger than 4h → 200 `{ success: true, message: "Skipped, updated recently" }`.
 * Upstream 429/5xx: do not upsert empty rates; 429 or 502 + `keptExisting: true`.
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { runExchangeRatesCronRefresh } from '@/lib/cron/exchange-rates-refresh.service.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request, method) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('exchange-rates-refresh')
  try {
    const result = await runExchangeRatesCronRefresh()
    const httpStatus = Number(result?.httpStatus) || (result?.success ? 200 : 500)
    await finishOpsJobRun(run, {
      status: result?.success ? 'success' : 'error',
      stats: {
        skipped: Boolean(result?.skipped),
        refreshed: Boolean(result?.refreshed),
        upsertedCodes: Number(result?.upsertedCodes || 0),
        keptExisting: Boolean(result?.keptExisting),
      },
      errorMessage: result?.success ? null : result?.error || result?.message || 'FX refresh failed',
    })
    if (!result?.success) {
      void notifySystemAlert(
        `⏰ <b>Cron: exchange-rates-refresh</b> (${escapeSystemAlertHtml(method)}) — ${escapeSystemAlertHtml(result?.message || result?.error || 'FX refresh failed')}\n<code>${escapeSystemAlertHtml(result?.error || 'unknown')}</code>`,
      )
    }
    return NextResponse.json({ ...result, method }, { status: httpStatus })
  } catch (e) {
    await finishOpsJobRun(run, {
      status: 'error',
      stats: {},
      errorMessage: e?.message || 'error',
    })
    void notifySystemAlert(
      `⏰ <b>Cron: exchange-rates-refresh</b> (${escapeSystemAlertHtml(method)})\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function GET(request) {
  return handle(request, 'GET')
}

export async function POST(request) {
  return handle(request, 'POST')
}
