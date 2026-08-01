/**
 * Partner payout eligibility SSOT (Stage 98–99, 141).
 * THAWED → withdrawable after 24h from escrow_thawed_at.
 * READY_FOR_PAYOUT → treasury batch queue (after same 24h hold).
 * Active dispute / mediation → blocked («DISPUTED» payout state).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { parseIsoTimestampMs } from '@/lib/booking/parse-iso-timestamp.js'
import { PARTNER_WITHDRAWAL_HOLD_MS } from '@/lib/partner/partner-payout-hold.js'

export { PARTNER_WITHDRAWAL_HOLD_MS } from '@/lib/partner/partner-payout-hold.js'

/** Official dispute with payment freeze (ledger hold applied). */
export const DISPUTE_FROZEN_STATUSES = Object.freeze(['OPEN', 'IN_REVIEW'])

/** Soft escrow pipeline block — no ledger hold until OPEN. Stage 141. */
export const DISPUTE_MEDIATION_STATUS = 'PENDING_MEDIATION'

/** All dispute statuses that block thaw / promote / batch eligibility. */
export const DISPUTE_PAYOUT_PIPELINE_BLOCKED_STATUSES = Object.freeze([
  ...DISPUTE_FROZEN_STATUSES,
  DISPUTE_MEDIATION_STATUS,
])

/** @typedef {Set<string> & { queryFailed?: boolean }} FrozenBookingIdSet */

/**
 * True when getFrozenBookingIdSet could not read disputes — callers must abort money moves.
 * @param {FrozenBookingIdSet | Set<string> | null | undefined} frozenSet
 */
export function isFrozenBookingLookupFailed(frozenSet) {
  return Boolean(frozenSet && typeof frozenSet === 'object' && frozenSet.queryFailed === true)
}

/**
 * FAIL-CLOSED: при ошибке БД считаем все брони замороженными.
 * @param {string[]} ids
 * @param {string} reason
 * @returns {FrozenBookingIdSet}
 */
function failClosedFrozenAll(ids, reason) {
  /** @type {FrozenBookingIdSet} */
  const blocked = new Set(ids.map(String).filter(Boolean))
  blocked.queryFailed = true
  // No critical-telemetry here — this module is imported by client UI (booking-status-display).
  // Server callers emit FREEZE_FAIL via lib/partner/freeze-fail-signal.js.
  console.error('[getFrozenBookingIdSet] FAIL-CLOSED', reason, `ids=${blocked.size}`)
  return blocked
}

/**
 * Booking IDs blocked from escrow payout pipeline (cron + batch creation + settle).
 * - PENDING_MEDIATION: soft block (no ledger hold)
 * - OPEN / IN_REVIEW: only when freeze_payment=true (hard block + ledger hold on OPEN)
 *
 * FAIL-CLOSED: при ошибке БД считаем все брони замороженными (Set всех id + queryFailed).
 *
 * @param {string[]} bookingIds
 * @returns {Promise<FrozenBookingIdSet>}
 */
export async function getFrozenBookingIdSet(bookingIds) {
  const ids = Array.isArray(bookingIds) ? bookingIds.filter(Boolean).map(String) : []
  if (!ids.length) return new Set()

  if (!supabaseAdmin) {
    return failClosedFrozenAll(ids, 'supabaseAdmin_unavailable')
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('disputes')
      .select('booking_id, status, freeze_payment')
      .in('booking_id', ids)
      .in('status', [...DISPUTE_PAYOUT_PIPELINE_BLOCKED_STATUSES])

    if (error) {
      return failClosedFrozenAll(ids, error.message || 'disputes_query_error')
    }

    /** @type {FrozenBookingIdSet} */
    const blocked = new Set()
    for (const row of data || []) {
      const bookingId = String(row.booking_id || '')
      if (!bookingId) continue
      const st = String(row.status || '').toUpperCase()
      if (st === DISPUTE_MEDIATION_STATUS) {
        blocked.add(bookingId)
        continue
      }
      if (DISPUTE_FROZEN_STATUSES.includes(st) && row.freeze_payment === true) {
        blocked.add(bookingId)
      }
    }
    return blocked
  } catch (e) {
    return failClosedFrozenAll(ids, e?.message || String(e) || 'disputes_query_exception')
  }
}

/** UI / API label when payout blocked by open dispute */
export const PARTNER_PAYOUT_DISPUTED_LABEL = 'DISPUTED'

/**
 * Dispute / mediation payout block (OPEN|IN_REVIEW + freeze, or PENDING_MEDIATION soft block).
 * @param {object} booking
 * @param {Set<string> | null} [frozenBookingIds] — from getFrozenBookingIdSet
 */
export function isBookingDisputePaymentFrozen(booking, frozenBookingIds = null) {
  const id = String(booking?.id || '')
  if (frozenBookingIds instanceof Set && id && frozenBookingIds.has(id)) return true
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  if (meta.payout_blocked_by_dispute === true) return true
  return false
}

/**
 * @param {object} booking
 * @returns {number | null} epoch ms
 */
export function getBookingEscrowThawedAtMs(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const raw =
    meta.escrow_thawed_at ||
    meta.escrowThawedAt ||
    booking?.escrow_thawed_at ||
    meta.ready_for_payout_at
  let ms = parseIsoTimestampMs(raw)
  if (ms != null) return ms
  const st = String(booking?.status || '').toUpperCase()
  if (st === BookingStatus.THAWED || st === BookingStatus.READY_FOR_PAYOUT) {
    ms = parseIsoTimestampMs(booking?.updated_at)
    if (ms != null) return ms
  }
  return null
}

/**
 * @param {object} booking
 * @param {number} [nowMs]
 */
export function isWithdrawalHoldElapsed(booking, nowMs = Date.now()) {
  const thawMs = getBookingEscrowThawedAtMs(booking)
  if (!thawMs) return false
  return nowMs - thawMs >= PARTNER_WITHDRAWAL_HOLD_MS
}

/**
 * Net amount eligible for partner withdrawal request.
 * @param {object} booking
 * @param {number} netThb
 * @param {number} [nowMs]
 * @param {Set<string> | null} [frozenBookingIds]
 */
export function isPartnerNetWithdrawable(booking, netThb, nowMs = Date.now(), frozenBookingIds = null) {
  const net = Number(netThb)
  if (!Number.isFinite(net) || net <= 0) return false
  if (isBookingDisputePaymentFrozen(booking, frozenBookingIds)) return false
  const st = String(booking?.status || '').toUpperCase()
  if (st === BookingStatus.READY_FOR_PAYOUT) return true
  if (st === BookingStatus.THAWED && isWithdrawalHoldElapsed(booking, nowMs)) return true
  return false
}

/**
 * Treasury batch promotion (THAWED → READY_FOR_PAYOUT).
 * @param {object} booking
 * @param {number} [nowMs]
 * @param {Set<string> | null} [frozenBookingIds]
 */
export function isEligibleForReadyForPayoutStatus(booking, nowMs = Date.now(), frozenBookingIds = null) {
  const st = String(booking?.status || '').toUpperCase()
  if (st !== BookingStatus.THAWED) return false
  if (isBookingDisputePaymentFrozen(booking, frozenBookingIds)) return false
  return isWithdrawalHoldElapsed(booking, nowMs)
}

/**
 * @param {object} booking
 * @param {number} netThb
 * @param {number} [nowMs]
 * @param {Set<string> | null} [frozenBookingIds]
 * @returns {'escrow' | 'thaw_hold' | 'dispute_hold' | 'withdrawable' | 'ready_for_batch' | 'paid_out' | 'other'}
 */
export function classifyPartnerBookingPayoutBucket(
  booking,
  netThb,
  nowMs = Date.now(),
  frozenBookingIds = null,
) {
  const st = String(booking?.status || '').toUpperCase()
  if (isBookingDisputePaymentFrozen(booking, frozenBookingIds)) {
    if (st === BookingStatus.PAID_ESCROW) return 'escrow'
    return 'dispute_hold'
  }
  if (st === BookingStatus.PAID_ESCROW) return 'escrow'
  if (st === BookingStatus.THAWED) {
    return isWithdrawalHoldElapsed(booking, nowMs) ? 'withdrawable' : 'thaw_hold'
  }
  if (st === BookingStatus.READY_FOR_PAYOUT) return 'ready_for_batch'
  if (st === BookingStatus.COMPLETED) return 'paid_out'
  return 'other'
}

/**
 * @param {object} booking
 * @param {number} [nowMs]
 * @returns {number | null} ms until withdrawable (0 if already)
 */
export function msUntilWithdrawable(booking, nowMs = Date.now()) {
  if (isBookingDisputePaymentFrozen(booking)) return null
  const thawMs = getBookingEscrowThawedAtMs(booking)
  if (!thawMs) return null
  const left = thawMs + PARTNER_WITHDRAWAL_HOLD_MS - nowMs
  return Math.max(0, left)
}
