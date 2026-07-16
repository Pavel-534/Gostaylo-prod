/**
 * GET /api/v2/chat/unread-count — lightweight nav badge (Stage 171.29).
 * Auth only; no conversation payloads.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { getUserChatUnreadCount } from '@/lib/services/chat/user-unread-count.service.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const e2eBypass = request.headers.get('x-e2e-test-mode') === '1'

  try {
    const { count, lastUpdated } = await getUserChatUnreadCount(session.userId, { e2eBypass })
    return NextResponse.json({
      success: true,
      count,
      lastUpdated,
    })
  } catch (error) {
    console.error('[chat/unread-count]', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Unread count failed' },
      { status: 500 },
    )
  }
}
