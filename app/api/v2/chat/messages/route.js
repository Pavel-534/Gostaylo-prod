/**
 * POST /api/v2/chat/messages — отправка с проверкой участника беседы.
 * Типы: text | image | invoice | system (system — только ADMIN/MODERATOR).
 *
 * GET /api/v2/chat/messages?conversationId= — история (сессия + участник).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  canReadConversation,
  canWriteConversation,
  effectiveRoleFromProfile,
  isStaffRole,
  userParticipatesInConversation,
} from '@/lib/services/chat/access'
import { insertAuditLog } from '@/lib/services/audit/insert-audit-log'
import { normalizeMessageType } from '@/lib/services/chat/message-types'
import { PushService } from '@/lib/services/push.service.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function fetchConversation(conversationId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`, {
    headers: hdr,
    cache: 'no-store',
  })
  const rows = await res.json()
  return { ok: res.ok, conversation: Array.isArray(rows) ? rows[0] : null, raw: rows }
}

async function fetchProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,role,email,telegram_id`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

export async function GET(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.userId

  const conversationId = new URL(request.url).searchParams.get('conversationId')
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

  if (isStaffRole(accessRole)) {
    insertAuditLog({
      userId,
      action: 'ADMIN_CONVERSATION_ACCESS',
      entityType: 'conversation',
      entityId: conversationId,
      payload: {
        message: `Admin [${userId}] accessed conversation [${conversationId}]`,
      },
    }).catch(() => {})
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc&select=*`,
    { headers: hdr, cache: 'no-store' }
  )
  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ success: false, error: data }, { status: 400 })
  }

  const list = Array.isArray(data) ? data : []

  return NextResponse.json({
    success: true,
    data: list.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      senderRole: m.sender_role,
      senderName: m.sender_name,
      content: m.content ?? m.message,
      message: m.message ?? m.content,
      type: m.type,
      metadata: m.metadata ?? null,
      isRead: m.is_read,
      createdAt: m.created_at,
    })),
  })
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

  const {
    conversationId,
    content: bodyContent,
    message: legacyMessage,
    type: rawType,
    metadata = null,
    notifyTelegram = false,
    recipientTelegramId = null,
    amount,
    bookingId,
    currency = 'THB',
    /** true = клиент видит собеседника в Supabase Presence — не шлём FCM */
    skipPush = false,
  } = body

  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
  }

  const { ok, conversation } = await fetchConversation(conversationId)
  if (!ok || !conversation) {
    return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
  }

  const profile = await fetchProfile(userId)
  const accessRole = effectiveRoleFromProfile(profile)

  if (!canWriteConversation(userId, accessRole, conversation)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const senderName =
    [profile?.first_name, profile?.last_name?.replace(' [MODERATOR]', '')]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    profile?.email ||
    'User'
  const senderRole = accessRole

  let type = normalizeMessageType(rawType)

  let content = typeof bodyContent === 'string' ? bodyContent : legacyMessage
  let finalMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {}

  if (type === 'system' && !['ADMIN', 'MODERATOR'].includes(senderRole)) {
    const allowPartnerPassport =
      senderRole === 'PARTNER' &&
      finalMetadata?.system_key === 'passport_request' &&
      userParticipatesInConversation(userId, conversation)
    if (!allowPartnerPassport) {
      return NextResponse.json({ success: false, error: 'Only staff can send system messages' }, { status: 403 })
    }
    if (!content || !String(content).trim()) {
      content =
        'Пожалуйста, загрузите чёткое фото страницы паспорта для завершения бронирования. Данные обрабатываются конфиденциально.'
    }
    finalMetadata = { ...finalMetadata, system_key: 'passport_request' }
  }
  let invoiceRow = null

  if (type === 'image') {
    const url = finalMetadata.image_url || finalMetadata.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'image type requires metadata.image_url or metadata.url' },
        { status: 400 }
      )
    }
    content = content?.trim() || `📷 ${url}`
  }

  if (type === 'invoice') {
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ success: false, error: 'invoice type requires positive amount' }, { status: 400 })
    }
    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const usdtAmount = currency === 'THB' ? Math.round((amt / 35.5) * 100) / 100 : amt
    invoiceRow = {
      id: invoiceId,
      conversation_id: conversationId,
      booking_id: bookingId || conversation.booking_id || null,
      amount: amt,
      status: 'pending',
      metadata: {
        currency,
        payment_method: finalMetadata.payment_method || finalMetadata.paymentMethod || 'CRYPTO',
        description: finalMetadata.description || null,
      },
    }

    const invRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify(invoiceRow),
    })

    if (!invRes.ok) {
      const err = await invRes.text()
      console.error('[chat/messages] invoice insert', err)
      return NextResponse.json(
        { success: false, error: 'Could not create invoice (run migration 005?)', details: err },
        { status: 400 }
      )
    }

    const invoicePayload = {
      id: invoiceId,
      amount: amt,
      amount_usdt: usdtAmount,
      amount_thb: currency === 'THB' ? amt : Math.round(amt * 35.5),
      currency,
      payment_method: invoiceRow.metadata.payment_method,
      status: 'PENDING',
      description: invoiceRow.metadata.description,
      booking_id: invoiceRow.booking_id,
      created_at: new Date().toISOString(),
    }

    finalMetadata = {
      ...finalMetadata,
      invoice_id: invoiceId,
      invoice: invoicePayload,
    }
    content =
      content?.trim() ||
      `💳 Invoice: ${currency === 'THB' ? '฿' : '$'}${amt.toLocaleString()} ${currency}`
  }

  if (type === 'text' && (!content || !String(content).trim())) {
    return NextResponse.json({ success: false, error: 'content is required for text messages' }, { status: 400 })
  }

  const textBody = String(content ?? '').trim()
  const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()

  const messageData = {
    id: messageId,
    conversation_id: conversationId,
    sender_id: userId,
    sender_role: senderRole,
    sender_name: senderName,
    message: textBody,
    content: textBody,
    type,
    metadata: Object.keys(finalMetadata).length ? finalMetadata : null,
    is_read: false,
    created_at: now,
  }

  const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify(messageData),
  })

  const msgData = await msgRes.json()
  if (!msgRes.ok) {
    return NextResponse.json({ success: false, error: msgData }, { status: 400 })
  }

  await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: hdr,
    body: JSON.stringify({ updated_at: now, last_message_at: now }),
  })

  if (!skipPush) {
    const base = getPublicSiteUrl()
    const cid = encodeURIComponent(conversationId)
    if (conversation.renter_id && String(userId) === String(conversation.partner_id)) {
      PushService.sendToUser(conversation.renter_id, 'NEW_MESSAGE', {
        sender: senderName,
        link: `${base}/renter/messages/${cid}`,
      }).catch((e) => console.error('[chat/messages] FCM renter', e?.message || e))
    }
    if (conversation.partner_id && String(userId) === String(conversation.renter_id)) {
      PushService.sendToUser(conversation.partner_id, 'NEW_MESSAGE', {
        sender: senderName,
        link: `${base}/partner/messages/${cid}`,
      }).catch((e) => console.error('[chat/messages] FCM partner', e?.message || e))
    }
  }

  let telegramSent = false
  if (notifyTelegram && recipientTelegramId && TELEGRAM_BOT_TOKEN) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: recipientTelegramId,
          text: `📬 <b>New message from ${senderName}</b>\n\n${textBody.substring(0, 500)}${textBody.length > 500 ? '...' : ''}\n\n<i>Reply in Gostaylo inbox</i>`,
          parse_mode: 'HTML',
        }),
      })
      telegramSent = tgRes.ok
    } catch (e) {
      console.error('[chat/messages] telegram', e)
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: messageData.id,
      conversationId: messageData.conversation_id,
      senderId: messageData.sender_id,
      senderRole: messageData.sender_role,
      senderName: messageData.sender_name,
      content: messageData.content,
      type: messageData.type,
      metadata: messageData.metadata,
      isRead: messageData.is_read,
      createdAt: messageData.created_at,
      invoice: invoiceRow,
    },
    telegramSent,
  })
}
