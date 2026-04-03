/**
 * POST /api/v2/chat/escalate
 * Участник (не staff) помечает диалог is_priority и уведомляет ADMIN/MODERATOR (один раз при первой эскалации).
 * Тело: { conversationId, category?, disputeType?, details? } — при указании category+disputeType
 * в чат добавляется структурированное сообщение для поддержки.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  effectiveRoleFromProfile,
  isStaffRole,
  userParticipatesInConversation,
} from '@/lib/services/chat/access'
import { PushService } from '@/lib/services/push.service.js'
import { sendMessage } from '@/lib/telegram'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import {
  SUPPORT_REASONS,
  SUPPORT_DISPUTE_KINDS,
  buildSupportTicketMessage,
} from '@/lib/support-request-options'

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
  Prefer: 'return=representation',
}

const hdrPatch = {
  ...hdrRead,
  'Content-Type': 'application/json',
}

const ALLOW_REASON = new Set(SUPPORT_REASONS.map((x) => x.slug))
const ALLOW_DISPUTE = new Set(SUPPORT_DISPUTE_KINDS.map((x) => x.slug))

function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchProfileShort(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,role,email`,
    { headers: hdrRead, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
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

  const rawCategory = typeof body?.category === 'string' ? body.category.trim() : ''
  const rawDispute = typeof body?.disputeType === 'string' ? body.disputeType.trim() : ''
  const rawDetails =
    typeof body?.details === 'string' ? body.details.trim().slice(0, 2000) : ''
  const wantsTicket = Boolean(rawCategory && rawDispute)
  if (wantsTicket) {
    if (!ALLOW_REASON.has(rawCategory)) {
      return NextResponse.json({ success: false, error: 'Invalid category' }, { status: 400 })
    }
    if (!ALLOW_DISPUTE.has(rawDispute)) {
      return NextResponse.json({ success: false, error: 'Invalid disputeType' }, { status: 400 })
    }
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

    const adminGroupId = process.env.TELEGRAM_ADMIN_GROUP_ID
    const rawTopic = process.env.TELEGRAM_SUPPORT_TOPIC_ID
    let threadId = 232
    if (rawTopic != null && String(rawTopic).trim() !== '') {
      const parsed = parseInt(String(rawTopic).trim(), 10)
      if (Number.isFinite(parsed) && parsed > 0) threadId = parsed
    }
    if (adminGroupId && process.env.TELEGRAM_BOT_TOKEN) {
      const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
      const adminLink = `${base}/admin/messages/?open=${encodeURIComponent(conversationId)}`
      const renterLabel =
        conversation.renter_name ||
        conversation.renter_id ||
        '—'
      const text =
        `🆘 <b>Support escalation</b>\n\n` +
        `<b>Conversation ID:</b> <code>${escHtml(conversationId)}</code>\n` +
        `<b>Renter:</b> ${escHtml(renterLabel)}\n` +
        `<a href="${adminLink}">Open in admin panel</a>`
      const tg = await sendMessage(adminGroupId, text, {
        message_thread_id: threadId,
        disable_web_page_preview: true,
      })
      if (!tg?.ok) {
        console.warn('[chat/escalate] Telegram support topic send failed:', tg?.description || tg?.error)
      }
    }
  }

  let ticketMessageId = null
  if (wantsTicket) {
    const profile = await fetchProfileShort(userId)
    const senderRole = effectiveRoleFromProfile(profile)
    const senderName =
      [profile?.first_name, profile?.last_name?.replace(' [MODERATOR]', '')]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      profile?.email ||
      'User'
    const ticket = {
      category: rawCategory,
      disputeType: rawDispute,
      details: rawDetails,
    }
    const lang = typeof body?.lang === 'string' && body.lang.toLowerCase().startsWith('en') ? 'en' : 'ru'
    const textBody = buildSupportTicketMessage(ticket, lang)
    const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const nowMsg = new Date().toISOString()
    const messageData = {
      id: messageId,
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: senderRole,
      sender_name: senderName,
      message: textBody,
      content: textBody,
      type: 'text',
      metadata: { support_ticket: ticket },
      is_read: false,
      created_at: nowMsg,
    }
    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: hdrWrite,
      body: JSON.stringify(messageData),
    })
    if (!msgRes.ok) {
      const err = await msgRes.json().catch(() => ({}))
      return NextResponse.json(
        {
          success: false,
          error: err?.message || err?.hint || 'Could not add support message',
        },
        { status: 400 }
      )
    }
    ticketMessageId = messageId
    await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      headers: hdrPatch,
      body: JSON.stringify({ updated_at: nowMsg, last_message_at: nowMsg }),
    })
  }

  return NextResponse.json({
    success: true,
    data: { isPriority: true, notified, ticketMessageId },
  })
}
