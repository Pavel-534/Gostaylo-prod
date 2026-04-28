/**
 * Контрольный крон обновления FX (рекомендуемый интервал вызова: каждые 3 часа).
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
  let ratesUpdatedAt = null
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('exchange_rates')
      .select('updated_at')
    for (const row of data || []) {
      if (!row?.updated_at) continue
      if (!ratesUpdatedAt || new Date(row.updated_at).getTime() > new Date(ratesUpdatedAt).getTime()) {
        ratesUpdatedAt = row.updated_at
      }
    }
  }
  return {
    success: true,
    refreshedCodes: Object.keys(rateMap || {}).length,
    ratesUpdatedAt,
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
      status: 'success',
      stats: {
        refreshedCodes: Number(result?.refreshedCodes || 0),
      },
      errorMessage: null,
    })
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
