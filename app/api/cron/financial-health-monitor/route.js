/**
 * POST /api/cron/financial-health-monitor
 * PENDING_FISCAL backlog + ledger drift alerts (Stage 99).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runFinancialHealthScan } from '@/lib/ops/financial-health-monitor.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('financial-health-monitor')
  try {
    const result = await runFinancialHealthScan()
    await finishOpsJobRun(run, { status: 'success', stats: result })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    message: 'Scans PENDING_FISCAL backlog and partner ledger drift',
  })
}
