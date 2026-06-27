/**
 * Stage 147 / 172.5 — SSOT: status badge label for chat inbox (ConversationList).
 *
 * Virtual DISPUTED when payout is blocked by an active official dispute.
 * Mid-pipeline booking statuses override stale conversations.status_label.
 * Deal badges (invoice pending/paid, inquiry dates) — `resolveConversationDealBadge`.
 */

import { isBookingDisputePaymentFrozen } from '@/lib/partner/partner-payout-eligibility.js'

const MID_PIPELINE_STATUSES = new Set(['PAID_ESCROW', 'CHECKED_IN'])

const INACTIVE_INVOICE_STATUSES = new Set(['CANCELLED', 'EXPIRED'])

/** @typedef {'invoice_pending' | 'invoice_paid' | 'inquiry_dates'} ConversationDealBadgeKind */

/**
 * @param {object | null | undefined} msg — message row or lastMessage
 * @returns {{ status: string, id: string | null } | null}
 */
export function extractInvoiceSnapshotFromMessage(msg) {
  if (!msg) return null
  const type = String(msg.type || '').toLowerCase()
  if (type !== 'invoice') return null
  const inv = msg.metadata?.invoice || msg.metadata || {}
  return {
    status: String(inv.status || 'PENDING').toUpperCase(),
    id: inv.id || msg.metadata?.invoice_id || null,
  }
}

/**
 * Compact financial badge for inbox row preview (ADR-172 Wave 5).
 *
 * @param {object | null | undefined} conv — enriched conversation row
 * @returns {ConversationDealBadgeKind | null}
 */
export function resolveConversationDealBadge(conv) {
  if (!conv) return null

  const latestInvoice =
    conv.latestInvoice ||
    extractInvoiceSnapshotFromMessage(conv.lastMessage) ||
    null
  const invoiceStatus = latestInvoice?.status
    ? String(latestInvoice.status).toUpperCase()
    : null

  if (invoiceStatus === 'PAID') {
    return 'invoice_paid'
  }

  if (invoiceStatus === 'PENDING') {
    return 'invoice_pending'
  }

  if (invoiceStatus && !INACTIVE_INVOICE_STATUSES.has(invoiceStatus)) {
    return null
  }

  const booking = conv.booking
  const bookingStatus = String(booking?.status || '').toUpperCase()
  const cin = booking?.check_in ?? booking?.checkIn
  const cout = booking?.check_out ?? booking?.checkOut

  if (bookingStatus === 'INQUIRY' && cin && cout) {
    return 'inquiry_dates'
  }

  return null
}

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
