/**
 * Stage 119.1 — SSOT: referral accrual / revert при смене статуса брони и закрытии диспута.
 * Единственная точка вызова из BookingService, cancel API, partner API, cron, dispute.
 */
import { supabaseAdmin } from '@/lib/supabase'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service.js'
import { maybeNotifyReferralFriendCancelled } from '@/lib/services/marketing/referral-friend-notify-triggers.js'

/** Статусы, при переходе в которые откатываем referral (pending + earned clawback + promo tank). */
export const BOOKING_STATUSES_REVERT_REFERRAL = Object.freeze(['CANCELLED', 'REFUNDED'])
const BOOKING_STATUSES_NOTIFY_FRIEND_CANCELLED = Object.freeze([
  'CANCELLED',
  'CANCELED',
  'CANCELLED_DEFICIT',
  'CANCELED_DEFICIT',
])

/** Статус, при переходе в который начисляем referral. */
export const BOOKING_STATUS_EARN_REFERRAL = 'COMPLETED'

function normalizeBookingStatus(status) {
  return String(status || '')
    .trim()
    .toUpperCase()
}

/** @internal Stage 119.1 — начисление при COMPLETED (не вызывать снаружи — только через onBookingStatusTransition). */
export async function runReferralCompletionPayout(bookingId, options = {}) {
  const id = String(bookingId || '').trim()
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }
  const trigger = String(options?.trigger || 'booking_completed')

  let distribute = null
  let hostActivation = null
  try {
    distribute = await ReferralPnlService.distribute(id, { trigger })
    if (distribute?.success !== true && distribute?.error) {
      console.warn('[REFERRAL] distribute failed:', distribute.error)
    }
  } catch (e) {
    console.error('[REFERRAL] distribute', e)
    distribute = { success: false, error: e?.message || String(e) }
  }
  try {
    hostActivation = await ReferralPnlService.distributeHostPartnerActivation(id)
    if (hostActivation?.success !== true && hostActivation?.error) {
      console.warn('[REFERRAL] host activation failed:', hostActivation.error)
    }
  } catch (e) {
    console.error('[REFERRAL] host activation', e)
    hostActivation = { success: false, error: e?.message || String(e) }
  }
  return { success: true, distribute, hostActivation }
}

/**
 * @param {{
 *   bookingId: string,
 *   previousStatus?: string|null,
 *   newStatus: string,
 *   trigger?: string,
 *   metadata?: Record<string, unknown>,
 * }} params
 */
export async function onBookingStatusTransition({
  bookingId,
  previousStatus,
  newStatus,
  trigger = 'booking_status_change',
  metadata = {},
}) {
  const bid = String(bookingId || '').trim()
  if (!bid) return { success: false, error: 'BOOKING_ID_REQUIRED' }

  const prev = normalizeBookingStatus(previousStatus)
  const next = normalizeBookingStatus(newStatus)
  if (!next || prev === next) {
    return { success: true, skipped: true, reason: 'NO_STATUS_CHANGE', bookingId: bid }
  }

  const out = {
    success: true,
    bookingId: bid,
    previousStatus: prev,
    newStatus: next,
    trigger,
    completion: null,
    revert: null,
  }

  if (next === BOOKING_STATUS_EARN_REFERRAL && prev !== BOOKING_STATUS_EARN_REFERRAL) {
    try {
      out.completion = await runReferralCompletionPayout(bid, { trigger, ...metadata })
    } catch (e) {
      console.error('[REFERRAL_LIFECYCLE] completion failed', bid, e)
      out.completion = { success: false, error: e?.message || String(e) }
    }
  }

  if (BOOKING_STATUSES_REVERT_REFERRAL.includes(next)) {
    try {
      out.revert = await ReferralPnlService.revertReferralLedgerForBooking(bid, {
        trigger,
        previousStatus: prev,
        newStatus: next,
        ...metadata,
      })
      if (out.revert?.clawback?.failureCount > 0) {
        console.warn('[REFERRAL_LIFECYCLE] clawback partial failures', bid, out.revert.clawback.failures)
      }
    } catch (e) {
      console.error('[REFERRAL_LIFECYCLE] revert failed', bid, e)
      out.revert = { success: false, error: e?.message || String(e) }
      out.success = false
    }
  }

  if (BOOKING_STATUSES_NOTIFY_FRIEND_CANCELLED.includes(next)) {
    try {
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id,renter_id,cancellation_reason,listing:listings(title)')
        .eq('id', bid)
        .maybeSingle()
      if (booking?.id && booking?.renter_id) {
        void maybeNotifyReferralFriendCancelled({
          bookingId: bid,
          renterId: String(booking.renter_id),
          listingTitle: String(booking?.listing?.title || ''),
          cancelReason: String(booking?.cancellation_reason || metadata?.cancelReason || ''),
        })
      }
    } catch (e) {
      console.warn('[REFERRAL_LIFECYCLE] friend cancelled notify failed', bid, e?.message || e)
    }
  }

  return out
}

/**
 * Диспут закрыт / разрешён — идемпотентный откат earned referral по брони (если были начисления).
 * @param {{ bookingId: string, disputeId?: string, trigger?: string, resolutionReason?: string }} params
 */
export async function onDisputeResolved({
  bookingId,
  disputeId = null,
  trigger = 'dispute_resolved',
  resolutionReason = null,
}) {
  const bid = String(bookingId || '').trim()
  if (!bid) return { success: false, error: 'BOOKING_ID_REQUIRED' }

  const { data: ledgerRows } = await supabaseAdmin
    .from('referral_ledger')
    .select('id')
    .eq('booking_id', bid)
    .in('status', ['pending', 'earned'])
    .limit(1)

  if (!Array.isArray(ledgerRows) || ledgerRows.length === 0) {
    return { success: true, skipped: true, reason: 'NO_REFERRAL_LEDGER', bookingId: bid }
  }

  try {
    const revert = await ReferralPnlService.revertReferralLedgerForBooking(bid, {
      trigger,
      disputeId: disputeId ? String(disputeId) : null,
      resolutionReason: resolutionReason ? String(resolutionReason).slice(0, 500) : null,
    })
    return { success: revert?.success !== false, bookingId: bid, revert }
  } catch (e) {
    console.error('[REFERRAL_LIFECYCLE] dispute revert failed', bid, e)
    return { success: false, error: e?.message || String(e), bookingId: bid }
  }
}

export default {
  onBookingStatusTransition,
  onDisputeResolved,
  runReferralCompletionPayout,
  BOOKING_STATUSES_REVERT_REFERRAL,
  BOOKING_STATUS_EARN_REFERRAL,
}
