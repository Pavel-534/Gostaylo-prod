/**
 * POST /api/v2/cron/normalize-locations
 * Stage 161 — batch normalize unverified / legacy listing geo (CRON_SECRET).
 *
 * Body (optional): { "limit": 200 } — clamp 100–500, default env LOCATION_NORMALIZE_BATCH_SIZE or 200
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { runBatchLocationNormalize } from '@/lib/services/batch-location-normalize.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  let limit
  try {
    const body = await request.json().catch(() => ({}))
    if (body?.limit != null) limit = body.limit
  } catch {
    // empty body OK
  }

  try {
    const result = await runBatchLocationNormalize({ limit })
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, data: result }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    console.error('[CRON normalize-locations]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
