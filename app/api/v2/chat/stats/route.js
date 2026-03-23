/**
 * GET /api/v2/chat/stats — агрегаты по диалогам (только ADMIN / MODERATOR).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: 'count=exact',
  Range: '0-0',
}

function countFromContentRange(res) {
  const cr = res.headers.get('content-range')
  if (!cr) return 0
  const m = cr.match(/\/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId || !isStaffRole(session.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const totalRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations?select=id`, {
      headers: hdr,
      cache: 'no-store',
    })
    const totalChats = countFromContentRange(totalRes)

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const activeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?select=id&last_message_at=gte.${encodeURIComponent(since)}`,
      { headers: hdr, cache: 'no-store' }
    )
    const activeToday = countFromContentRange(activeRes)

    const priorityRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?select=id&is_priority=eq.true`,
      { headers: hdr, cache: 'no-store' }
    )
    const supportNeeded = countFromContentRange(priorityRes)

    return NextResponse.json({
      success: true,
      data: {
        totalChats,
        activeToday,
        supportNeeded,
      },
    })
  } catch (e) {
    console.error('[chat/stats]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
