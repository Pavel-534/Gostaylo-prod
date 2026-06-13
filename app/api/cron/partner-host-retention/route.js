/**
 * GET/POST /api/cron/partner-host-retention — D+1 / D+3 host onboarding nudges (Stage 135).
 */
import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { NotificationService } from '@/lib/services/notification.service.js'

export const dynamic = 'force-dynamic'

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  try {
    const result = await NotificationService.runPartnerHostOnboardingRetention()
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
