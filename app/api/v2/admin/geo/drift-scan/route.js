/**
 * POST /api/v2/admin/geo/drift-scan
 * Stage 164 — manual geo drift scan (admin health dashboard).
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { runGeoDriftScan } from '@/lib/services/geo-drift-detector.service'
import { getMapPinsMetricsSnapshot } from '@/lib/geo/map-pins-metrics'

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  let body = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const mapPins = getMapPinsMetricsSnapshot()
  const result = await runGeoDriftScan({
    toleranceM: body?.toleranceM,
    sampleLimit: body?.sampleLimit,
    emitSignals: body?.emitSignals !== false,
    clusterPrivacyRatio: mapPins.cluster_privacy_ratio,
  })

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error, data: result }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: result })
}
