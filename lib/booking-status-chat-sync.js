/**
 * Единая точка: при смене статуса брони пишем system-сообщение в связанный conversation.
 * Вызывается из API/сервисов после успешного UPDATE bookings (не из клиента).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { buildBookingStatusChatPayload } from '@/lib/booking-chat-copy'

function newMessageId() {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function recentDuplicateSync({ conversationId, bookingId, newStatus }) {
  const { data: rows, error } = await supabaseAdmin
    .from('messages')
    .select('id, metadata, created_at')
    .eq('conversation_id', conversationId)
    .eq('type', 'system')
    .order('created_at', { ascending: false })
    .limit(12)

  if (error || !rows?.length) return false
  const now = Date.now()
  const bid = String(bookingId)
  const next = String(newStatus || '').toUpperCase()
  return rows.some((r) => {
    const ev = r.metadata?.booking_status_event
    if (!ev || String(ev.booking_id) !== bid || String(ev.to_status).toUpperCase() !== next) return false
    const t = new Date(r.created_at).getTime()
    if (Number.isNaN(t)) return false
    return now - t < 120_000
  })
}

/**
 * @param {object} opts
 * @param {string} opts.bookingId
 * @param {string} opts.previousStatus
 * @param {string} opts.newStatus
 * @param {string} [opts.declineReasonKey] occupied | repair | other
 * @param {string} [opts.declineReasonDetail] текст для «Другое»
 * @param {string} [opts.reasonFreeText] произвольная причина (Telegram и т.д.)
 */
export async function syncBookingStatusToConversationChat(opts) {
  const {
    bookingId,
    previousStatus,
    newStatus,
    declineReasonKey,
    declineReasonDetail,
    reasonFreeText,
  } = opts || {}

  if (!supabaseAdmin || !bookingId || !newStatus) {
    return { skipped: true, reason: 'missing_config_or_args' }
  }

  const prev = String(previousStatus || '').toUpperCase()
  const next = String(newStatus || '').toUpperCase()
  if (prev === next) {
    return { skipped: true, reason: 'same_status' }
  }

  const bid = String(bookingId)

  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('id, partner_id, renter_id')
    .eq('booking_id', bid)
    .limit(1)
    .maybeSingle()

  if (convErr || !conv?.id) {
    return { skipped: true, reason: 'no_conversation' }
  }

  if (await recentDuplicateSync({ conversationId: conv.id, bookingId: bid, newStatus: next })) {
    return { skipped: true, reason: 'deduped' }
  }

  const { data: bookingRow } = await supabaseAdmin
    .from('bookings')
    .select('partner_id')
    .eq('id', bid)
    .maybeSingle()

  const senderId = bookingRow?.partner_id || conv.partner_id
  if (!senderId) {
    return { skipped: true, reason: 'no_sender' }
  }

  const payload = buildBookingStatusChatPayload({
    previousStatus: prev,
    newStatus: next,
    declineReasonKey,
    declineReasonDetail,
    reasonFreeText,
  })

  const titleRu = payload.announcement_title || 'Обновление'
  const bodyRu = payload.announcement_body || ''
  const content = `${titleRu}\n\n${bodyRu}`.trim()

  const metadata = {
    system_key: payload.system_key,
    booking_announcement: true,
    announcement_title: titleRu,
    announcement_body: bodyRu,
    announcement_title_en: payload.announcement_title_en || null,
    announcement_body_en: payload.announcement_body_en || null,
    announcement_accent: payload.accent || 'info',
    booking_status_event: {
      booking_id: bid,
      from_status: prev,
      to_status: next,
      at: new Date().toISOString(),
    },
    decline_reason_key: payload.decline_reason_key ?? declineReasonKey ?? null,
  }

  const now = new Date().toISOString()
  const row = {
    id: newMessageId(),
    conversation_id: conv.id,
    sender_id: senderId,
    sender_role: 'PARTNER',
    sender_name: 'GoStayLo',
    message: content,
    content,
    type: 'system',
    metadata,
    is_read: false,
    created_at: now,
  }

  const { error: insErr } = await supabaseAdmin.from('messages').insert(row)
  if (insErr) {
    console.error('[booking-status-chat-sync] insert failed', insErr)
    return { skipped: false, error: insErr.message }
  }

  // Keep conversation.status_label in sync with booking lifecycle so inbox badges stay current.
  const statusLabelMap = {
    PENDING:   'PENDING',
    CONFIRMED: 'CONFIRMED',
    PAID:      'PAID',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REFUNDED:  'REFUNDED',
  }
  const newStatusLabel = statusLabelMap[next] ?? next
  await supabaseAdmin
    .from('conversations')
    .update({ status_label: newStatusLabel, updated_at: now, last_message_at: now })
    .eq('id', conv.id)

  return { skipped: false, messageId: row.id, conversationId: conv.id }
}
