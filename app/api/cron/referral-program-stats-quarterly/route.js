/**
 * GET/POST /api/cron/referral-program-stats-quarterly
 * Last closed UTC quarter → referral_program_stats (ADR-131A §9.6).
 */
import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { upsertLastClosedQuarterReferralProgramStats } from '@/lib/services/marketing/referral-program-stats.service.js'

export const dynamic = 'force-dynamic'

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  try {
    const result = await upsertLastClosedQuarterReferralProgramStats()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Internal error' },
      { status: 500 },
    )
  }
}

export async function GET(request) {
  return handle(request)
}

export async function POST(request) {
  return handle(request)
}
