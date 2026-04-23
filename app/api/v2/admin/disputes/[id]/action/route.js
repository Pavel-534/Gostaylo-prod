import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function verifyStaff(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()
  const role = String(data?.role || '').toUpperCase()
  if (!data?.id || !['ADMIN', 'MODERATOR'].includes(role)) return null
  return { id: String(data.id), role }
}

async function fetchDisputeSnapshot(disputeId) {
  const { data } = await supabaseAdmin
    .from('disputes')
    .select(
      'id, booking_id, status, freeze_payment, force_refund_requested, penalty_requested, updated_at, resolved_at, closed_by, metadata, admin_action_flags',
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
  }
}

const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED', 'REJECTED'])

export async function POST(request, { params }) {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const staff = await verifyStaff(session.userId)
    if (!staff) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

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
        'id, booking_id, against_user_id, admin_action_flags, freeze_payment, metadata, status, penalty_requested',
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

    if (action === 'freeze_payment') {
      flags.freeze_payment = true
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          freeze_payment: true,
          admin_action_flags: flags,
          metadata: {
            ...(dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}),
            freeze_payment_reason: reason || null,
            freeze_payment_set_by: staff.id,
            freeze_payment_set_at: now,
          },
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      const dispute = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({ success: true, data: { disputeId, action: 'freeze_payment', dispute } })
    }

    if (action === 'force_refund') {
      flags.force_refund = true
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          force_refund_requested: true,
          admin_action_flags: flags,
          metadata: {
            ...(dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}),
            force_refund_reason: reason || null,
            force_refund_requested_by: staff.id,
            force_refund_requested_at: now,
          },
          updated_at: now,
        })
        .eq('id', disputeId)
      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 })
      const dispute = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({ success: true, data: { disputeId, action: 'force_refund', dispute } })
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
      await supabaseAdmin
        .from('disputes')
        .update({
          penalty_requested: true,
          admin_action_flags: flags,
          updated_at: now,
        })
        .eq('id', disputeId)

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

      const guiltyParty = String(payload?.guiltyParty || payload?.guilty_party || 'none')
        .trim()
        .toLowerCase()
      const verdict = reason || String(payload?.verdict || '').trim().slice(0, 2000)

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
      const { error: upErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'CLOSED',
          resolved_at: now,
          closed_by: staff.id,
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

      const disputeSnap = await fetchDisputeSnapshot(disputeId)
      return NextResponse.json({
        success: true,
        data: {
          disputeId,
          action: 'close_dispute',
          penaltyId,
          guiltyParty,
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
