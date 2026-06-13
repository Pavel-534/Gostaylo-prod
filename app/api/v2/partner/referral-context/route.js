/**
 * GET /api/v2/partner/referral-context — direct referrer + host activation status (Stage 132.2).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { resolvePartnerReferralContext } from '@/lib/partner/partner-referral-context'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userId = await getUserIdFromSession()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const data = await resolvePartnerReferralContext(userId)
  return NextResponse.json({ success: true, data })
}
