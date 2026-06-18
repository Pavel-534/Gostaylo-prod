/**
 * POST /api/cron/geo-drift-detector
 * Stage 164 — geo drift scan + critical signals (CRON_SECRET).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { runFullAudit } from '@/lib/services/geo-drift-detector.service'
import { getMapPinsMetricsSnapshot } from '@/lib/geo/map-pins-metrics'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  const run = await startOpsJobRun('geo-drift-detector')
  try {
    const mapPins = getMapPinsMetricsSnapshot()
    const result = await runFullAudit({
      clusterPrivacyRatio: mapPins.cluster_privacy_ratio,
    })
    await finishOpsJobRun(run, {
      status: result.ok ? 'success' : 'error',
      stats: result,
      errorMessage: result.error || null,
    })
    return NextResponse.json({ success: result.ok, data: result })
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
    message: 'Scans coordinates vs lat/lng drift, unverified geo, GiST index health, cluster privacy ratio',
  })
}
