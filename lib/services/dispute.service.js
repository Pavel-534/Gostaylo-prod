import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service'
import { NotificationService } from '@/lib/services/notification.service'
import { getPublicSiteUrl } from '@/lib/site-url'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'
import { PARTNER_HELP_MEDIATION_MS } from '@/lib/config/partner-mediation'

const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN_REVIEW']
const MEDIATION_STATUS = 'PENDING_MEDIATION'
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

async function runDisputeOpenedSideEffects({
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

  const [actorProfile, counterpartyProfile] = await Promise.all([getProfileSafe(actor), getProfileSafe(counterpartyId)])

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
    evidenceUrls = [],
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

    const { data: pendingMed } = await supabaseAdmin
      .from('disputes')
      .select('id, status, metadata, created_at')
      .eq('booking_id', bookingId)
      .eq('status', MEDIATION_STATUS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nowIso = new Date().toISOString()
    const reasonText = trimReason(reason)
    const evidence = Array.isArray(evidenceUrls)
      ? evidenceUrls
          .map((u) => String(u || '').trim().slice(0, 800))
          .filter(Boolean)
          .filter((u) => u.startsWith('/_storage/') || u.startsWith('http'))
          .slice(0, 3)
      : []
    const finalConversationId = await getConversationIdForBooking(bookingId, conversationId)

    if (pendingMed?.id) {
      const unlockIso = pendingMed.metadata && pendingMed.metadata.mediation_unlock_at
      const unlockMs = unlockIso ? new Date(String(unlockIso)).getTime() : NaN
      const nowMs = Date.now()
      if (Number.isFinite(unlockMs) && nowMs < unlockMs) {
        const minutesLeft = Math.max(1, Math.ceil((unlockMs - nowMs) / 60000))
        return {
          success: false,
          code: 'MEDIATION_WINDOW_ACTIVE',
          error: 'Mediation window active',
          minutesLeft,
          unlockAt: String(unlockIso),
        }
      }

      const meta = pendingMed.metadata && typeof pendingMed.metadata === 'object' ? { ...pendingMed.metadata } : {}
      meta.upgraded_to_open_at = nowIso
      meta.evidence_urls = evidence.length ? evidence : meta.evidence_urls

      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'OPEN',
          freeze_payment: true,
          description: reasonText || pendingMed.description || '',
          category: String(category || 'general').slice(0, 64),
          updated_at: nowIso,
          metadata: meta,
          admin_action_flags: { freeze_payment: true, force_refund: false, add_penalty: false },
        })
        .eq('id', String(pendingMed.id))

      if (upErr) {
        return { success: false, code: 'DB_UPDATE_FAILED', error: upErr.message }
      }

      await runDisputeOpenedSideEffects({
        disputeId: String(pendingMed.id),
        bookingId,
        actor,
        counterpartyId,
        reasonText: reasonText || String(pendingMed.description || ''),
        evidence,
        finalConversationId,
        now: nowIso,
      })

      return {
        success: true,
        dispute: {
          id: String(pendingMed.id),
          booking_id: bookingId,
          conversation_id: finalConversationId,
          status: 'OPEN',
          freeze_payment: true,
        },
        upgradedFromMediation: true,
      }
    }

    const isRenterActor = String(booking.renter_id || '') === actor

    const { data: lastByActor } = await supabaseAdmin
      .from('disputes')
      .select('id, created_at, status')
      .eq('booking_id', bookingId)
      .eq('opened_by', actor)
      .neq('status', MEDIATION_STATUS)
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

    if (isRenterActor) {
      const disputeId = createDisputeId()
      const unlockAt = new Date(Date.now() + PARTNER_HELP_MEDIATION_MS).toISOString()
      const ins = {
        id: disputeId,
        booking_id: bookingId,
        conversation_id: finalConversationId,
        opened_by: actor,
        against_user_id: counterpartyId,
        category: String(category || 'general').slice(0, 64),
        reason_code: 'pre_mediation',
        description: reasonText || 'Mediation window (guest help flow)',
        status: MEDIATION_STATUS,
        freeze_payment: false,
        force_refund_requested: false,
        penalty_requested: false,
        admin_action_flags: { freeze_payment: false, force_refund: false, add_penalty: false },
        metadata: {
          source: 'unified_order_card',
          mediation_unlock_at: unlockAt,
          mediation_window_ms: PARTNER_HELP_MEDIATION_MS,
          ...(evidence.length ? { evidence_urls: evidence } : {}),
        },
        created_at: nowIso,
        updated_at: nowIso,
      }
      const { error: insErr } = await supabaseAdmin.from('disputes').insert(ins)
      if (insErr) {
        return { success: false, code: 'DB_INSERT_FAILED', error: insErr.message }
      }

      if (finalConversationId) {
        const body =
          `⏳ Окно медиации (${Math.round(PARTNER_HELP_MEDIATION_MS / 60000)} мин)\n` +
          `По заказу ${bookingId} начат мягкий этап: попробуйте решить вопрос в чате. Официальный спор и заморозка средств — после окончания окна.`
        const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        await supabaseAdmin.from('messages').insert({
          id: msgId,
          conversation_id: finalConversationId,
          sender_id: actor,
          sender_role: 'SYSTEM',
          sender_name: 'GoStayLo',
          message: body,
          content: body,
          type: 'system',
          metadata: { system_key: 'dispute_mediation_started', dispute_id: disputeId, booking_id: bookingId },
          is_read: false,
          created_at: nowIso,
        })
        await supabaseAdmin
          .from('conversations')
          .update({ updated_at: nowIso, last_message_at: nowIso })
          .eq('id', finalConversationId)
      }

      return {
        success: true,
        phase: 'PENDING_MEDIATION',
        unlockAt,
        dispute: {
          id: disputeId,
          booking_id: bookingId,
          conversation_id: finalConversationId,
          status: MEDIATION_STATUS,
          freeze_payment: false,
        },
      }
    }

    await supabaseAdmin
      .from('disputes')
      .update({
        status: 'CLOSED',
        freeze_payment: false,
        updated_at: nowIso,
        metadata: {
          closed_reason: 'superseded_non_renter_official_open',
          superseded_at: nowIso,
        },
      })
      .eq('booking_id', bookingId)
      .eq('status', MEDIATION_STATUS)

    const disputeId = createDisputeId()
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
        ...(evidence.length ? { evidence_urls: evidence } : {}),
      },
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { error: insErr } = await supabaseAdmin.from('disputes').insert(insertPayload)
    if (insErr) {
      return { success: false, code: 'DB_INSERT_FAILED', error: insErr.message }
    }

    await runDisputeOpenedSideEffects({
      disputeId,
      bookingId,
      actor,
      counterpartyId,
      reasonText,
      evidence,
      finalConversationId,
      now: nowIso,
    })

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

  /**
   * Stage 21.0 — PENDING_MEDIATION older than `maxAgeHours`: если гость писал в чат после старта медиации → OPEN + freeze;
   * иначе CLOSED (гость не подтвердил проблему активностью в треде).
   */
  static async processStaleMediationDisputes({ maxAgeHours = 24, limit = 50 } = {}) {
    const cutoffIso = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString()
    const { data: rows, error } = await supabaseAdmin
      .from('disputes')
      .select('id, booking_id, conversation_id, opened_by, created_at, metadata, description, category')
      .eq('status', MEDIATION_STATUS)
      .lt('created_at', cutoffIso)
      .limit(limit)

    if (error) {
      return { ok: false, error: error.message, opened: 0, closed: 0, scanned: 0 }
    }

    let opened = 0
    let closed = 0
    const details = []

    for (const row of rows || []) {
      const disputeId = String(row.id || '')
      const bookingId = String(row.booking_id || '')
      const openedBy = String(row.opened_by || '')
      const convId = row.conversation_id ? String(row.conversation_id) : ''
      const createdAt = row.created_at

      if (!disputeId || !bookingId || !openedBy) {
        details.push({ disputeId, skip: 'missing_ids' })
        continue
      }

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, partner_id, renter_id')
        .eq('id', bookingId)
        .maybeSingle()

      if (!booking?.partner_id) {
        details.push({ disputeId, skip: 'no_booking' })
        continue
      }

      const counterpartyId = String(booking.partner_id)

      let renterFollowUp = 0
      if (convId) {
        const { count, error: cErr } = await supabaseAdmin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .eq('sender_id', openedBy)
          .gt('created_at', createdAt)
        if (!cErr && count != null) renterFollowUp = count
      }

      const nowIso = new Date().toISOString()
      const baseMeta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      const category = String(row.category || 'booking_dispute').slice(0, 64)

      try {
        if (renterFollowUp > 0) {
          const meta = {
            ...baseMeta,
            auto_escalation: true,
            auto_escalated_at: nowIso,
            auto_escalation_reason: 'mediation_idle_guest_engaged_in_chat',
          }
          const desc =
            String(row.description || '').trim() ||
            'Mediation auto-escalation: guest continued the conversation in chat.'
          const { error: upErr } = await supabaseAdmin
            .from('disputes')
            .update({
              status: 'OPEN',
              freeze_payment: true,
              description: desc,
              category,
              updated_at: nowIso,
              metadata: meta,
              admin_action_flags: { freeze_payment: true, force_refund: false, add_penalty: false },
            })
            .eq('id', disputeId)
            .eq('status', MEDIATION_STATUS)

          if (upErr) {
            details.push({ disputeId, error: upErr.message })
            continue
          }

          await runDisputeOpenedSideEffects({
            disputeId,
            bookingId,
            actor: openedBy,
            counterpartyId,
            reasonText:
              'Авто-эскалация: >24 ч в медиации; гость писал в чат после начала медиации — требуется внимание администратора.',
            evidence: Array.isArray(baseMeta.evidence_urls) ? baseMeta.evidence_urls : [],
            finalConversationId: convId || null,
            now: nowIso,
          })
          opened += 1
          details.push({ disputeId, action: 'OPEN' })
        } else {
          const meta = {
            ...baseMeta,
            closed_reason: 'mediation_idle_no_guest_chat',
            closed_at: nowIso,
            auto_closed: true,
          }
          const { error: clErr } = await supabaseAdmin
            .from('disputes')
            .update({
              status: 'CLOSED',
              freeze_payment: false,
              updated_at: nowIso,
              metadata: meta,
            })
            .eq('id', disputeId)
            .eq('status', MEDIATION_STATUS)

          if (clErr) {
            details.push({ disputeId, error: clErr.message })
            continue
          }
          closed += 1
          details.push({ disputeId, action: 'CLOSED' })
        }
      } catch (e) {
        details.push({ disputeId, error: String(e?.message || e) })
      }
    }

    return {
      ok: true,
      scanned: (rows || []).length,
      opened,
      closed,
      details: details.length ? details : undefined,
    }
  }
}

export default DisputeService
