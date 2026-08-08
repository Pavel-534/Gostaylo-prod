/**
 * Stage 55.0–56.0 — SSOT: event → { handler, isAsync }.
 * Stage 200.74 — hygiene: wire active status flows; mark retired events with `intentionallyDead`.
 * - New event: add one entry.
 * - `isAsync: true` — when `process.env.NOTIFICATION_OUTBOX === '1'`, dispatch enqueues `notification_outbox`
 *   instead of running the handler (sync fallback on insert failure). Cron drain: `process-notification-outbox.js`.
 */
import * as BookingEvents from '@/lib/services/notifications/booking-events.js'
import * as PaymentEvents from '@/lib/services/notifications/payment-events.js'
import * as MarketingEvents from '@/lib/services/notifications/marketing-events.js'
import * as ReferralEvents from '@/lib/services/notifications/referral-events.js'

/**
 * @typedef {{
 *   handler: (data: unknown) => Promise<void>,
 *   isAsync: boolean,
 *   intentionallyDead?: boolean,
 *   supersededBy?: string,
 *   note?: string,
 * }} NotificationRegistryEntry
 */

/** @type {Record<string, NotificationRegistryEntry>} */
export const NOTIFICATION_REGISTRY = {
  USER_WELCOME: { handler: MarketingEvents.handleUserWelcome, isAsync: true },
  NEW_BOOKING_REQUEST: { handler: BookingEvents.handleNewBookingRequest, isAsync: true },
  BOOKING_CONFIRMED: { handler: BookingEvents.handleBookingConfirmed, isAsync: true },
  BOOKING_CANCELLED: { handler: BookingEvents.handleBookingCancelled, isAsync: true },
  PAYMENT_SUBMITTED: { handler: PaymentEvents.handlePaymentSubmitted, isAsync: true },
  PAYMENT_RECEIVED: { handler: PaymentEvents.handlePaymentReceived, isAsync: true },
  /** @intentionally-dead — guest escrow notify is PAYMENT_RECEIVED only */
  PAYMENT_SUCCESS: {
    handler: PaymentEvents.handlePaymentSuccess,
    isAsync: true,
    intentionallyDead: true,
    supersededBy: 'PAYMENT_RECEIVED',
    note: 'Legacy alias; do not dispatch from new code',
  },
  /** @intentionally-dead — guest escrow notify is PAYMENT_RECEIVED only */
  PAYMENT_CONFIRMED: {
    handler: PaymentEvents.handlePaymentConfirmed,
    isAsync: true,
    intentionallyDead: true,
    supersededBy: 'PAYMENT_RECEIVED',
    note: 'Legacy alias; do not dispatch from new code',
  },
  PARTNER_VERIFIED: { handler: MarketingEvents.handlePartnerVerified, isAsync: true },
  PARTNER_REJECTED: { handler: MarketingEvents.handlePartnerRejected, isAsync: true },
  LISTING_APPROVED: { handler: MarketingEvents.handleListingApproved, isAsync: true },
  LISTING_REJECTED: { handler: MarketingEvents.handleListingRejected, isAsync: true },
  PAYOUT_PROCESSED: { handler: PaymentEvents.handlePayoutProcessed, isAsync: true },
  /** @intentionally-dead — no admin payout-reject product path yet; handler kept for future */
  PAYOUT_REJECTED: {
    handler: PaymentEvents.handlePayoutRejected,
    isAsync: true,
    intentionallyDead: true,
    note: 'No production reject UI; wire when payout reject ships',
  },
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
  DISPUTE_OPENED_SLA: { handler: BookingEvents.handleDisputeOpenedSla, isAsync: true },
  DISPUTE_SLA_REMINDER: { handler: BookingEvents.handleDisputeSlaReminder, isAsync: true },
  DISPUTE_AUTO_RESOLVED: { handler: BookingEvents.handleDisputeAutoResolved, isAsync: true },
  REFERRAL_BONUS_EARNED: { handler: ReferralEvents.handleReferralBonusEarned, isAsync: true },
  REFERRAL_BONUS_HELD: { handler: ReferralEvents.handleReferralBonusHeld, isAsync: true },
  REFERRAL_TEAMMATE_JOINED: { handler: ReferralEvents.handleReferralTeammateJoined, isAsync: true },
  REFERRAL_WALLET_PAYOUT_REQUESTED: {
    handler: ReferralEvents.handleReferralWalletPayoutRequested,
    isAsync: true,
  },
  REFERRAL_WITHDRAWAL_APPROVED: {
    handler: ReferralEvents.handleReferralWithdrawalApproved,
    isAsync: true,
  },
  REFERRAL_WITHDRAWAL_REGISTRY_SENT: {
    handler: ReferralEvents.handleReferralWithdrawalRegistrySent,
    isAsync: true,
  },
  REFERRAL_WITHDRAWAL_PAID: {
    handler: ReferralEvents.handleReferralWithdrawalPaid,
    isAsync: true,
  },
  REFERRAL_WITHDRAWAL_REJECTED: {
    handler: ReferralEvents.handleReferralWithdrawalRejected,
    isAsync: true,
  },
  REFERRAL_WITHDRAWAL_EXPIRED: {
    handler: ReferralEvents.handleReferralWithdrawalExpired,
    isAsync: true,
  },
  REFERRAL_TEAM_WEEKLY_DIGEST: {
    handler: ReferralEvents.handleReferralTeamWeeklyDigest,
    isAsync: true,
  },
  PARTNER_HOST_ONBOARDING_NUDGE: {
    handler: MarketingEvents.handlePartnerHostOnboardingNudge,
    isAsync: true,
  },
  REFERRAL_ADMIN_ALERT: { handler: ReferralEvents.handleReferralAdminAlert, isAsync: true },
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
  const entry = NOTIFICATION_REGISTRY[event]
  return entry?.handler || null
}

/**
 * @param {string} event
 */
export function isNotificationEventAsync(event) {
  return Boolean(NOTIFICATION_REGISTRY[event]?.isAsync)
}
