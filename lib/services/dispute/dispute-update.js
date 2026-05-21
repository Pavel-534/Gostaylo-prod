/**
 * Stage 109.2 — dispute updates (events, FSM, evidence, SLA crons).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NotificationEvents, NotificationService } from '@/lib/services/notification.service'
import {
  ACTIVE_DISPUTE_STATUSES,
  DISPUTE_EVIDENCE_BUCKET,
  DISPUTE_FSM,
  DISPUTE_SLA_HOURS,
  MEDIATION_STATUS,
  SLA_REMINDER_POINTS,
  computeDisputeDeadlineIso,
  extractDisputeEvidenceObjectPaths,
  getProfileSafe,
  trimReason,
} from '@/lib/services/dispute/dispute-shared.js'
import { finalizeDisputePaymentUnfreeze } from '@/lib/services/dispute/dispute-resolution.js'
import { runDisputeOpenedSideEffects } from '@/lib/services/dispute/dispute-notifications.js'

export async function appendDisputeEvent(disputeId, evt) {
const id = `dse-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const payload = {
      id,
      dispute_id: String(disputeId),
      event_type: String(evt.eventType || evt.event_type || 'NOTE').slice(0, 80),
      from_status: evt.fromStatus ?? evt.from_status ?? null,
      to_status: evt.toStatus ?? evt.to_status ?? null,
      actor_id: evt.actorId ?? evt.actor_id ?? null,
      actor_role: evt.actorRole ?? evt.actor_role ?? null,
      reason: trimReason(evt.reason ?? '', 4000),
      metadata: evt.metadata && typeof evt.metadata === 'object' ? evt.metadata : {},
      created_at: evt.createdAt || new Date().toISOString(),
    }
    const { error } = await supabaseAdmin.from('dispute_events').insert(payload)
    if (error) console.warn('[DISPUTE_EVENT]', disputeId, error.message)
}

export function actorRoleForBookingActor(booking, actorId) {
const a = String(actorId || '')
    if (!a) return 'USER'
    if (String(booking?.renter_id || '') === a) return 'RENTER'
    if (String(booking?.partner_id || '') === a) return 'PARTNER'
    return 'USER'
}

export function isTransitionAllowed(fromStatus, toStatus) {
const from = String(fromStatus || '').toUpperCase()
    const to = String(toStatus || '').toUpperCase()
    if (!from || !to) return false
    if (from === to) return true
    return DISPUTE_FSM[from]?.has(to) === true
}

export function resolveAdminWorkingStatus(currentStatus) {
const from = String(currentStatus || '').toUpperCase()
    if (from === 'OPEN' && isTransitionAllowed(from, 'IN_REVIEW')) {
      return 'IN_REVIEW'
    }
    return from
}

export async function getEvidenceSignedUrls(disputeId, opts = {}) {
const id = String(disputeId || '').trim()
    const expiresSeconds =
      typeof opts.expiresSeconds === 'number' && opts.expiresSeconds > 60 ? opts.expiresSeconds : 600
    if (!id) return { ok: false, error: 'Missing dispute id', items: [] }

    const { data: row, error } = await supabaseAdmin
      .from('disputes')
      .select('id, booking_id, metadata')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) {
      return { ok: false, error: error?.message || 'Dispute not found', items: [] }
    }

    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    const urls = Array.isArray(meta.evidence_urls) ? meta.evidence_urls : []
    const paths = extractDisputeEvidenceObjectPaths(urls)
    if (!paths.length) return { ok: true, items: [], bookingId: row.booking_id }

    const items = []
    for (const path of paths) {
      const { data, error: signErr } = await supabaseAdmin.storage
        .from(DISPUTE_EVIDENCE_BUCKET)
        .createSignedUrl(path, expiresSeconds)
      if (signErr || !data?.signedUrl) {
        items.push({
          path,
          signedUrl: null,
          error: signErr?.message || 'sign_failed',
        })
        continue
      }
      items.push({ path, signedUrl: data.signedUrl, expiresSeconds })
    }

    return { ok: true, items, bookingId: row.booking_id }
}

export async function getFrozenBookingIdSet(bookingIds) {
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

export async function processSlaBreaches({ limit = 200, now = new Date() } = {}) {
const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString()
    const nowMs = Date.parse(nowIso)
    const { data: rows, error } = await supabaseAdmin
      .from('disputes')
      .select(
        'id, booking_id, conversation_id, opened_by, against_user_id, status, current_deadline_at, metadata, description, freeze_payment',
      )
      .eq('status', 'OPEN')
      .not('current_deadline_at', 'is', null)
      .order('current_deadline_at', { ascending: true })
      .limit(limit)

    if (error) return { ok: false, error: error.message, scanned: 0, reminders: 0, resolved: 0 }

    let reminders = 0
    let resolved = 0
    let reminderErrors = 0
    let resolveErrors = 0

    for (const row of rows || []) {
      const deadlineIso = row.current_deadline_at ? String(row.current_deadline_at) : ''
      const deadlineMs = Date.parse(deadlineIso)
      if (!Number.isFinite(deadlineMs)) continue
      const meta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      const remainingMs = deadlineMs - nowMs

      // SLA breach: OPEN deadline elapsed -> auto RESOLVED
      if (remainingMs <= 0) {
        try {
          const resolutionReason = `SLA ${DISPUTE_SLA_HOURS}h истёк: автоматическое решение в пользу гостя (SYSTEM).`
          const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select('id, renter_id, partner_id')
            .eq('id', row.booking_id)
            .maybeSingle()
          const { error: upErr } = await supabaseAdmin
            .from('disputes')
            .update({
              status: 'RESOLVED',
              resolved_at: nowIso,
              closed_by: null,
              resolution_reason: resolutionReason,
              freeze_payment: false,
              current_deadline_at: null,
              metadata: {
                ...meta,
                sla_auto_resolved_at: nowIso,
                sla_auto_resolved: true,
              },
              updated_at: nowIso,
            })
            .eq('id', row.id)
            .eq('status', 'OPEN')
          if (upErr) throw upErr

          await appendDisputeEvent(row.id, {
            eventType: 'SLA_AUTO_RESOLVED',
            fromStatus: 'OPEN',
            toStatus: 'RESOLVED',
            actorRole: 'SYSTEM',
            reason: resolutionReason,
            metadata: { deadline_at: deadlineIso },
            createdAt: nowIso,
          })

          const [renterProfile, partnerProfile] = await Promise.all([
            getProfileSafe(booking?.renter_id),
            getProfileSafe(booking?.partner_id),
          ])
          await NotificationService.dispatch(NotificationEvents.DISPUTE_AUTO_RESOLVED, {
            bookingId: row.booking_id,
            disputeId: row.id,
            conversationId: row.conversation_id || null,
            resolutionReason,
            renter: renterProfile,
            partner: partnerProfile,
          })
          await finalizeDisputePaymentUnfreeze({
            bookingId: row.booking_id,
            disputeId: row.id,
            resolutionReason,
          })
          resolved += 1
        } catch (e) {
          resolveErrors += 1
          console.warn('[DISPUTE_SLA] resolve_failed', row.id, e?.message || e)
        }
        continue
      }

      // T-24h / T-2h reminders
      for (const point of SLA_REMINDER_POINTS) {
        const marker = `sla_reminder_${point.key}_sent_at`
        if (meta[marker]) continue
        if (remainingMs <= point.thresholdMs) {
          try {
            const { data: booking } = await supabaseAdmin
              .from('bookings')
              .select('id, renter_id, partner_id')
              .eq('id', row.booking_id)
              .maybeSingle()
            const [renterProfile, partnerProfile] = await Promise.all([
              getProfileSafe(booking?.renter_id),
              getProfileSafe(booking?.partner_id),
            ])
            await NotificationService.dispatch(NotificationEvents.DISPUTE_SLA_REMINDER, {
              bookingId: row.booking_id,
              disputeId: row.id,
              conversationId: row.conversation_id || null,
              deadlineAt: deadlineIso,
              hoursLeft: point.hoursLeft,
              renter: renterProfile,
              partner: partnerProfile,
            })
            const nextMeta = { ...meta, [marker]: nowIso }
            const { error: upMetaErr } = await supabaseAdmin
              .from('disputes')
              .update({ metadata: nextMeta, updated_at: nowIso })
              .eq('id', row.id)
              .eq('status', 'OPEN')
            if (upMetaErr) throw upMetaErr
            await appendDisputeEvent(row.id, {
              eventType: 'SLA_REMINDER',
              fromStatus: 'OPEN',
              toStatus: 'OPEN',
              actorRole: 'SYSTEM',
              reason: `Reminder at T-${point.hoursLeft}h`,
              metadata: { hours_left: point.hoursLeft, deadline_at: deadlineIso },
              createdAt: nowIso,
            })
            reminders += 1
          } catch (e) {
            reminderErrors += 1
            console.warn('[DISPUTE_SLA] reminder_failed', row.id, point.key, e?.message || e)
          }
        }
      }
    }

    return {
      ok: true,
      scanned: (rows || []).length,
      reminders,
      resolved,
      reminderErrors,
      resolveErrors,
      slaHours: DISPUTE_SLA_HOURS,
    }
}

export async function processStaleMediationDisputes({ maxAgeHours = 24, limit = 50 } = {}) {
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
              status: isTransitionAllowed(MEDIATION_STATUS, 'OPEN') ? 'OPEN' : MEDIATION_STATUS,
              current_deadline_at: computeDisputeDeadlineIso(nowIso),
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

          await appendDisputeEvent(disputeId, {
            eventType: 'AUTO_ESCALATION',
            fromStatus: MEDIATION_STATUS,
            toStatus: 'OPEN',
            actorRole: 'SYSTEM',
            reason: 'mediation_idle_guest_engaged_in_chat',
            metadata: { cron: 'processStaleMediationDisputes' },
          })
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
              status: isTransitionAllowed(MEDIATION_STATUS, 'CLOSED') ? 'CLOSED' : MEDIATION_STATUS,
              current_deadline_at: null,
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
          await appendDisputeEvent(disputeId, {
            eventType: 'AUTO_CLOSE_MEDIATION',
            fromStatus: MEDIATION_STATUS,
            toStatus: 'CLOSED',
            actorRole: 'SYSTEM',
            reason: 'mediation_idle_no_guest_chat',
            metadata: { cron: 'processStaleMediationDisputes' },
          })
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

