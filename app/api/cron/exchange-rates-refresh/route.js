/**
 * Контрольный крон обновления FX.
 * На Vercel Free: 1×/сутки (vercel.json); частый прогрев (например, каждые 3–6 часов) — через внешний cron-job.
 * GET/POST /api/cron/exchange-rates-refresh
 *
 * Auth: `assertCronAuthorized` (Bearer CRON_SECRET / x-cron-secret). Missing env → 503, bad/missing token → 401.
 * Skip: display rows in `exchange_rates` younger than 4h → 200 `{ success: true, message: "Skipped, updated recently" }`.
 * Upstream 429/5xx: do not upsert empty rates; **HTTP 200** + `keptExisting: true` (Stage 201.113 —
 *   cron-job.org must not auto-disable on upstream rate limits). Telegram still alerted once per failure wave.
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import {
  httpStatusForExchangeRatesCronResult,
  runExchangeRatesCronRefresh,
} from '@/lib/cron/exchange-rates-refresh.service.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function shouldAlertUpstreamKeep(result) {
  if (!result?.keptExisting || !result?.error) return false
  // Cooldown soft-skip is expected after a 429 wave — do not spam Telegram.
  if (result.error === 'HTTP_429_COOLDOWN') return false
  return true
}

async function handle(request, method) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('exchange-rates-refresh')
  try {
    const result = await runExchangeRatesCronRefresh()
    const httpStatus = httpStatusForExchangeRatesCronResult(result)
    const opsError = shouldAlertUpstreamKeep(result)
      ? result.error || result.message || 'FX refresh failed'
      : result?.success
        ? null
        : result?.error || result?.message || 'FX refresh failed'
    await finishOpsJobRun(run, {
      status: result?.success && !opsError ? 'success' : opsError ? 'error' : 'success',
      stats: {
        skipped: Boolean(result?.skipped),
        refreshed: Boolean(result?.refreshed),
        upsertedCodes: Number(result?.upsertedCodes || 0),
        keptExisting: Boolean(result?.keptExisting),
        upstreamStatus: result?.upstreamStatus ?? null,
      },
      errorMessage: opsError,
    })
    if (opsError) {
      void notifySystemAlert(
        `⏰ <b>Cron: exchange-rates-refresh</b> (${escapeSystemAlertHtml(method)}) — ${escapeSystemAlertHtml(result?.message || result?.error || 'FX refresh failed')}\n<code>${escapeSystemAlertHtml(result?.error || 'unknown')}</code>`,
      )
    }
    return NextResponse.json({ ...result, method, httpStatus }, { status: httpStatus })
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
