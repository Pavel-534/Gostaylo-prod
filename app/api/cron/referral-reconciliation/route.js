/**
 * POST /api/cron/referral-reconciliation
 * Stage 119.2 — daily referral ledger vs booking status reconciliation.
 * Schedule: vercel.json — 04:30 UTC daily.
 */
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { executeReferralReconciliationRun } from '@/lib/cron/referral-reconciliation-run.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const exec = await executeReferralReconciliationRun({ trigger: 'cron' })
  if (!exec.success) {
    return NextResponse.json(
      { success: false, error: exec.error, ...(exec.result || {}) },
      { status: 500 },
    )
  }
  return NextResponse.json({ success: true, ...exec.result })
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
