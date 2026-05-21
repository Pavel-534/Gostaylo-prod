/**
 * Stage 109.1 — side effects when an official dispute opens.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service'
import { NotificationEvents, NotificationService } from '@/lib/services/notification.service'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { computeDisputeDeadlineIso } from '@/lib/config/dispute-sla'
import { getProfileSafe } from '@/lib/services/dispute/dispute-shared.js'

export async function runDisputeOpenedSideEffects({
  disputeId,
  bookingId,
  actor,
  counterpartyId,
  reasonText,
  evidence,
  finalConversationId,
  now,
}) {
  if (finalConversationId) {
    const body =
      `🧾 Открыт официальный спор\n` +
      `Booking: ${bookingId}\n` +
      `Dispute: ${disputeId}\n` +
      (reasonText ? `Комментарий: ${reasonText}` : 'Комментарий: —') +
      (evidence.length ? `\nВложения: ${evidence.length} фото` : '')
    const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    await supabaseAdmin.from('messages').insert({
      id: msgId,
      conversation_id: finalConversationId,
      sender_id: actor,
      sender_role: 'SYSTEM',
      sender_name: `${getSiteDisplayName()} Support`,
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
      `\n<a href="${adminLink}">Open thread in admin</a>`,
  )

  const deadlineAt = computeDisputeDeadlineIso(now)
  const { data: bookingMini } = await supabaseAdmin
    .from('bookings')
    .select('id, renter_id, partner_id')
    .eq('id', bookingId)
    .maybeSingle()
  const [renterProfile, partnerProfile] = await Promise.all([
    getProfileSafe(bookingMini?.renter_id),
    getProfileSafe(bookingMini?.partner_id),
  ])
  await NotificationService.dispatch(NotificationEvents.DISPUTE_OPENED_SLA, {
    bookingId,
    disputeId,
    reason: reasonText || '',
    deadlineAt,
    conversationId: finalConversationId || null,
    renter: renterProfile
      ? {
          id: renterProfile.id,
          email: renterProfile.email || null,
          first_name: renterProfile.first_name || null,
          last_name: renterProfile.last_name || null,
          telegram_id: renterProfile.telegram_id || null,
        }
      : null,
    partner: partnerProfile
      ? {
          id: partnerProfile.id,
          email: partnerProfile.email || null,
          first_name: partnerProfile.first_name || null,
          last_name: partnerProfile.last_name || null,
          telegram_id: partnerProfile.telegram_id || null,
        }
      : null,
  })

  try {
    const { applyDisputePayoutFreeze } = await import('@/lib/services/dispute/dispute-payout-freeze.js')
    await applyDisputePayoutFreeze({
      bookingId,
      disputeId,
      partnerId: bookingMini?.partner_id,
    })
  } catch (e) {
    console.warn('[DISPUTE] applyDisputePayoutFreeze', disputeId, e?.message || e)
  }
}
