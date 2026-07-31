/**
 * POST/GET /api/cron/cleanup-critical-signals
 * AUDIT_03 M3.6 — delete critical_signal_events older than 90 days.
 *
 * Vercel Hobby: daily in vercel.json. Prefer same cadence on cron-job.org (optional duplicate).
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { cleanupCriticalSignalEvents } from '@/lib/ops/cleanup-critical-signals.js'

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('cleanup-critical-signals')
  try {
    const url = new URL(request.url)
    const retentionDays = Number(url.searchParams.get('retentionDays') || 90)
    const result = await cleanupCriticalSignalEvents({ retentionDays })
    await finishOpsJobRun(run, {
      status: result.success ? 'success' : 'error',
      stats: {
        deleted: result.deleted,
        retentionDays: result.retentionDays,
        skipped: result.skipped ? 1 : 0,
      },
      errorMessage: result.error || null,
    })
    if (!result.success) {
      return NextResponse.json({ success: false, ...result }, { status: 500 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message })
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function POST(request) {
  return handle(request)
}

export async function GET(request) {
  return handle(request)
}
