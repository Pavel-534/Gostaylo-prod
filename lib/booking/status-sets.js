/**
 * Stage 110.2 — SSOT наборов статусов брони (фильтры, календарь, iCal, ROI, escrow, чат, FinTech).
 *
 * - Коды: `lib/config/app-constants.js` → `BOOKING_STATUS`
 * - FSM / PATCH: `lib/booking/status-transitions.js`
 * - UI бейджи: `lib/booking/booking-status-display.js` (в т.ч. виртуальные THAW_HOLD / DISPUTED)
 * - Pay CTA / checkout entry: `lib/booking/booking-status-rules.js` → `isBookingPayable`
 *
 * Реестр экспортов: OCCUPYING_*, ICAL_EXPORT_*, REFERRAL_*, ESCROW_PIPELINE_*,
 * NO_PAY_TRAVEL_*, TRANSPORT_CONFIRM_*, cancel/review/FinTech/dispute/emergency,
 * CONTACT_REVEALED_*, COMPLIANCE_PAID_*, ORDER_* / ADMIN_STATS_*.
 */

/** Коды совпадают с `BOOKING_STATUS` в `lib/config/app-constants.js` (без import — избегаем цикла re-export). */
const S = Object.freeze({
  PENDING: 'PENDING',
  INQUIRY: 'INQUIRY',
  CONFIRMED: 'CONFIRMED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAID: 'PAID',
  PAID_ESCROW: 'PAID_ESCROW',
  CHECKED_IN: 'CHECKED_IN',
  THAWED: 'THAWED',
  READY_FOR_PAYOUT: 'READY_FOR_PAYOUT',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  DECLINED: 'DECLINED',
})

/**
 * Блокируют ночи во внутреннем календаре, RPC `create_booking_atomic_v1` и partner grid.
 *
 * **INQUIRY** намеренно не включён — мягкий запрос в чате не резервирует даты до CONFIRMED
 * (партнёр может отклонить; double-book риск ниже, чем при жёстком hold).
 *
 * **AWAITING_PAYMENT** (Stage 149.2) — гость на checkout после `payment/initiate`; слот
 * остаётся занятым до оплаты (`PAID_ESCROW`) или отмены, иначе параллельный instant-book
 * получал бы DATES_CONFLICT-free окно между CONFIRMED→AWAITING_PAYMENT и webhook.
 */
export const OCCUPYING_BOOKING_STATUSES = Object.freeze([
  S.PENDING,
  S.CONFIRMED,
  S.AWAITING_PAYMENT,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.THAWED,
])

/**
 * iCal BUSY для внешних OTA: заявки и оплаченные интервалы, без отменённых.
 * Без INQUIRY (ещё не занято на платформе для экспорта), без CHECKED_IN/THAWED
 * (для OTA достаточно PAID_ESCROW / PAID / CONFIRMED / PENDING).
 */
export const ICAL_EXPORT_BOOKING_STATUSES = Object.freeze([
  S.PENDING,
  S.PAID_ESCROW,
  S.CONFIRMED,
  S.PAID,
  S.COMPLETED,
])

/** Marketing ROI: маржа платформы по приглашённым гостям (commission_thb). */
export const REFERRAL_GUEST_MARGIN_BOOKING_STATUSES = Object.freeze([
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.COMPLETED,
])

/** Эскроу / выплаты: PAID_ESCROW → … → READY_FOR_PAYOUT (≠ terminal COMPLETED). */
export const ESCROW_PIPELINE_STATUSES = Object.freeze([
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.THAWED,
  S.READY_FOR_PAYOUT,
])

/** @deprecated alias — use ESCROW_PIPELINE_STATUSES */
export const BOOKING_ESCROW_PIPELINE_STATUSES = ESCROW_PIPELINE_STATUSES

/** UI / eligibility: те же коды, что escrow pipeline (Stage 108.4). */
export const ESCROW_OR_PAYOUT_PIPELINE_STATUSES = ESCROW_PIPELINE_STATUSES

/**
 * AWAITING_PAYMENT намеренно не включён — гость может оплатить из чата (isBookingPayable).
 */
export const NO_PAY_TRAVEL_STATUSES = new Set([
  S.CANCELLED,
  S.REFUNDED,
  S.COMPLETED,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.THAWED,
  S.READY_FOR_PAYOUT,
])

/**
 * Transport calendar confirm: только занятые оплаченные интервалы (без PENDING/INQUIRY).
 * CSV для PostgREST `status=in.(...)`.
 */
export const TRANSPORT_CONFIRM_STATUSES = Object.freeze([
  S.CONFIRMED,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
])

/** @deprecated alias — use TRANSPORT_CONFIRM_STATUSES */
export const TRANSPORT_PARTNER_CONFIRM_OCCUPYING_STATUSES = TRANSPORT_CONFIRM_STATUSES

/** Renter checkout: нельзя отменить с экрана оплаты. */
export const RENTER_CHECKOUT_NO_CANCEL_STATUSES = new Set([
  S.CANCELLED,
  S.COMPLETED,
  S.REFUNDED,
  S.DECLINED,
])

/** Referral team: «первая бронь в процессе» у приглашённого. */
export const REFERRAL_RENTER_IN_FLIGHT_BOOKING_STATUSES = Object.freeze([
  S.PENDING,
  S.CONFIRMED,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
])

/** POST cancel / dispute refund: partial refund через ledger. */
export const BOOKING_LEDGER_REFUND_STATUSES = new Set([
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.THAWED,
  S.READY_FOR_PAYOUT,
])

/** POST cancel: без движения ledger. */
export const BOOKING_SIMPLE_CANCEL_STATUSES = new Set([
  S.PENDING,
  S.INQUIRY,
  S.CONFIRMED,
  S.AWAITING_PAYMENT,
  S.PAID,
])

/**
 * Cron review-reminder — только после завершения аренды (календарный check_out = вчера).
 * Stage 176.0: без PAID_ESCROW / CHECKED_IN (ложные напоминания до COMPLETED).
 * `FINISHED` — legacy UI label, не член Postgres `booking_status`; в БД покрывается COMPLETED.
 */
export const BOOKING_REVIEW_REMINDER_ELIGIBLE_STATUSES = Object.freeze([
  S.THAWED,
  S.COMPLETED,
])

/** FinTech dashboard / health monitor — брони с эскроу и завершённые. */
export const BOOKING_FINANCE_DASHBOARD_STATUSES = Object.freeze([
  S.PAID_ESCROW,
  S.THAWED,
  S.READY_FOR_PAYOUT,
  S.COMPLETED,
])

/** FinTech: только активный pipe до COMPLETED. */
export const BOOKING_FINANCE_PIPE_ACTIVE_STATUSES = Object.freeze([
  S.PAID_ESCROW,
  S.THAWED,
  S.READY_FOR_PAYOUT,
])

/**
 * Stage 125.1 / 125.4 — idempotent 2xx on payment webhooks (acquiring + crypto).
 * Guest funds already captured (ledger); PSP/Tron retries must not re-run markPaid / moveToEscrow.
 * Booking FSM status is SSOT — not `payment_intents.status` (intent may still be CREATED on retry).
 */
export const PAYMENT_ACQUIRING_WEBHOOK_IDEMPOTENT_BOOKING_STATUSES = new Set([
  ...ESCROW_PIPELINE_STATUSES,
  S.COMPLETED,
])

/** Partner finances: ожидают оплаты гостя. */
export const PARTNER_PENDING_PAYMENT_BOOKING_STATUSES = new Set([S.PENDING, S.CONFIRMED])

/** Reputation / success metrics (JS + UI). `FINISHED` — legacy virtual label, not in Postgres `booking_status` enum. */
export const REPUTATION_SUCCESS_BOOKING_STATUSES = Object.freeze([
  S.THAWED,
  S.COMPLETED,
])

/** Safe for PostgREST `.in('status', …)` — only enum members present in DB. */
export const REPUTATION_SUCCESS_BOOKING_STATUSES_DB = REPUTATION_SUCCESS_BOOKING_STATUSES

/** Partner guest review invite cron. */
export const PARTNER_GUEST_REVIEW_INVITE_STATUSES = Object.freeze([
  S.THAWED,
  S.COMPLETED,
])

/** Chat transport upsell после смены статуса. */
export const CHAT_TRANSPORT_UPSELL_TRIGGER_STATUSES = Object.freeze([
  S.CONFIRMED,
  S.PAID,
  S.PAID_ESCROW,
])

/** Official dispute: нельзя открыть. */
export const DISPUTE_BLOCKED_BOOKING_STATUSES = new Set([S.PENDING, S.INQUIRY])

/** Official dispute: до заезда. */
export const DISPUTE_EARLY_BOOKING_STATUSES = new Set([S.CONFIRMED, S.AWAITING_PAYMENT])

/** Cron cleanup drafts: протухшие заявки. */
export const DRAFT_CLEANUP_STALE_BOOKING_STATUSES = Object.freeze([S.PENDING, S.INQUIRY])

/** Admin legacy payout listing filter. */
export const ADMIN_LEGACY_PAYOUT_BOOKING_STATUSES = Object.freeze([S.PAID, S.COMPLETED])

/** Emergency contact: не показывать кнопку. */
export const EMERGENCY_BLOCKED_BOOKING_STATUSES = new Set([
  S.PENDING,
  S.INQUIRY,
  S.CANCELLED,
  S.DECLINED,
  S.COMPLETED,
  'FINISHED',
  S.REFUNDED,
  'EXPIRED',
])

/** Emergency contact: можно связаться с партнёром. */
export const EMERGENCY_ALLOWED_BOOKING_STATUSES = new Set([
  S.CONFIRMED,
  S.AWAITING_PAYMENT,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
  S.THAWED,
])

/**
 * Промо/доверие UI: хост подтвердил или гость на платёжном пути (включая CONFIRMED без оплаты).
 */
export const BOOKING_TRUST_PAID_STATUSES = new Set([
  S.CONFIRMED,
  S.PAID,
  S.PAID_ESCROW,
  S.THAWED,
  S.COMPLETED,
  S.CHECKED_IN,
  'CHECKED_OUT',
])

/** Чат: раскрыть телефон/email после оплаты (CONFIRMED без оплаты — маска остаётся). */
export const CONTACT_REVEALED_BOOKING_STATUSES = new Set([
  S.PAID,
  S.PAID_ESCROW,
  S.THAWED,
  S.COMPLETED,
  S.CHECKED_IN,
  'CHECKED_OUT',
])

/** Compliance export: строки с «оплаченной» бронью для банка. */
export const COMPLIANCE_PAID_BOOKING_STATUSES = new Set([
  S.PAID_ESCROW,
  S.THAWED,
  S.READY_FOR_PAYOUT,
  S.COMPLETED,
  S.CONFIRMED,
])

/** Unified order card: гость может отменить. */
export const ORDER_RENTER_CANCEL_ELIGIBLE_STATUSES = new Set([
  S.PENDING,
  S.CONFIRMED,
  S.AWAITING_PAYMENT,
])

/** Unified order card: партнёр может завершить. */
export const ORDER_PARTNER_COMPLETE_STATUSES = new Set([S.PAID, S.THAWED, S.CHECKED_IN])

/** Admin dashboard: активный pipe (не COMPLETED). */
export const ADMIN_STATS_ACTIVE_PIPELINE_STATUSES = new Set([
  S.PENDING,
  S.CONFIRMED,
  S.PAID,
])

/** Admin dashboard: выручка/комиссия в срезах. */
export const ADMIN_STATS_REVENUE_BOOKING_STATUSES = new Set([S.PAID, S.COMPLETED])

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isBookingTrustPaidStatus(status) {
  return BOOKING_TRUST_PAID_STATUSES.has(String(status || '').toUpperCase())
}

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isContactRevealedBookingStatus(status) {
  return CONTACT_REVEALED_BOOKING_STATUSES.has(String(status || '').toUpperCase())
}

/** PostgREST `status=in.(...)` для календарной занятости. */
export function occupyingStatusesInFilter() {
  return OCCUPYING_BOOKING_STATUSES.join(',')
}

/** Transport confirm CSV (alias). */
export function transportConfirmOccupyingCsv() {
  return TRANSPORT_CONFIRM_STATUSES.join(',')
}

/** @deprecated use transportConfirmOccupyingCsv */
export function transportPartnerConfirmOccupyingCsv() {
  return transportConfirmOccupyingCsv()
}

/**
 * ADR-181.4 — блокируют смену `base_currency` / базовой цены листинга.
 * Маппинг: pending→PENDING, confirmed→CONFIRMED, partially_paid→AWAITING_PAYMENT,
 * paid (in-stay)→PAID|PAID_ESCROW|CHECKED_IN.
 * Не блокируют: INQUIRY, THAWED, READY_FOR_PAYOUT, COMPLETED, CANCELLED, REFUNDED, DECLINED.
 */
export const LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES = Object.freeze([
  S.PENDING,
  S.CONFIRMED,
  S.AWAITING_PAYMENT,
  S.PAID,
  S.PAID_ESCROW,
  S.CHECKED_IN,
])

/** PostgREST `status=in.(...)` для financial lock count. */
export function listingFinancialLockStatusesInFilter() {
  return LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.join(',')
}

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isListingFinancialLockBlockingStatus(status) {
  return LISTING_FINANCIAL_LOCK_BLOCKING_STATUSES.includes(String(status || '').toUpperCase())
}

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isOccupyingBookingStatus(status) {
  return OCCUPYING_BOOKING_STATUSES.includes(String(status || '').toUpperCase())
}

/**
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isPaymentAcquiringWebhookIdempotentBookingStatus(status) {
  return PAYMENT_ACQUIRING_WEBHOOK_IDEMPOTENT_BOOKING_STATUSES.has(String(status || '').toUpperCase())
}
