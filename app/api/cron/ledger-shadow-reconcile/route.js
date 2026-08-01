/**
 * POST /api/cron/ledger-shadow-reconcile
 * ADR-203 Phase 1 — daily status vs ledger shadow; alert [LEDGER_DRIFT]; ops_job_runs.
 * Does not flip getPartnerBalance / payout SoT.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import {
  LEDGER_SHADOW_JOB_NAME,
  PROOF_ZERO_DRIFT_DAYS,
  runLedgerShadowReconcile,
  countConsecutiveZeroDriftDays,
} from '@/lib/ops/ledger-shadow-reconcile.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun(LEDGER_SHADOW_JOB_NAME)
  try {
    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const result = await runLedgerShadowReconcile({
      limitPartners: body?.limitPartners,
      asOfDate: body?.asOfDate || null,
      alert: body?.alert !== false,
    })

    await finishOpsJobRun(run, {
      status: 'success',
      stats: {
        compared: result.compared,
        errors: result.errors,
        driftCount: result.driftCount,
        zeroDrift: result.zeroDrift,
        toleranceThb: result.toleranceThb,
      },
    })

    const proofStreakDays = await countConsecutiveZeroDriftDays()
    return NextResponse.json({
      success: true,
      ...result,
      proofStreakDays,
      proofReady: proofStreakDays >= PROOF_ZERO_DRIFT_DAYS,
      proofRequiredDays: PROOF_ZERO_DRIFT_DAYS,
    })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const proofStreakDays = await countConsecutiveZeroDriftDays()
  return NextResponse.json({
    success: true,
    message:
      'ADR-203 Phase 1 shadow: compare getPartnerBalance vs getPartnerBalanceFromLedger; POST to run',
    proofStreakDays,
    proofReady: proofStreakDays >= PROOF_ZERO_DRIFT_DAYS,
    proofRequiredDays: PROOF_ZERO_DRIFT_DAYS,
  })
}
