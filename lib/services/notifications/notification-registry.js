/**
 * Stage 55.0–56.0 — SSOT: event → { handler, isAsync }.
 * - New event: add one entry.
 * - `isAsync: true` — when `process.env.NOTIFICATION_OUTBOX === '1'`, dispatch enqueues `notification_outbox` instead of running the handler (sync fallback on insert failure).
 */
import * as BookingEvents from '@/lib/services/notifications/booking-events.js'
import * as PaymentEvents from '@/lib/services/notifications/payment-events.js'
import * as MarketingEvents from '@/lib/services/notifications/marketing-events.js'

/** @type {Record<string, { handler: (data: unknown) => Promise<void>, isAsync: boolean }>} */
export const NOTIFICATION_REGISTRY = {
  USER_WELCOME: { handler: MarketingEvents.handleUserWelcome, isAsync: true },
  NEW_BOOKING_REQUEST: { handler: BookingEvents.handleNewBookingRequest, isAsync: true },
  BOOKING_CONFIRMED: { handler: BookingEvents.handleBookingConfirmed, isAsync: true },
  BOOKING_CANCELLED: { handler: BookingEvents.handleBookingCancelled, isAsync: true },
  PAYMENT_SUBMITTED: { handler: PaymentEvents.handlePaymentSubmitted, isAsync: true },
  PAYMENT_RECEIVED: { handler: PaymentEvents.handlePaymentReceived, isAsync: true },
  PAYMENT_SUCCESS: { handler: PaymentEvents.handlePaymentSuccess, isAsync: true },
  PAYMENT_CONFIRMED: { handler: PaymentEvents.handlePaymentConfirmed, isAsync: true },
  PARTNER_VERIFIED: { handler: MarketingEvents.handlePartnerVerified, isAsync: true },
  PARTNER_REJECTED: { handler: MarketingEvents.handlePartnerRejected, isAsync: true },
  LISTING_APPROVED: { handler: MarketingEvents.handleListingApproved, isAsync: true },
  LISTING_REJECTED: { handler: MarketingEvents.handleListingRejected, isAsync: true },
  PAYOUT_PROCESSED: { handler: PaymentEvents.handlePayoutProcessed, isAsync: true },
  PAYOUT_REJECTED: { handler: PaymentEvents.handlePayoutRejected, isAsync: true },
  NEW_MESSAGE: { handler: BookingEvents.handleNewMessage, isAsync: true },
  CHECK_IN_CONFIRMED: { handler: BookingEvents.handleCheckInConfirmed, isAsync: true },
  ESCROW_THAW_PREVIEW: { handler: PaymentEvents.handleEscrowThawPreview, isAsync: true },
  PAYOUT_BATCH_COMPLETED: { handler: PaymentEvents.handlePayoutBatchCompleted, isAsync: true },
  CHECKIN_REMINDER: { handler: BookingEvents.handleCheckInReminder, isAsync: true },
  DRAFT_DIGEST_REMINDER: { handler: MarketingEvents.handleDraftDigestReminder, isAsync: true },
  REVIEW_REMINDER: { handler: BookingEvents.handleReviewReminder, isAsync: true },
  PARTNER_GUEST_REVIEW_INVITE: { handler: BookingEvents.handlePartnerGuestReviewInvite, isAsync: true },
  PARTNER_FUNDS_THAWED_AVAILABLE: { handler: PaymentEvents.handlePartnerFundsThawedAvailable, isAsync: true },
  WALLET_WELCOME_EXPIRING: { handler: MarketingEvents.handleWalletWelcomeExpiring, isAsync: false },
}

Object.freeze(NOTIFICATION_REGISTRY)

/** Same string values as keys — for `NotificationEvents.X` call sites and crons. */
export const NotificationEvents = Object.freeze(
  Object.fromEntries(Object.keys(NOTIFICATION_REGISTRY).map((k) => [k, k])),
)

/**
 * @param {string} event
 * @returns {((data: unknown) => Promise<void>) | null}
 */
export function resolveNotificationHandler(event) {
  if (!event || typeof event !== 'string') return null
  return NOTIFICATION_REGISTRY[event]?.handler ?? null
}

/**
 * @param {string} event
 */
export function isNotificationEventAsync(event) {
  if (!event || typeof event !== 'string') return false
  return NOTIFICATION_REGISTRY[event]?.isAsync === true
}
