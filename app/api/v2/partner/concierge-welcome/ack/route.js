/**
 * POST /api/v2/partner/concierge-welcome/ack
 * ADR-210 Slice 7.1 — clear concierge_welcome_pending after partner dismisses banner.
 */

import { NextResponse } from 'next/server'
import { requirePartnerSession } from '@/lib/services/session-service'
import { clearConciergeWelcomePending } from '@/lib/services/concierge/concierge-partner-notify.service.js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const auth = await requirePartnerSession()
  if (auth.error) return auth.error

  const result = await clearConciergeWelcomePending({ partnerProfileId: auth.userId })
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, cleared: result.cleared === true })
}
