import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { ReputationService } from '@/lib/services/reputation.service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const access = await verifyPartnerAccess(userId)
    if (!access) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const data = await ReputationService.getPartnerReputationHealth(userId)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error('[PARTNER REPUTATION HEALTH]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
