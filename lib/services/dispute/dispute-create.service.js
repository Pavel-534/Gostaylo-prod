/**
 * Stage 109.2 — create official dispute / mediation flow.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { getSiteDisplayName } from '@/lib/site-url'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'
import { PARTNER_HELP_MEDIATION_MS } from '@/lib/config/partner-mediation'
import {
  buildDisputeMediationStartedChatPayload,
  formatChatAnnouncementContent,
} from '@/lib/booking-chat-copy.js'
import {
  ACTIVE_DISPUTE_STATUSES,
  MEDIATION_STATUS,
  RECENT_DISPUTE_COOLDOWN_MS,
  computeDisputeDeadlineIso,
  createDisputeId,
  getConversationIdForBooking,
  resolveCounterparty,
  trimReason,
} from '@/lib/services/dispute/dispute-shared.js'
import {
  appendDisputeEvent,
  actorRoleForBookingActor,
  isTransitionAllowed,
} from '@/lib/services/dispute/dispute-update.js'
import { runDisputeOpenedSideEffects } from '@/lib/services/dispute/dispute-notifications.js'

export async function createOfficialDispute({
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
          .filter(
            (u) =>
              u.startsWith('/_storage/') ||
              u.startsWith('/api/v2/disputes/evidence') ||
              u.startsWith('http'),
          )
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

      if (!isTransitionAllowed(pendingMed.status, 'OPEN')) {
        return {
          success: false,
          code: 'FSM_REJECTED',
          error: `Invalid transition ${String(pendingMed.status)} -> OPEN`,
        }
      }
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'OPEN',
          current_deadline_at: computeDisputeDeadlineIso(nowIso),
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

      const medId = String(pendingMed.id)
      const actorRoleUpgrade = actorRoleForBookingActor(booking, actor)
      await appendDisputeEvent(medId, {
        eventType: 'STATUS_CHANGE',
        fromStatus: MEDIATION_STATUS,
        toStatus: 'OPEN',
        actorId: actor,
        actorRole: actorRoleUpgrade,
        reason: reasonText || String(pendingMed.description || ''),
      })
      if (evidence.length) {
        await appendDisputeEvent(medId, {
          eventType: 'EVIDENCE_SUBMITTED',
          fromStatus: 'OPEN',
          toStatus: 'OPEN',
          actorId: actor,
          actorRole: actorRoleUpgrade,
          reason: '',
          metadata: { count: evidence.length, context: 'escalated_from_mediation' },
        })
      }

      await runDisputeOpenedSideEffects({
        disputeId: medId,
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
          id: medId,
          booking_id: bookingId,
          conversation_id: finalConversationId,
          status: 'OPEN',
          freeze_payment: true,
          current_deadline_at: computeDisputeDeadlineIso(nowIso),
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
        current_deadline_at: computeDisputeDeadlineIso(nowIso),
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

      await appendDisputeEvent(disputeId, {
        eventType: 'MEDIATION_STARTED',
        toStatus: MEDIATION_STATUS,
        actorId: actor,
        actorRole: 'RENTER',
        reason: reasonText,
        metadata: { evidence_count: evidence.length },
      })
      if (evidence.length) {
        await appendDisputeEvent(disputeId, {
          eventType: 'EVIDENCE_SUBMITTED',
          fromStatus: MEDIATION_STATUS,
          toStatus: MEDIATION_STATUS,
          actorId: actor,
          actorRole: 'RENTER',
          reason: '',
          metadata: { count: evidence.length },
        })
      }

      if (finalConversationId) {
        const mediationMinutes = Math.round(PARTNER_HELP_MEDIATION_MS / 60000)
        const payload = buildDisputeMediationStartedChatPayload({
          disputeId,
          bookingId,
          mediationMinutes,
        })
        const content = formatChatAnnouncementContent(payload)
        const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        await supabaseAdmin.from('messages').insert({
          id: msgId,
          conversation_id: finalConversationId,
          sender_id: actor,
          sender_role: 'SYSTEM',
          sender_name: getSiteDisplayName(),
          message: content,
          content,
          type: 'system',
          metadata: payload,
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
          current_deadline_at: computeDisputeDeadlineIso(nowIso),
        },
      }
    }

    await supabaseAdmin
      .from('disputes')
      .update({
        status: 'CLOSED',
        current_deadline_at: null,
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
      current_deadline_at: computeDisputeDeadlineIso(nowIso),
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

    const openerRole = actorRoleForBookingActor(booking, actor)
    await appendDisputeEvent(disputeId, {
      eventType: 'DISPUTE_OPENED',
      toStatus: 'OPEN',
      actorId: actor,
      actorRole: openerRole,
      reason: reasonText,
      metadata: { source: 'unified_order_card' },
    })
    if (evidence.length) {
      await appendDisputeEvent(disputeId, {
        eventType: 'EVIDENCE_SUBMITTED',
        fromStatus: 'OPEN',
        toStatus: 'OPEN',
        actorId: actor,
        actorRole: openerRole,
        reason: '',
        metadata: { count: evidence.length },
      })
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
        current_deadline_at: computeDisputeDeadlineIso(nowIso),
      },
    }
}

