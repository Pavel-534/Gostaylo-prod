/**
 * POST/GET /api/cron/dispute-mediation-monitor — Stage 21.0 stale PENDING_MEDIATION (24h+).
 * Vercel Cron: vercel.json + CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import DisputeService from '@/lib/services/dispute.service'

export const dynamic = 'force-dynamic'

const CRON_SECRET = process.env.CRON_SECRET

function authorize(request) {
  if (!CRON_SECRET) return false
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  return authHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
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
