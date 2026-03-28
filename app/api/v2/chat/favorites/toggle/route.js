/**
 * POST /api/v2/chat/favorites/toggle
 * Body: { conversationId: string, isFavorite: boolean }
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'
import {
  supabaseConfigured,
  supabaseServiceHeaders,
  supabaseServiceWriteHeaders,
  fetchConversationRowForFavoriteCheck,
  userMayFavoriteConversation,
} from '@/lib/services/chat-conversation-favorites-server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

export async function POST(request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.userId
  const staff = isStaffRole(session.role)

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const conversationId = body?.conversationId != null ? String(body.conversationId).trim() : ''
  const isFavorite = body?.isFavorite === true

  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
  }

  const row = await fetchConversationRowForFavoriteCheck(conversationId)
  if (!row) {
    return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
  }

  if (!userMayFavoriteConversation(row, userId, staff)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (isFavorite) {
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/chat_conversation_favorites`, {
        method: 'POST',
        headers: supabaseServiceWriteHeaders,
        body: JSON.stringify({
          user_id: userId,
          conversation_id: conversationId,
        }),
      })
      const insData = await ins.json()
      if (!ins.ok) {
        const conflict =
          ins.status === 409 ||
          String(insData?.code || '').includes('23505') ||
          /duplicate|unique/i.test(JSON.stringify(insData))
        if (conflict) {
          return NextResponse.json({ success: true, data: { conversationId, isFavorite: true }, duplicate: true })
        }
        return NextResponse.json(
          { success: false, error: insData?.message || insData?.hint || 'Insert failed', details: insData },
          { status: 400 },
        )
      }
    } else {
      const del = await fetch(
        `${SUPABASE_URL}/rest/v1/chat_conversation_favorites?user_id=eq.${encodeURIComponent(userId)}` +
          `&conversation_id=eq.${encodeURIComponent(conversationId)}`,
        { method: 'DELETE', headers: supabaseServiceHeaders },
      )
      if (!del.ok) {
        const delData = await del.json().catch(() => ({}))
        return NextResponse.json(
          { success: false, error: delData?.message || 'Delete failed', details: delData },
          { status: del.status },
        )
      }
    }

    return NextResponse.json({ success: true, data: { conversationId, isFavorite } })
  } catch (e) {
    console.error('[chat/favorites/toggle]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
