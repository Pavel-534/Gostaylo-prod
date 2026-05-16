/**
 * Partner payout eligibility SSOT (Stage 98–99).
 * THAWED → withdrawable after 24h from escrow_thawed_at.
 * READY_FOR_PAYOUT → treasury batch queue (after same 24h hold).
 * Active dispute (freeze_payment) → blocked («DISPUTED» payout state).
 */

import { BookingStatus } from '@/lib/services/escrow/constants.js'

/** 24 hours — partner «Доступно к выводу» */
export const PARTNER_WITHDRAWAL_HOLD_MS = 24 * 60 * 60 * 1000

/** UI / API label when payout blocked by open dispute */
export const PARTNER_PAYOUT_DISPUTED_LABEL = 'DISPUTED'

/**
 * Official dispute freeze (disputes.freeze_payment + OPEN|IN_REVIEW).
 * @param {object} booking
 * @param {Set<string> | null} [frozenBookingIds] — from DisputeService.getFrozenBookingIdSet
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
  const raw = meta.escrow_thawed_at || meta.escrowThawedAt || booking?.escrow_thawed_at
  if (!raw) return null
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : null
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
