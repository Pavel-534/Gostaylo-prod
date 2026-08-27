/**
 * GET | POST /api/cron/financial-health-monitor
 * PENDING_FISCAL backlog + ledger drift alerts (Stage 99).
 *
 * Stage 202.10 — GET runs the same scan as POST (Vercel Cron is GET-only).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runFinancialHealthScan } from '@/lib/ops/financial-health-monitor.js'

async function runFinancialHealthCron(request) {
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

export async function POST(request) {
  return runFinancialHealthCron(request)
}

export async function GET(request) {
  return runFinancialHealthCron(request)
}
