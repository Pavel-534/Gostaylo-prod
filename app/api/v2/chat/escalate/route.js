/**
 * POST /api/v2/chat/escalate
 * Участник (не staff) помечает диалог is_priority и один раз уведомляет ADMIN/MODERATOR.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole, userParticipatesInConversation } from '@/lib/services/chat/access'
import { PushService } from '@/lib/services/push.service.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdrRead = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

const hdrWrite = {
  ...hdrRead,
  'Content-Type': 'application/json',
}

async function fetchConversation(conversationId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
    { headers: hdrRead, cache: 'no-store' }
  )
  const rows = await res.json()
  return { ok: res.ok, conversation: Array.isArray(rows) ? rows[0] : null }
}

export async function POST(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (isStaffRole(session.role)) {
    return NextResponse.json({ success: false, error: 'Staff cannot escalate' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const conversationId = body?.conversationId
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
  }

  const { ok, conversation } = await fetchConversation(conversationId)
  if (!ok || !conversation) {
    return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
  }

  const userId = session.userId
  if (!userParticipatesInConversation(userId, conversation)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const wasPriority = conversation.is_priority === true
  const now = new Date().toISOString()

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: hdrWrite,
    body: JSON.stringify({ is_priority: true, updated_at: now }),
  })

  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}))
    return NextResponse.json(
      { success: false, error: err?.message || err?.hint || 'Could not update conversation' },
      { status: 400 }
    )
  }

  let notified = false
  if (!wasPriority) {
    await PushService.notifyStaffSupportEscalation(conversationId)
    notified = true
  }

  return NextResponse.json({
    success: true,
    data: { isPriority: true, notified },
  })
}
