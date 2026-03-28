/**
 * GET /api/v2/chat/favorites
 * Список id избранных бесед текущего пользователя.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  supabaseConfigured,
  supabaseServiceHeaders,
} from '@/lib/services/chat-conversation-favorites-server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.userId

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/chat_conversation_favorites?user_id=eq.${encodeURIComponent(userId)}` +
        '&select=conversation_id&limit=50000',
      { headers: supabaseServiceHeaders, cache: 'no-store' },
    )
    const rows = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: rows?.message || rows?.hint || 'Fetch failed',
          details: rows,
        },
        { status: res.status },
      )
    }

    const ids = Array.isArray(rows) ? rows.map((r) => String(r.conversation_id)).filter(Boolean) : []

    return NextResponse.json({ success: true, data: ids })
  } catch (e) {
    console.error('[chat/favorites GET]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
