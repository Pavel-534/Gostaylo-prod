/**
 * Stage 147 — SSOT: status badge label for chat inbox (ConversationList).
 *
 * Virtual DISPUTED when payout is blocked by an active official dispute.
 * Mid-pipeline booking statuses override stale conversations.status_label.
 */

import { isBookingDisputePaymentFrozen } from '@/lib/partner/partner-payout-eligibility.js'

const MID_PIPELINE_STATUSES = new Set(['PAID_ESCROW', 'CHECKED_IN'])

/**
 * @param {object | null | undefined} booking — enriched row from ?enrich=1
 * @param {string | null | undefined} conversationStatusLabel — conversations.status_label
 * @returns {string | null} uppercase label for inbox badge
 */
export function resolveConversationInboxStatusLabel(booking, conversationStatusLabel) {
  const snap = booking?.dispute_snapshot || booking?.disputeSnapshot || null
  const disputeActive = snap?.isActive === true
  const disputeFrozen =
    snap?.freezePayment === true ||
    ['OPEN', 'IN_REVIEW'].includes(String(snap?.status || '').toUpperCase())

  if (disputeActive && (disputeFrozen || isBookingDisputePaymentFrozen(booking))) {
    return 'DISPUTED'
  }
  if (isBookingDisputePaymentFrozen(booking)) {
    return 'DISPUTED'
  }

  const bookingStatus = String(booking?.status || '').toUpperCase()
  if (MID_PIPELINE_STATUSES.has(bookingStatus)) {
    return bookingStatus
  }

  const fromConv = String(conversationStatusLabel || '').toUpperCase()
  if (fromConv) return fromConv
  if (bookingStatus) return bookingStatus
  return null
}
