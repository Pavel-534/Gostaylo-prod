/**
 * Stage 141.3 — SSOT: attach dispute snapshot to booking rows (renter + partner APIs).
 */

import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'

const ACTIVE_STATUSES = new Set(['OPEN', 'IN_REVIEW', 'PENDING_MEDIATION'])
const STATUS_RANK = {
  OPEN: 4,
  IN_REVIEW: 3,
  PENDING_MEDIATION: 2,
  RESOLVED: 1,
  CLOSED: 1,
  REJECTED: 0,
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function disputeAmountThb(booking) {
  const camel = Number(booking?.guestPayableThb)
  if (Number.isFinite(camel) && camel > 0) return round2(camel)
  try {
    const g = getGuestPayableRoundedThb(booking)
    if (g > 0) return round2(g)
  } catch {
    /* fallback */
  }
  return round2(booking?.price_thb ?? booking?.priceThb ?? 0)
}

function pickDisputeForBooking(rows) {
  if (!rows?.length) return null
  const sorted = [...rows].sort((a, b) => {
    const ra = STATUS_RANK[String(a.status || '').toUpperCase()] ?? 0
    const rb = STATUS_RANK[String(b.status || '').toUpperCase()] ?? 0
    if (rb !== ra) return rb - ra
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  })
  return sorted[0]
}

function buildSnapshot(dispute, booking) {
  if (!dispute) return null
  const meta = dispute.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}
  const status = String(dispute.status || '').toUpperCase()
  return {
    id: dispute.id,
    status,
    reasonCode: dispute.reason_code ?? null,
    description: dispute.description ?? null,
    resolutionReason: dispute.resolution_reason ?? null,
    freezePayment: dispute.freeze_payment === true,
    currentDeadlineAt: dispute.current_deadline_at ?? null,
    mediationUnlockAt: meta.mediation_unlock_at ?? null,
    resolvedAt: dispute.resolved_at ?? null,
    amountThb: disputeAmountThb(booking),
    conversationId: dispute.conversation_id ?? booking?.conversation_id ?? booking?.conversationId ?? null,
    isActive: ACTIVE_STATUSES.has(status),
  }
}

function attachFields(booking, snapshot) {
  if (!snapshot) return booking
  const isActiveOpen = ['OPEN', 'IN_REVIEW'].includes(snapshot.status)
  return {
    ...booking,
    dispute_snapshot: snapshot,
    disputeSnapshot: snapshot,
    active_dispute: {
      id: snapshot.id,
      status: snapshot.status,
      current_deadline_at: snapshot.currentDeadlineAt,
    },
    active_dispute_id: isActiveOpen ? snapshot.id : booking.active_dispute_id ?? snapshot.id,
    active_dispute_status: snapshot.status,
    active_dispute_current_deadline_at: snapshot.currentDeadlineAt,
    activeDisputeId: snapshot.id,
    activeDisputeStatus: snapshot.status,
    activeDisputeCurrentDeadlineAt: snapshot.currentDeadlineAt,
    activeDispute: {
      id: snapshot.id,
      status: snapshot.status,
      currentDeadlineAt: snapshot.currentDeadlineAt,
    },
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {object[]} bookings
 */
export async function attachDisputeToBookings(admin, bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) return bookings || []
  if (!admin) return bookings

  const ids = [...new Set(bookings.map((b) => String(b?.id || '')).filter(Boolean))]
  if (!ids.length) return bookings

  const { data, error } = await admin
    .from('disputes')
    .select(
      'id, booking_id, conversation_id, status, reason_code, description, freeze_payment, metadata, current_deadline_at, resolution_reason, resolved_at, updated_at',
    )
    .in('booking_id', ids)
    .order('updated_at', { ascending: false })

  if (error) {
    console.warn('[attachDisputeToBookings]', error.message)
    return bookings
  }

  const byBooking = new Map()
  for (const row of data || []) {
    const bid = String(row.booking_id || '')
    if (!bid) continue
    if (!byBooking.has(bid)) byBooking.set(bid, [])
    byBooking.get(bid).push(row)
  }

  return bookings.map((b) => {
    const bid = String(b?.id || '')
    const snapshot = buildSnapshot(pickDisputeForBooking(byBooking.get(bid)), b)
    return attachFields(b, snapshot)
  })
}

/** @deprecated Use attachDisputeToBookings */
export async function attachActiveDisputeSla(admin, bookings) {
  return attachDisputeToBookings(admin, bookings)
}
