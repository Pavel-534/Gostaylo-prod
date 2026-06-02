/**
 * POST /api/cron/referral-reconciliation
 * Stage 119.2 — daily referral ledger vs booking status reconciliation.
 * Schedule: vercel.json — 04:30 UTC daily.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { executeReferralReconciliationRun } from '@/lib/cron/referral-reconciliation-run.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('referral-reconciliation')
  try {
    const exec = await executeReferralReconciliationRun({ trigger: 'cron' })
    if (!exec.success) {
      await finishOpsJobRun(run, { status: 'error', errorMessage: exec.error })
      return NextResponse.json(
        { success: false, error: exec.error, ...(exec.result || {}) },
        { status: 500 },
      )
    }
    await finishOpsJobRun(run, { status: 'success', stats: exec.result || {} })
    return NextResponse.json({ success: true, ...exec.result })
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
    message: 'Referral ledger reconciliation (earned/pending vs CANCELLED/REFUNDED bookings)',
    schedule: '30 4 * * * (vercel.json — UTC daily)',
  })
}
