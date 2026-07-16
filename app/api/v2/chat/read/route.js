/**
 * POST /api/v2/chat/read — пометить входящие сообщения в беседе прочитанными для текущего пользователя.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  canReadConversation,
  effectiveRoleFromProfile,
  isStaffRole,
} from '@/lib/services/chat/access'
import { viewerConversationSide } from '@/lib/chat/read-receipts'
import { getUserChatUnreadCount } from '@/lib/services/chat/user-unread-count.service.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchConversation(conversationId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return { ok: res.ok, conversation: Array.isArray(rows) ? rows[0] : null }
}

async function fetchProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,role`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

export async function POST(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.userId

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

  const profile = await fetchProfile(userId)
  const accessRole = effectiveRoleFromProfile(profile)

  if (!canReadConversation(userId, accessRole, conversation)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  /** Админ/модератор смотрит чат «наблюдателем» — не трогаем is_read (галочки у гостя/партнёра). */
  if (isStaffRole(accessRole)) {
    console.log(
      `[chat/read] Staff [${userId}] viewed conversation [${conversationId}] in stealth mode`
    )
    return NextResponse.json({ success: true, skipped: true, reason: 'staff_observer' })
  }

  const uid = encodeURIComponent(String(userId))
  const cid = encodeURIComponent(String(conversationId))

  const side = viewerConversationSide(userId, conversation)
  const nowIso = new Date().toISOString()

  let patchRes
  if (side === 'renter' || side === 'partner') {
    const readCol = side === 'renter' ? 'read_at_renter' : 'read_at_partner'
    patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${cid}&sender_id=neq.${uid}&${readCol}=is.null`,
      {
        method: 'PATCH',
        headers: hdr,
        body: JSON.stringify({ [readCol]: nowIso, is_read: true }),
      }
    )
  } else {
    patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${cid}&is_read=eq.false&sender_id=neq.${uid}`,
      {
        method: 'PATCH',
        headers: hdr,
        body: JSON.stringify({ is_read: true }),
      }
    )
  }

  if (!patchRes.ok) {
    const err = await patchRes.text()
    console.error('[chat/read]', err)
    return NextResponse.json({ success: false, error: 'Could not update messages' }, { status: 400 })
  }

  // ── Синхронизация уведомлений (fire-and-forget) ──────────────────────────
  // После прочтения — сбрасываем badge и тихий push с актуальным счётчиком непрочитанных.
  try {
    await syncBadgeCount(userId)
  } catch (e) {
    console.warn('[chat/read] badge sync failed', e?.message)
  }

  return NextResponse.json({ success: true })
}

/**
 * Подсчитывает глобальный unread пользователя и отправляет silent FCM с badge-счётчиком.
 * Работает по принципу fire-and-forget — не блокирует ответ API.
 */
async function syncBadgeCount(userId) {
  const { count: totalUnread } = await getUserChatUnreadCount(userId)
  const { PushService } = await import('@/lib/services/push.service.js')
  await PushService.sendSilentBadgeUpdateToUser(userId, totalUnread)
}
