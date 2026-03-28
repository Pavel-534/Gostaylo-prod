/**
 * POST /api/v2/chat/favorites/bulk
 * Body: { conversationIds: string[] } — миграция с localStorage; только INSERT, дубликаты игнорируются.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'
import {
  supabaseConfigured,
  supabaseServiceWriteHeaders,
  fetchConversationRowForFavoriteCheck,
  userMayFavoriteConversation,
} from '@/lib/services/chat-conversation-favorites-server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const MAX_IDS = 500

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

  const raw = body?.conversationIds
  if (!Array.isArray(raw)) {
    return NextResponse.json({ success: false, error: 'conversationIds array required' }, { status: 400 })
  }

  const unique = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))].slice(0, MAX_IDS)

  let inserted = 0
  let skipped = 0
  const errors = []

  for (const conversationId of unique) {
    const row = await fetchConversationRowForFavoriteCheck(conversationId)
    if (!row) {
      skipped += 1
      continue
    }
    if (!userMayFavoriteConversation(row, userId, staff)) {
      skipped += 1
      continue
    }

    const ins = await fetch(`${SUPABASE_URL}/rest/v1/chat_conversation_favorites`, {
      method: 'POST',
      headers: supabaseServiceWriteHeaders,
      body: JSON.stringify({
        user_id: userId,
        conversation_id: conversationId,
      }),
    })

    if (ins.ok) {
      inserted += 1
      continue
    }

    const insData = await ins.json().catch(() => ({}))
    const conflict =
      ins.status === 409 ||
      String(insData?.code || '').includes('23505') ||
      /duplicate|unique/i.test(JSON.stringify(insData))
    if (conflict) {
      skipped += 1
      continue
    }

    errors.push({ conversationId, message: insData?.message || ins.status })
  }

  return NextResponse.json({
    success: true,
    data: { inserted, skipped, attempted: unique.length, errors: errors.slice(0, 20) },
  })
}
