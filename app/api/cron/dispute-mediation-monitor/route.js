/**
 * POST/GET /api/cron/dispute-mediation-monitor — Stage 21.0 stale PENDING_MEDIATION (24h+).
 * Vercel Cron: vercel.json + CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import DisputeService from '@/lib/services/dispute.service'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  try {
    const result = await DisputeService.processStaleMediationDisputes({ maxAgeHours: 24, limit: 80 })
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[CRON dispute-mediation-monitor]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
