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
    return NextResponse.json({ success: true, skipped: true, reason: 'staff_observer' })
  }

  const uid = encodeURIComponent(String(userId))
  const cid = encodeURIComponent(String(conversationId))

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${cid}&is_read=eq.false&sender_id=neq.${uid}`,
    {
      method: 'PATCH',
      headers: hdr,
      body: JSON.stringify({ is_read: true }),
    }
  )

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
  // 1. Суммируем непрочитанные для пользователя (он может быть renter или partner)
  const uid = encodeURIComponent(String(userId))
  const [renterRes, partnerRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/messages?is_read=eq.false&sender_id=neq.${uid}&select=id`,
      { headers: hdr, cache: 'no-store' }
    ),
    // Второй запрос — через conversations где юзер является partner
    fetch(
      `${SUPABASE_URL}/rest/v1/messages?is_read=eq.false&sender_id=neq.${uid}&select=id&limit=1`,
      { headers: hdr, cache: 'no-store' }
    ),
  ])

  // Упрощённый подсчёт: все непрочитанные в любых беседах где userId участник
  const convRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?or=(renter_id.eq.${uid},partner_id.eq.${uid},owner_id.eq.${uid})&select=id`,
    { headers: hdr, cache: 'no-store' }
  )
  const convRows = await convRes.json()
  if (!Array.isArray(convRows) || convRows.length === 0) return

  const cids = convRows.map((c) => encodeURIComponent(c.id)).join(',')
  const unreadRes = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?conversation_id=in.(${cids})&is_read=eq.false&sender_id=neq.${uid}&select=id`,
    { headers: hdr, cache: 'no-store' }
  )
  const unreadRows = await unreadRes.json()
  const totalUnread = Array.isArray(unreadRows) ? unreadRows.length : 0

  // 2. Получаем FCM-токен пользователя
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=fcm_token`,
    { headers: hdr, cache: 'no-store' }
  )
  const profileRows = await profileRes.json()
  const fcmToken = Array.isArray(profileRows) ? profileRows[0]?.fcm_token : null
  if (!fcmToken) return

  // 3. Тихий push «обнови badge» — без уведомления, только data-payload
  const { PushService } = await import('@/lib/services/push.service.js')
  await PushService.sendSilentBadgeUpdate(fcmToken, totalUnread)
}
