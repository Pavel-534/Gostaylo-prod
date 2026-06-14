import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import DisputeService from '@/lib/services/dispute.service'
import { computeDisputeDeadlineIso } from '@/lib/config/dispute-sla'
import {
  executeDisputeResolution,
  DisputeResolutionStrategy,
} from '@/lib/services/dispute/dispute-resolution-engine.js'
import { applyDisputePayoutFreeze } from '@/lib/services/dispute/dispute-payout-freeze.js'
import { MEDIATION_STATUS } from '@/lib/services/dispute/dispute-shared.js'

export const dynamic = 'force-dynamic'

async function fetchDisputeSnapshot(disputeId) {
  const { data } = await supabaseAdmin
    .from('disputes')
    .select(
      'id, booking_id, status, freeze_payment, force_refund_requested, penalty_requested, updated_at, resolved_at, closed_by, metadata, admin_action_flags, resolution_reason, current_deadline_at',
    )
    .eq('id', disputeId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    bookingId: data.booking_id,
    status: data.status,
    freezePayment: data.freeze_payment === true,
    forceRefundRequested: data.force_refund_requested === true,
    penaltyRequested: data.penalty_requested === true,
    updatedAt: data.updated_at,
    resolvedAt: data.resolved_at,
    closedBy: data.closed_by,
    metadata: data.metadata,
    adminActionFlags: data.admin_action_flags,
    resolutionReason: data.resolution_reason ?? null,
    currentDeadlineAt: data.current_deadline_at ?? null,
  }
}

const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED', 'REJECTED'])

export async function POST(request, { params }) {
  try {
    const access = await requireAdminStaff(request)
    if (access.error) return access.error
    const staff = { id: String(access.profile?.id || '') }

    const disputeId = String(params?.id || '').trim()
    if (!disputeId) {
      return NextResponse.json({ success: false, error: 'Dispute ID is required' }, { status: 400 })
    }

    const payload = await request.json().catch(() => null)
    const action = String(payload?.action || '').trim().toLowerCase()
    const reason = String(payload?.reason || '').trim().slice(0, 2000)
    const now = new Date().toISOString()

    const { data: dispute, error: fetchErr } = await supabaseAdmin
      .from('disputes')
      .select(
        'id, booking_id, against_user_id, admin_action_flags, freeze_payment, metadata, status, penalty_requested, conversation_id, current_deadline_at',
      )
      .eq('id', disputeId)
      .maybeSingle()
    if (fetchErr || !dispute) {
      return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 })
    }

    const isTerminal = TERMINAL_STATUSES.has(String(dispute.status || '').toUpperCase())
    if (isTerminal && ['freeze_payment', 'force_refund'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Dispute is already closed' }, { status: 400 })
    }

    const flags = {
      ...(dispute.admin_action_flags && typeof dispute.admin_action_flags === 'object'
        ? dispute.admin_action_flags
        : {}),
    }

    if (action === 'take_in_review') {
      const st = String(dispute.status || '').toUpperCase()
      if (st === 'IN_REVIEW') {
        const snap = await fetchDisputeSnapshot(disputeId)
        return NextResponse.json({ success: true, data: { disputeId, action: 'take_in_review', noop: true, dispute: snap } })
      }
      if (!DisputeService.isTransitionAllowed(dispute.status, 'IN_REVIEW')) {
        return NextResponse.json(
          { success: false, error: `Недопустимый переход ${String(dispute.status)} → IN_REVIEW (кейс в медиации или закрыт)` },
          { status: 400 },
        )
      }
      const fromSt = String(dispute.status || '')
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'IN_REVIEW',
          current_deadline_at: dispute.current_deadline_at || computeDisputeDeadlineIso(now),
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'STATUS_CHANGE',
        fromStatus: fromSt,
        toStatus: 'IN_REVIEW',
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: reason || '',
        metadata: { action: 'take_in_review' },
      })
      const snap = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({ success: true, data: { disputeId, action: 'take_in_review', dispute: snap } })
    }

    if (action === 'freeze_payment') {
      flags.freeze_payment = true
      const prevStatus = String(dispute.status || '')
      let nextStatus = DisputeService.resolveAdminWorkingStatus(dispute.status)
      if (prevStatus.toUpperCase() === MEDIATION_STATUS && DisputeService.isTransitionAllowed(prevStatus, 'OPEN')) {
        nextStatus = 'OPEN'
      }
      const metaFreeze = {
        ...(dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}),
        freeze_payment_reason: reason || null,
        freeze_payment_set_by: staff.id,
        freeze_payment_set_at: now,
      }
      if (prevStatus.toUpperCase() === MEDIATION_STATUS && nextStatus === 'OPEN') {
        metaFreeze.escalated_from_mediation_at = now
        metaFreeze.escalated_by_admin = staff.id
      }
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: nextStatus,
          current_deadline_at: dispute.current_deadline_at || computeDisputeDeadlineIso(now),
          freeze_payment: true,
          admin_action_flags: flags,
          metadata: metaFreeze,
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'ADMIN_FREEZE_PAYMENT',
        fromStatus: prevStatus,
        toStatus: nextStatus,
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: reason || '',
        metadata: {
          lever: 'freeze_payment',
          escalated_from_mediation: prevStatus.toUpperCase() === MEDIATION_STATUS,
        },
      })

      const { data: bookingMini } = await supabaseAdmin
        .from('bookings')
        .select('id, partner_id')
        .eq('id', dispute.booking_id)
        .maybeSingle()
      const freezeRes = await applyDisputePayoutFreeze({
        bookingId: String(dispute.booking_id || ''),
        disputeId,
        partnerId: bookingMini?.partner_id,
      })
      if (!freezeRes.success) {
        console.warn('[ADMIN DISPUTE] applyDisputePayoutFreeze', disputeId, freezeRes.error)
      }

      const snapFreeze = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: { disputeId, action: 'freeze_payment', dispute: snapFreeze, freezeApplied: freezeRes.success },
      })
    }

    if (action === 'force_refund') {
      flags.force_refund = true
      const prevStatusFr = String(dispute.status || '')
      const resolutionReason =
        reason || 'Администратор: принудительный возврат гостю (force_refund).'
      const bookingId = String(dispute.booking_id || '').trim()
      if (!bookingId) {
        return NextResponse.json({ success: false, error: 'Booking not found for dispute' }, { status: 404 })
      }

      const refundResult = await executeDisputeResolution({
        strategy: DisputeResolutionStrategy.REFUND_GUEST,
        bookingId,
        disputeId,
        resolutionReason,
        trigger: 'dispute_force_refund',
        actorId: staff.id,
        actorRole: 'ADMIN',
      })
      if (!refundResult.success) {
        return NextResponse.json(
          { success: false, error: refundResult.error || 'DISPUTE_FORCE_REFUND_FAILED' },
          { status: 500 },
        )
      }

      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'RESOLVED',
          resolved_at: now,
          closed_by: staff.id,
          current_deadline_at: null,
          freeze_payment: false,
          force_refund_requested: true,
          admin_action_flags: flags,
          resolution_reason: resolutionReason,
          metadata: {
            ...(dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}),
            force_refund_reason: reason || null,
            force_refund_requested_by: staff.id,
            force_refund_requested_at: now,
            force_refund_ledger: true,
          },
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) {
        return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      }

      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'ADMIN_FORCE_REFUND',
        fromStatus: prevStatusFr,
        toStatus: 'RESOLVED',
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: resolutionReason,
        metadata: {
          lever: 'force_refund',
          refund_guest_thb: refundResult.refundGuestThb,
        },
      })

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, renter_id, partner_id')
        .eq('id', bookingId)
        .maybeSingle()
      if (booking) {
        await DisputeService.notifyPartiesDisputeResolved({
          bookingId,
          resolutionReason,
          renterId: booking.renter_id,
          partnerId: booking.partner_id,
          conversationId: dispute.conversation_id || null,
        })
      }

      const snapFr = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: {
          disputeId,
          action: 'force_refund',
          dispute: snapFr,
          refundGuestThb: refundResult.refundGuestThb,
        },
      })
    }

    if (action === 'split') {
      const guestPercent = Number(payload?.guestPercent ?? payload?.guest_percent)
      const resolutionReason =
        reason || `Администратор: split ${guestPercent}% гостю / ${100 - guestPercent}% партнёру.`
      const bookingId = String(dispute.booking_id || '').trim()
      if (!bookingId) {
        return NextResponse.json({ success: false, error: 'Booking not found for dispute' }, { status: 404 })
      }

      const splitResult = await executeDisputeResolution({
        strategy: DisputeResolutionStrategy.SPLIT,
        bookingId,
        disputeId,
        resolutionReason,
        guestPercent,
        trigger: 'dispute_admin_split',
        actorId: staff.id,
        actorRole: 'ADMIN',
      })
      if (!splitResult.success) {
        return NextResponse.json(
          { success: false, error: splitResult.error || 'DISPUTE_SPLIT_FAILED' },
          { status: 500 },
        )
      }

      const prevStatusSplit = String(dispute.status || '')
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'RESOLVED',
          resolved_at: now,
          closed_by: staff.id,
          current_deadline_at: null,
          freeze_payment: false,
          admin_action_flags: {
            ...(dispute.admin_action_flags && typeof dispute.admin_action_flags === 'object'
              ? dispute.admin_action_flags
              : {}),
            split_resolved: true,
          },
          resolution_reason: resolutionReason,
          metadata: {
            ...(dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}),
            split_guest_percent: splitResult.guestPercent,
            split_refund_guest_thb: splitResult.refundGuestThb,
            split_partner_release_thb: splitResult.partnerReleaseThb,
            split_resolved_by: staff.id,
            split_resolved_at: now,
          },
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })

      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'ADMIN_SPLIT_RESOLVED',
        fromStatus: prevStatusSplit,
        toStatus: 'RESOLVED',
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: resolutionReason,
        metadata: {
          guest_percent: splitResult.guestPercent,
          refund_guest_thb: splitResult.refundGuestThb,
          partner_release_thb: splitResult.partnerReleaseThb,
        },
      })

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, renter_id, partner_id')
        .eq('id', bookingId)
        .maybeSingle()
      if (booking) {
        await DisputeService.notifyPartiesDisputeResolved({
          bookingId,
          resolutionReason,
          renterId: booking.renter_id,
          partnerId: booking.partner_id,
          conversationId: dispute.conversation_id || null,
        })
      }

      const snapSplit = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: {
          disputeId,
          action: 'split',
          dispute: snapSplit,
          guestPercent: splitResult.guestPercent,
          refundGuestThb: splitResult.refundGuestThb,
          partnerReleaseThb: splitResult.partnerReleaseThb,
        },
      })
    }

    if (action === 'add_penalty') {
      const targetUserId = String(payload?.targetUserId || dispute.against_user_id || '').trim()
      if (!targetUserId) {
        return NextResponse.json({ success: false, error: 'targetUserId is required' }, { status: 400 })
      }
      const points = Number.isFinite(Number(payload?.points)) ? Math.max(1, Number(payload.points)) : 1
      const penaltyType = String(payload?.penaltyType || 'warning').trim().slice(0, 40)
      const penaltyId = `dpn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

      const { error: penErr } = await supabaseAdmin.from('dispute_penalties').insert({
        id: penaltyId,
        dispute_id: disputeId,
        target_user_id: targetUserId,
        issued_by: staff.id,
        penalty_type: penaltyType,
        points,
        reason: reason || '',
        metadata: { source: 'admin_dispute_action' },
        created_at: now,
      })
      if (penErr) {
        return NextResponse.json({ success: false, error: penErr.message }, { status: 500 })
      }

      flags.add_penalty = true
      const prevPenaltyStatus = String(dispute.status || '')
      const nextPenaltyStatus = DisputeService.resolveAdminWorkingStatus(dispute.status)
      await supabaseAdmin
        .from('disputes')
        .update({
          status: nextPenaltyStatus,
          current_deadline_at: dispute.current_deadline_at || computeDisputeDeadlineIso(now),
          penalty_requested: true,
          admin_action_flags: flags,
          updated_at: now,
        })
        .eq('id', disputeId)

      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'ADMIN_PENALTY',
        fromStatus: prevPenaltyStatus,
        toStatus: nextPenaltyStatus,
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: reason || `penalty issued to ${targetUserId}`,
        metadata: { penaltyId, targetUserId, points, penaltyType },
      })
      const disputeSnap = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: { disputeId, action: 'add_penalty', penaltyId, targetUserId, points, dispute: disputeSnap },
      })
    }

    if (action === 'close_dispute') {
      if (TERMINAL_STATUSES.has(String(dispute.status || '').toUpperCase())) {
        return NextResponse.json({ success: false, error: 'Dispute is already closed' }, { status: 400 })
      }
      if (!DisputeService.isTransitionAllowed(dispute.status, 'CLOSED')) {
        return NextResponse.json(
          { success: false, error: `Transition ${String(dispute.status)} -> CLOSED is forbidden by FSM` },
          { status: 400 },
        )
      }

      const guiltyParty = String(payload?.guiltyParty || payload?.guilty_party || 'none')
        .trim()
        .toLowerCase()
      const strategyRaw = String(payload?.resolutionStrategy || payload?.resolution_strategy || '')
        .trim()
        .toUpperCase()
      const verdictRaw = reason || String(payload?.verdict || '').trim().slice(0, 2000)
      const verdict = verdictRaw.trim()

      const bookingId = String(dispute.booking_id || '').trim()
      let resolutionStrategy = DisputeResolutionStrategy.DISMISS
      if (Object.values(DisputeResolutionStrategy).includes(strategyRaw)) {
        resolutionStrategy = strategyRaw
      } else if (guiltyParty === 'partner') {
        resolutionStrategy = DisputeResolutionStrategy.PAYOUT_PARTNER
      } else if (guiltyParty === 'renter') {
        resolutionStrategy = DisputeResolutionStrategy.REFUND_GUEST
      }

      const execArgs = {
        strategy: resolutionStrategy,
        bookingId,
        disputeId,
        resolutionReason: verdict || 'Dispute closed by admin',
        trigger: 'dispute_close_dispute',
        actorId: staff.id,
        actorRole: 'ADMIN',
      }
      if (resolutionStrategy === DisputeResolutionStrategy.SPLIT) {
        execArgs.guestPercent = Number(payload?.guestPercent ?? payload?.guest_percent ?? 50)
      }

      const financialResult = await executeDisputeResolution(execArgs)
      if (!financialResult.success) {
        return NextResponse.json(
          { success: false, error: financialResult.error || 'DISPUTE_CLOSE_FINANCIAL_FAILED' },
          { status: 500 },
        )
      }

      const { data: booking, error: bErr } = await supabaseAdmin
        .from('bookings')
        .select('id, renter_id, partner_id')
        .eq('id', dispute.booking_id)
        .maybeSingle()
      if (bErr || !booking) {
        return NextResponse.json({ success: false, error: 'Booking not found for dispute' }, { status: 404 })
      }

      let targetUserId = ''
      if (guiltyParty === 'renter') targetUserId = String(booking.renter_id || '').trim()
      if (guiltyParty === 'partner') targetUserId = String(booking.partner_id || '').trim()

      let penaltyId = null
      if (targetUserId) {
        const points = Number.isFinite(Number(payload?.points)) ? Math.max(1, Number(payload.points)) : 1
        const penaltyType = String(payload?.penaltyType || 'dispute_resolution').trim().slice(0, 40) || 'dispute_resolution'
        penaltyId = `dpn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const { error: penErr } = await supabaseAdmin.from('dispute_penalties').insert({
          id: penaltyId,
          dispute_id: disputeId,
          target_user_id: targetUserId,
          issued_by: staff.id,
          penalty_type: penaltyType,
          points,
          reason: verdict || 'Dispute closed with penalty',
          metadata: { source: 'admin_close_dispute', guilty_party: guiltyParty },
          created_at: now,
        })
        if (penErr) {
          return NextResponse.json({ success: false, error: penErr.message }, { status: 500 })
        }
      }

      const flags = {
        ...(dispute.admin_action_flags && typeof dispute.admin_action_flags === 'object'
          ? dispute.admin_action_flags
          : {}),
      }
      if (targetUserId) flags.add_penalty = true

      const metaBase = dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}
      const prevClose = String(dispute.status || '')
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'CLOSED',
          resolved_at: now,
          closed_by: staff.id,
          resolution_reason: verdict || null,
          current_deadline_at: null,
          freeze_payment: false,
          penalty_requested: !!targetUserId || dispute.penalty_requested,
          admin_action_flags: flags,
          metadata: {
            ...metaBase,
            admin_verdict: verdict || null,
            guilty_party: guiltyParty,
            closed_by_staff: staff.id,
            closed_at: now,
          },
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })

      await DisputeService.appendDisputeEvent(disputeId, {
        eventType: 'DISPUTE_CLOSED',
        fromStatus: prevClose,
        toStatus: 'CLOSED',
        actorId: staff.id,
        actorRole: 'ADMIN',
        reason: verdict,
        metadata: { guilty_party: guiltyParty, resolution_strategy: resolutionStrategy },
      })

      await DisputeService.notifyPartiesDisputeResolved({
        bookingId: dispute.booking_id,
        resolutionReason: verdict,
        renterId: booking.renter_id,
        partnerId: booking.partner_id,
        conversationId: dispute.conversation_id || null,
      })

      const disputeSnap = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: {
          disputeId,
          action: 'close_dispute',
          penaltyId,
          guiltyParty,
          resolutionStrategy,
          guestPercent: financialResult.guestPercent ?? null,
          refundGuestThb: financialResult.refundGuestThb,
          partnerReleaseThb: financialResult.partnerReleaseThb,
          dispute: disputeSnap,
        },
      })
    }

    return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 })
  } catch (error) {
    console.error('[ADMIN DISPUTE ACTION]', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 })
  }
}
