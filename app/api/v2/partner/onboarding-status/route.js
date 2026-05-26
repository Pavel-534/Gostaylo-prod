/**
 * GET /api/v2/partner/onboarding-status — чек-лист после approve (SSOT).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { resolvePartnerOnboardingStatus } from '@/lib/partner/partner-onboarding-status'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromSession()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const status = await resolvePartnerOnboardingStatus(userId)
  return NextResponse.json({ success: true, data: status })
}
