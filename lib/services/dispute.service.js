import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service'
import { NotificationService } from '@/lib/services/notification.service'
import { getPublicSiteUrl } from '@/lib/site-url'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'

const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN_REVIEW']
const RECENT_DISPUTE_COOLDOWN_MS = 6 * 60 * 60 * 1000

function createDisputeId() {
  return `dsp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function trimReason(value, max = 2000) {
  return String(value || '').trim().slice(0, max)
}

function resolveCounterparty(booking, actorId) {
  const renterId = String(booking?.renter_id || '')
  const partnerId = String(booking?.partner_id || '')
  if (renterId && renterId === String(actorId || '')) return partnerId || null
  if (partnerId && partnerId === String(actorId || '')) return renterId || null
  return null
}

async function getConversationIdForBooking(bookingId, providedConversationId = null) {
  if (providedConversationId) return String(providedConversationId)
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

async function getProfileSafe(userId) {
  if (!userId) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role, language')
    .eq('id', userId)
    .maybeSingle()
  return data || null
}

function composeCounterpartyEmail({ bookingId, reason, lang = 'ru' }) {
  const isRu = lang !== 'en'
  if (isRu) {
    return {
      subject: 'Открыт спор по бронированию',
      body:
        `По вашему заказу #${bookingId} открыт спор.\n` +
        'Оплата приостановлена до выяснения обстоятельств.\n\n' +
        (reason ? `Комментарий инициатора:\n${reason}\n\n` : '') +
        'Поддержка свяжется с вами в чате GoStayLo.',
    }
  }
  return {
    subject: 'A dispute has been opened for your booking',
    body:
      `A dispute has been opened for booking #${bookingId}.\n` +
      'Payment is paused until the case is reviewed.\n\n' +
      (reason ? `Initiator comment:\n${reason}\n\n` : '') +
      'Support will contact you in GoStayLo chat.',
  }
}

export class DisputeService {
  static ACTIVE_DISPUTE_STATUSES = ACTIVE_DISPUTE_STATUSES

  static async getFrozenBookingIdSet(bookingIds) {
    const ids = Array.isArray(bookingIds) ? bookingIds.filter(Boolean).map(String) : []
    if (!ids.length) return new Set()
    const { data } = await supabaseAdmin
      .from('disputes')
      .select('booking_id')
      .in('booking_id', ids)
      .eq('freeze_payment', true)
      .in('status', ACTIVE_DISPUTE_STATUSES)
    return new Set((data || []).map((x) => String(x.booking_id)))
  }

  static async createOfficialDispute({
    actorId,
    booking,
    reason,
    category = 'general',
    conversationId = null,
  }) {
    if (!actorId || !booking?.id) {
      return { success: false, code: 'INVALID_INPUT', error: 'Missing actor or booking' }
    }

    const eligibility = canOpenOfficialDispute({
      status: booking.status,
      checkInIso: booking.check_in,
      checkOutIso: booking.check_out,
    })
    if (!eligibility.allowed) {
      return { success: false, code: 'DISPUTE_NOT_ALLOWED', error: eligibility.reason }
    }

    const bookingId = String(booking.id)
    const actor = String(actorId)
    const counterpartyId = resolveCounterparty(booking, actor)
    if (!counterpartyId) {
      return { success: false, code: 'FORBIDDEN', error: 'Booking actor mismatch' }
    }

    const { data: active } = await supabaseAdmin
      .from('disputes')
      .select('id, status, created_at')
      .eq('booking_id', bookingId)
      .in('status', ACTIVE_DISPUTE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (active?.id) {
      return {
        success: true,
        alreadyExists: true,
        dispute: active,
      }
    }

    const { data: lastByActor } = await supabaseAdmin
      .from('disputes')
      .select('id, created_at')
      .eq('booking_id', bookingId)
      .eq('opened_by', actor)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastByActor?.created_at) {
      const delta = Date.now() - new Date(lastByActor.created_at).getTime()
      if (Number.isFinite(delta) && delta >= 0 && delta < RECENT_DISPUTE_COOLDOWN_MS) {
        return {
          success: false,
          code: 'COOLDOWN',
          error: 'Recent dispute already submitted',
        }
      }
    }

    const disputeId = createDisputeId()
    const now = new Date().toISOString()
    const finalConversationId = await getConversationIdForBooking(bookingId, conversationId)
    const reasonText = trimReason(reason)

    const insertPayload = {
      id: disputeId,
      booking_id: bookingId,
      conversation_id: finalConversationId,
      opened_by: actor,
      against_user_id: counterpartyId,
      category: String(category || 'general').slice(0, 64),
      reason_code: 'official_dispute',
      description: reasonText,
      status: 'OPEN',
      freeze_payment: true,
      force_refund_requested: false,
      penalty_requested: false,
      admin_action_flags: {
        freeze_payment: true,
        force_refund: false,
        add_penalty: false,
      },
      metadata: {
        source: 'unified_order_card',
      },
      created_at: now,
      updated_at: now,
    }

    const { error: insErr } = await supabaseAdmin.from('disputes').insert(insertPayload)
    if (insErr) {
      return { success: false, code: 'DB_INSERT_FAILED', error: insErr.message }
    }

    if (finalConversationId) {
      const body =
        `🧾 Открыт официальный спор\n` +
        `Booking: ${bookingId}\n` +
        `Dispute: ${disputeId}\n` +
        (reasonText ? `Комментарий: ${reasonText}` : 'Комментарий: —')
      const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      await supabaseAdmin.from('messages').insert({
        id: msgId,
        conversation_id: finalConversationId,
        sender_id: actor,
        sender_role: 'SYSTEM',
        sender_name: 'GoStayLo Support',
        message: body,
        content: body,
        type: 'system',
        metadata: {
          system_key: 'dispute_opened',
          dispute_id: disputeId,
          booking_id: bookingId,
          dispute_reason: reasonText,
        },
        is_read: false,
        created_at: now,
      })
      await supabaseAdmin
        .from('conversations')
        .update({ is_priority: true, updated_at: now, last_message_at: now })
        .eq('id', finalConversationId)
    }

    const [actorProfile, counterpartyProfile] = await Promise.all([
      getProfileSafe(actor),
      getProfileSafe(counterpartyId),
    ])

    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    const adminLink = finalConversationId
      ? `${base}/admin/messages/?open=${encodeURIComponent(finalConversationId)}`
      : `${base}/admin/messages/`

    await PushService.notifyStaffSupportEscalation(finalConversationId || bookingId)
    await NotificationService.sendToAdminTopic(
      'MESSAGES',
      `🧾 <b>OFFICIAL DISPUTE OPENED</b>\n\n` +
        `<b>Dispute:</b> <code>${disputeId}</code>\n` +
        `<b>Booking:</b> <code>${bookingId}</code>\n` +
        `<b>Opened by:</b> ${actorProfile?.email || actor}\n` +
        `<b>Against:</b> ${counterpartyProfile?.email || counterpartyId}\n` +
        `<b>Freeze payment:</b> yes\n` +
        (reasonText ? `<b>Reason:</b> ${reasonText}\n` : '') +
        `\n<a href="${adminLink}">Open thread in admin</a>`
    )

    const counterpartyLink = finalConversationId
      ? `/messages/${encodeURIComponent(finalConversationId)}`
      : `/renter/bookings?booking=${encodeURIComponent(bookingId)}`
    await PushService.sendToUser(counterpartyId, 'DISPUTE_OPENED', {
      bookingId,
      link: counterpartyLink,
    })

    if (counterpartyProfile?.email) {
      const msg = composeCounterpartyEmail({
        bookingId,
        reason: reasonText,
        lang: counterpartyProfile.language || 'ru',
      })
      await NotificationService.sendEmail(counterpartyProfile.email, msg.subject, msg.body)
    }

    return {
      success: true,
      dispute: {
        id: disputeId,
        booking_id: bookingId,
        conversation_id: finalConversationId,
        status: 'OPEN',
        freeze_payment: true,
      },
    }
  }
}

export default DisputeService
