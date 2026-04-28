import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { buildReferralActivityFeed } from '@/lib/referral/build-referral-activity-feed'
import { decodeReferralActivityCursor } from '@/lib/referral/referral-activity-cursor'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get('limit') || '15')
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 15
  const cursorParam = searchParams.get('cursor')
  const offset = decodeReferralActivityCursor(cursorParam || '')

  const { items, total, nextCursor } = await buildReferralActivityFeed(supabaseAdmin, session.userId, {
    limit,
    offset,
  })
  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      nextCursor,
      page: { limit, offset },
    },
  })
}
