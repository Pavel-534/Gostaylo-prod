/**
 * POST /api/v2/chat/messages — отправка с проверкой участника беседы.
 * Типы: text | image | file | voice | invoice | system (system — только ADMIN/MODERATOR).
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
import { registerTelegramReplyTarget } from '@/lib/services/telegram/telegram-reply-map.js'
import { getEffectiveRate } from '@/lib/services/currency.service'
import { otherPartyHasReadRaw } from '@/lib/chat/read-receipts'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

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
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,role,email,telegram_id,notification_preferences`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

async function fetchProfileIdByTelegramChatId(telegramChatId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?telegram_id=eq.${encodeURIComponent(String(telegramChatId))}&select=id&limit=1`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

function escHtmlTelegram(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Уведомление в Telegram + регистрация message_id для reply-to-web.
 * @returns {Promise<boolean>}
 */
async function sendNewMessageTelegramPing({
  recipientTelegramChatId,
  recipientUserId,
  conversationId,
  senderName,
  textBody,
}) {
  if (!TELEGRAM_BOT_TOKEN || !recipientTelegramChatId || !recipientUserId || !conversationId) return false
  const clip = String(textBody || '').substring(0, 450)
  const text =
    `💬 <b>Новое сообщение</b> · ${escHtmlTelegram(senderName)}\n\n` +
    `«${escHtmlTelegram(clip)}${String(textBody || '').length > 450 ? '…' : ''}»\n\n` +
    '<i>Ответьте на это сообщение здесь — текст уйдёт в чат на сайте GoStayLo.</i>'
  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: recipientTelegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    const tgJson = await tgRes.json().catch(() => ({}))
    const mid = tgJson?.result?.message_id
    if (tgJson?.ok && mid != null) {
      await registerTelegramReplyTarget(recipientTelegramChatId, mid, conversationId, recipientUserId)
      return true
    }
  } catch (e) {
    console.error('[chat/messages] telegram ping', e)
  }
  return false
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
      readAtRenter: m.read_at_renter ?? null,
      readAtPartner: m.read_at_partner ?? null,
      isRead: otherPartyHasReadRaw(m, conversation),
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

  // Клиент не может подменить отправителя — игнорируем поля, если прислали.
  if (body && typeof body === 'object') {
    delete body.sender_id
    delete body.sender_role
    delete body.sender_name
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

  const senderName = formatPrivacyDisplayNameForParticipant(
    profile?.first_name,
    profile?.last_name,
    profile?.email,
    'User'
  )
  const senderRole = accessRole

  let type = normalizeMessageType(rawType)

  let content = typeof bodyContent === 'string' ? bodyContent : legacyMessage
  let finalMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {}

  if (type === 'system' && !['ADMIN', 'MODERATOR'].includes(senderRole)) {
    const allowPartnerPassport =
      senderRole === 'PARTNER' &&
      finalMetadata?.system_key === 'passport_request' &&
      userParticipatesInConversation(userId, conversation)
    const allowPartnerBooking =
      senderRole === 'PARTNER' &&
      ['booking_confirmed', 'booking_declined'].includes(finalMetadata?.system_key) &&
      userParticipatesInConversation(userId, conversation)
    if (!allowPartnerPassport && !allowPartnerBooking) {
      return NextResponse.json(
        { success: false, error: 'System messages are restricted to staff or allowed partner flows' },
        { status: 403 },
      )
    }
    if (allowPartnerPassport) {
      if (!content || !String(content).trim()) {
        content =
          'Пожалуйста, загрузите чёткое фото страницы паспорта для завершения бронирования. Данные обрабатываются конфиденциально.'
      }
      finalMetadata = { ...finalMetadata, system_key: 'passport_request' }
    }
    if (allowPartnerBooking) {
      if (!content || !String(content).trim()) {
        return NextResponse.json(
          { success: false, error: 'content is required for booking system messages' },
          { status: 400 }
        )
      }
      finalMetadata = { ...finalMetadata, system_key: finalMetadata.system_key }
    }
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

  if (type === 'file') {
    const url = finalMetadata.file_url || finalMetadata.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'file type requires metadata.file_url or metadata.url' },
        { status: 400 }
      )
    }
    const fname = finalMetadata.file_name || finalMetadata.name || 'file'
    finalMetadata = { ...finalMetadata, file_url: url, file_name: fname }
    content = content?.trim() || `📎 ${fname}`
  }

  if (type === 'voice') {
    const voiceUrl = finalMetadata.voice_url
    if (!voiceUrl || typeof voiceUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'voice type requires metadata.voice_url' },
        { status: 400 }
      )
    }
    finalMetadata = { ...finalMetadata, voice_url: voiceUrl }
    content = content?.trim() || '🎤'
  }

  if (type === 'invoice') {
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ success: false, error: 'invoice type requires positive amount' }, { status: 400 })
    }
    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    let usdtAmount
    let amountThbForPayload
    const cur = String(currency || 'THB').toUpperCase()
    if (cur === 'THB') {
      const mult = await getEffectiveRate('THB', 'USDT')
      usdtAmount = Math.round(amt * mult * 100) / 100
      amountThbForPayload = amt
    } else {
      usdtAmount = amt
      const mult = await getEffectiveRate('USDT', 'THB')
      amountThbForPayload = Math.round(amt * mult)
    }
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
      void notifySystemAlert(
        `💬 <b>Supabase: не удалось записать инвойс (чат)</b>\n` +
          `conversation: <code>${escapeSystemAlertHtml(conversationId)}</code>\n` +
          `<code>${escapeSystemAlertHtml(err.slice(0, 800))}</code>`,
      )
      return NextResponse.json(
        { success: false, error: 'Could not create invoice (run migration 005?)', details: err },
        { status: 400 }
      )
    }

    const invoicePayload = {
      id: invoiceId,
      amount: amt,
      amount_usdt: usdtAmount,
      amount_thb: amountThbForPayload,
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
    const detail =
      typeof msgData === 'string'
        ? msgData
        : JSON.stringify(msgData).slice(0, 1200)
    void notifySystemAlert(
      `💬 <b>Supabase: сбой записи сообщения в чат</b>\n` +
        `conversation: <code>${escapeSystemAlertHtml(conversationId)}</code>\n` +
        `type: <code>${escapeSystemAlertHtml(type)}</code>\n` +
        `<code>${escapeSystemAlertHtml(detail)}</code>`,
    )
    return NextResponse.json({ success: false, error: msgData }, { status: 400 })
  }

  await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`, {
    method: 'PATCH',
    headers: hdr,
    body: JSON.stringify({ updated_at: now, last_message_at: now }),
  })

  const base = getPublicSiteUrl()
  const cid = encodeURIComponent(conversationId)
  const msgDeepLink = `${base}/messages/${cid}`
  if (conversation.renter_id && String(userId) === String(conversation.partner_id)) {
    PushService.sendToUser(conversation.renter_id, 'NEW_MESSAGE', {
      sender: senderName,
      senderId: userId,
      link: msgDeepLink,
      conversationId,
      messageId: messageData.id,
    }).catch((e) => console.error('[chat/messages] FCM renter', e?.message || e))
  }
  if (conversation.partner_id && String(userId) === String(conversation.renter_id)) {
    PushService.sendToUser(conversation.partner_id, 'NEW_MESSAGE', {
      sender: senderName,
      senderId: userId,
      link: msgDeepLink,
      conversationId,
      messageId: messageData.id,
    }).catch((e) => console.error('[chat/messages] FCM partner', e?.message || e))
  }

  let telegramSent = false
  if (notifyTelegram && recipientTelegramId) {
    const recipRow = await fetchProfileIdByTelegramChatId(recipientTelegramId)
    const recipId = recipRow?.id
    const telegramTargetOk =
      recipId &&
      userParticipatesInConversation(recipId, conversation) &&
      String(recipId) !== String(userId)
    if (telegramTargetOk) {
      telegramSent = await sendNewMessageTelegramPing({
        recipientTelegramChatId: recipientTelegramId,
        recipientUserId: recipId,
        conversationId,
        senderName,
        textBody,
      })
    }
  }

  if (
    !telegramSent &&
    type === 'text' &&
    textBody &&
    !isStaffRole(senderRole) &&
    TELEGRAM_BOT_TOKEN
  ) {
    const otherId =
      String(userId) === String(conversation.partner_id)
        ? conversation.renter_id
        : String(userId) === String(conversation.renter_id)
          ? conversation.partner_id
          : null
    if (otherId) {
      const other = await fetchProfile(otherId)
      if (
        other?.telegram_id &&
        other?.notification_preferences &&
        typeof other.notification_preferences === 'object' &&
        other.notification_preferences.telegram === true
      ) {
        telegramSent = await sendNewMessageTelegramPing({
          recipientTelegramChatId: other.telegram_id,
          recipientUserId: other.id,
          conversationId,
          senderName,
          textBody,
        })
      }
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
      readAtRenter: null,
      readAtPartner: null,
      isRead: false,
      createdAt: messageData.created_at,
      invoice: invoiceRow,
    },
    telegramSent,
  })
}
