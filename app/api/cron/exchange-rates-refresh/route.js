/**
 * Контрольный крон обновления FX.
 * На Vercel Free: 1×/сутки (vercel.json); частый прогрев (например, каждые 3 часа) — через внешний cron-job.
 * GET/POST /api/cron/exchange-rates-refresh
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getDisplayRateMap } from '@/lib/services/currency.service'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function runRefresh() {
  const startedAt = Date.now()
  // Stage 76.2 transparency: refresh from canonical raw map (no retail markup).
  const rateMap = await getDisplayRateMap({ applyRetailMarkup: false })
  const REQUIRED_CODES = ['THB', 'USD', 'EUR', 'GBP', 'RUB', 'CNY', 'USDT']
  const criticalIssues = []
  for (const code of REQUIRED_CODES) {
    const rate = Number(rateMap?.[code])
    if (code === 'THB') {
      if (rate !== 1) criticalIssues.push(`THB base rate invalid: ${String(rateMap?.[code])}`)
      continue
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      criticalIssues.push(`Missing/invalid rate_to_thb for ${code}`)
    }
  }
  let ratesUpdatedAt = null
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('currency_code, rate_to_thb, updated_at')
    if (error) {
      criticalIssues.push(`exchange_rates read failed: ${error.message}`)
    }
    for (const row of data || []) {
      if (!row?.updated_at) continue
      if (!ratesUpdatedAt || new Date(row.updated_at).getTime() > new Date(ratesUpdatedAt).getTime()) {
        ratesUpdatedAt = row.updated_at
      }
      const num = Number(row?.rate_to_thb)
      if (!Number.isFinite(num) || num <= 0) {
        criticalIssues.push(`Non-positive rate_to_thb in DB for ${String(row?.currency_code || '?')}`)
      }
    }
  }
  if (!ratesUpdatedAt) criticalIssues.push('No updated_at found in exchange_rates')
  return {
    success: criticalIssues.length === 0,
    refreshedCodes: Object.keys(rateMap || {}).length,
    ratesUpdatedAt,
    criticalIssues,
    elapsedMs: Date.now() - startedAt,
  }
}

async function handle(request, method) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('exchange-rates-refresh')
  try {
    const result = await runRefresh()
    await finishOpsJobRun(run, {
      status: result?.success ? 'success' : 'error',
      stats: {
        refreshedCodes: Number(result?.refreshedCodes || 0),
      },
      errorMessage: result?.success ? null : (result?.criticalIssues || []).join(' | ') || 'FX health failed',
    })
    if (!result?.success) {
      void notifySystemAlert(
        `⏰ <b>Cron: exchange-rates-refresh</b> (${escapeSystemAlertHtml(method)}) — критические ошибки\n<code>${escapeSystemAlertHtml((result?.criticalIssues || []).join(' | ') || 'unknown')}</code>`,
      )
      return NextResponse.json({ ...result, method }, { status: 500 })
    }
    return NextResponse.json({ ...result, method })
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
