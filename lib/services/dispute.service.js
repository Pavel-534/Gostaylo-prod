import { supabaseAdmin } from '@/lib/supabase'
import { PushService } from '@/lib/services/push.service'
import { NotificationEvents, NotificationService } from '@/lib/services/notification.service'
import { getPublicSiteUrl, getSiteDisplayName } from '@/lib/site-url'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'
import { PARTNER_HELP_MEDIATION_MS } from '@/lib/config/partner-mediation'
import { DISPUTE_SLA_HOURS, computeDisputeDeadlineIso } from '@/lib/config/dispute-sla'

/** Supabase bucket for dispute uploads (paths: `booking-{bookingId}/...`). */
const DISPUTE_EVIDENCE_BUCKET = 'dispute-evidence'

/**
 * Parse stored evidence URL / path values into object keys within `dispute-evidence`.
 * @param {unknown} evidenceUrls
 * @returns {string[]}
 */
export function extractDisputeEvidenceObjectPaths(evidenceUrls) {
  const paths = new Set()
  const rows = Array.isArray(evidenceUrls) ? evidenceUrls : []
  for (const entry of rows) {
    const s = String(entry || '').trim()
    if (!s) continue
    const base = s.split('?')[0].split('#')[0]
    const mProxy = base.match(/^\/?_storage\/dispute-evidence\/(.+)$/i)
    if (mProxy) {
      paths.add(mProxy[1].replace(/^\/+/, ''))
      continue
    }
    const mObj = base.match(/\/storage\/v1\/object\/(?:public|sign)\/dispute-evidence\/(.+)$/i)
    if (mObj) {
      try {
        paths.add(decodeURIComponent(mObj[1].replace(/^\/+/, '')))
      } catch {
        paths.add(mObj[1].replace(/^\/+/, ''))
      }
      continue
    }
    if (/^booking-[^/]+\/.+/i.test(base)) paths.add(base.replace(/^\/+/, ''))
  }
  return [...paths]
}

const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN_REVIEW']
const MEDIATION_STATUS = 'PENDING_MEDIATION'
const RECENT_DISPUTE_COOLDOWN_MS = 6 * 60 * 60 * 1000
const SLA_REMINDER_POINTS = Object.freeze([
  { key: '24h', hoursLeft: 24, thresholdMs: 24 * 60 * 60 * 1000 },
  { key: '2h', hoursLeft: 2, thresholdMs: 2 * 60 * 60 * 1000 },
])
const DISPUTE_FSM = Object.freeze({
  PENDING_MEDIATION: new Set(['OPEN', 'CLOSED']),
  OPEN: new Set(['IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED']),
  IN_REVIEW: new Set(['RESOLVED', 'REJECTED', 'CLOSED']),
  RESOLVED: new Set([]),
  REJECTED: new Set([]),
  CLOSED: new Set([]),
})

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
    .select('id, first_name, last_name, email, role, language, telegram_id')
    .eq('id', userId)
    .maybeSingle()
  return data || null
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

export class DisputeService {
  static ACTIVE_DISPUTE_STATUSES = ACTIVE_DISPUTE_STATUSES
  static DISPUTE_FSM = DISPUTE_FSM

  /**
   * Unfreeze partner payout + ledger release after dispute terminal resolution (Stage 99).
   */
  static async finalizeDisputePaymentUnfreeze({ bookingId, disputeId, resolutionReason }) {
    const { releaseDisputePayoutFreeze } = await import('@/lib/services/dispute/dispute-payout-freeze.js')
    return releaseDisputePayoutFreeze({ bookingId, disputeId, resolutionReason })
  }

  /** Журнал событий для админ-таймлайна (таблица `dispute_events`). */
  static async appendDisputeEvent(disputeId, evt) {
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

  static actorRoleForBookingActor(booking, actorId) {
    const a = String(actorId || '')
    if (!a) return 'USER'
    if (String(booking?.renter_id || '') === a) return 'RENTER'
    if (String(booking?.partner_id || '') === a) return 'PARTNER'
    return 'USER'
  }

  /** Пуш + email гостю и партнёру после закрытия дела (поле `resolution_reason`). */
  static async notifyPartiesDisputeResolved({ bookingId, resolutionReason, renterId, partnerId, conversationId }) {
    const bid = String(bookingId || '').trim()
    const rid = String(renterId || '').trim()
    const pid = String(partnerId || '').trim()
    const summaryPush = trimReason(resolutionReason, 200) || '—'
    const conv = conversationId ? String(conversationId).trim() : ''
    const linkForUser = (uid) => {
      if (conv) return `/messages/${encodeURIComponent(conv)}`
      if (String(uid) === rid) return `/renter/bookings?booking=${encodeURIComponent(bid)}`
      return `/partner/bookings?booking=${encodeURIComponent(bid)}`
    }
    const bodyEmail = trimReason(resolutionReason, 2000) || '—'
    const sendPush = async (uid) => {
      if (!uid) return
      await PushService.sendToUser(uid, 'DISPUTE_RESOLVED', {
        bookingId: bid,
        summary: summaryPush,
        link: linkForUser(uid),
      })
    }
    await sendPush(rid)
    await sendPush(pid)

    const sendMail = async (profile) => {
      if (!profile?.email || !bid) return
      const lang = profile.language || 'ru'
      const isRu = lang !== 'en'
      if (isRu) {
        await NotificationService.sendEmail(
          profile.email,
          `Спор по заказу #${bid} закрыт`,
          `Арбитраж по заказу #${bid} завершён.\n\nРешение поддержки:\n${bodyEmail}\n\n— ${getSiteDisplayName()}`,
        )
      } else {
        await NotificationService.sendEmail(
          profile.email,
          `Dispute closed — booking #${bid}`,
          `The dispute for booking #${bid} has been closed.\n\nResolution:\n${bodyEmail}\n\n— ${getSiteDisplayName()}`,
        )
      }
    }
    const [rProf, pProf] = await Promise.all([getProfileSafe(rid), getProfileSafe(pid)])
    await sendMail(rProf)
    await sendMail(pProf)
  }

  static isTransitionAllowed(fromStatus, toStatus) {
    const from = String(fromStatus || '').toUpperCase()
    const to = String(toStatus || '').toUpperCase()
    if (!from || !to) return false
    if (from === to) return true
    return DISPUTE_FSM[from]?.has(to) === true
  }

  static resolveAdminWorkingStatus(currentStatus) {
    const from = String(currentStatus || '').toUpperCase()
    if (from === 'OPEN' && this.isTransitionAllowed(from, 'IN_REVIEW')) {
      return 'IN_REVIEW'
    }
    return from
  }

  /**
   * Signed URLs for dispute evidence (private bucket); use in admin / server-rendered previews.
   * @param {string} disputeId
   * @param {{ expiresSeconds?: number }} [opts]
   */
  static async getEvidenceSignedUrls(disputeId, opts = {}) {
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

      if (!this.isTransitionAllowed(pendingMed.status, 'OPEN')) {
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
      const actorRoleUpgrade = DisputeService.actorRoleForBookingActor(booking, actor)
      await DisputeService.appendDisputeEvent(medId, {
        eventType: 'STATUS_CHANGE',
        fromStatus: MEDIATION_STATUS,
        toStatus: 'OPEN',
        actorId: actor,
        actorRole: actorRoleUpgrade,
        reason: reasonText || String(pendingMed.description || ''),
      })
      if (evidence.length) {
        await DisputeService.appendDisputeEvent(medId, {
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

      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'MEDIATION_STARTED',
        toStatus: MEDIATION_STATUS,
        actorId: actor,
        actorRole: 'RENTER',
        reason: reasonText,
        metadata: { evidence_count: evidence.length },
      })
      if (evidence.length) {
        await DisputeService.appendDisputeEvent(disputeId, {
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
        const body =
          `⏳ Окно медиации (${Math.round(PARTNER_HELP_MEDIATION_MS / 60000)} мин)\n` +
          `По заказу ${bookingId} начат мягкий этап: попробуйте решить вопрос в чате. Официальный спор и заморозка средств — после окончания окна.`
        const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        await supabaseAdmin.from('messages').insert({
          id: msgId,
          conversation_id: finalConversationId,
          sender_id: actor,
          sender_role: 'SYSTEM',
          sender_name: getSiteDisplayName(),
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

    const openerRole = DisputeService.actorRoleForBookingActor(booking, actor)
    await DisputeService.appendDisputeEvent(disputeId, {
      eventType: 'DISPUTE_OPENED',
      toStatus: 'OPEN',
      actorId: actor,
      actorRole: openerRole,
      reason: reasonText,
      metadata: { source: 'unified_order_card' },
    })
    if (evidence.length) {
      await DisputeService.appendDisputeEvent(disputeId, {
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

  /**
   * Humane SLA monitor:
   * - reminders for OPEN disputes at T-24h and T-2h
   * - auto-resolve overdue OPEN disputes (RESOLVED in renter favor)
   */
  static async processSlaBreaches({ limit = 200, now = new Date() } = {}) {
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

          await this.appendDisputeEvent(row.id, {
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
          await DisputeService.finalizeDisputePaymentUnfreeze({
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
            await this.appendDisputeEvent(row.id, {
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
              status: this.isTransitionAllowed(MEDIATION_STATUS, 'OPEN') ? 'OPEN' : MEDIATION_STATUS,
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

          await DisputeService.appendDisputeEvent(disputeId, {
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
              status: this.isTransitionAllowed(MEDIATION_STATUS, 'CLOSED') ? 'CLOSED' : MEDIATION_STATUS,
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
          await DisputeService.appendDisputeEvent(disputeId, {
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
}

export default DisputeService
