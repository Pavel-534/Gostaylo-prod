/**
 * PR-#4: Guest refund % from listing.cancellation_policy and hours until check_in.
 * Percent applies to guest-paid total THB (same basis as ledger capture guest total).
 *
 * Tiers (tune in product / ADR):
 * - flexible: ≥24h → 100%, else 50%
 * - moderate: ≥168h → 100%, ≥24h → 50%, else 0%
 * - strict: ≥168h → 50%, else 0%
 *
 * Stage 202.16 — post-capture grace override (env):
 * - GUEST_CANCEL_GRACE_MINUTES (default 15)
 * - GUEST_CANCEL_GRACE_MIN_HOURS_BEFORE_CHECKIN (default 24)
 */

/** @typedef {'flexible'|'moderate'|'strict'} CancellationPolicy */

const DEFAULT_GUEST_CANCEL_GRACE_MINUTES = 15
const DEFAULT_GUEST_CANCEL_GRACE_MIN_HOURS_BEFORE_CHECKIN = 24

/**
 * @returns {number}
 */
export function getGuestCancelGraceMinutes() {
  const raw = process.env.GUEST_CANCEL_GRACE_MINUTES
  const n = raw != null && raw !== '' ? Number(raw) : DEFAULT_GUEST_CANCEL_GRACE_MINUTES
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_GUEST_CANCEL_GRACE_MINUTES
}

/**
 * @returns {number}
 */
export function getGuestCancelGraceMinHoursBeforeCheckIn() {
  const raw = process.env.GUEST_CANCEL_GRACE_MIN_HOURS_BEFORE_CHECKIN
  const n =
    raw != null && raw !== ''
      ? Number(raw)
      : DEFAULT_GUEST_CANCEL_GRACE_MIN_HOURS_BEFORE_CHECKIN
  return Number.isFinite(n) && n >= 0
    ? n
    : DEFAULT_GUEST_CANCEL_GRACE_MIN_HOURS_BEFORE_CHECKIN
}

/**
 * SSOT anchor for grace window — payment_intents.confirmed_at or metadata.paid_event.at.
 * @param {{ confirmed_at?: string | null, metadata?: { paid_event?: { at?: string | null } } | null } | null | undefined} intent
 * @returns {Date | null}
 */
export function resolvePaymentCapturedAtFromIntent(intent) {
  if (!intent || typeof intent !== 'object') return null
  const confirmed = intent.confirmed_at
  if (confirmed) {
    const t = Date.parse(String(confirmed))
    if (Number.isFinite(t)) return new Date(t)
  }
  const meta = intent.metadata
  const at =
    meta && typeof meta === 'object' && meta.paid_event && typeof meta.paid_event === 'object'
      ? meta.paid_event.at
      : null
  if (at) {
    const t = Date.parse(String(at))
    if (Number.isFinite(t)) return new Date(t)
  }
  return null
}

/**
 * @param {{
 *   hoursBeforeCheckIn: number,
 *   paymentCapturedAt?: Date | string | null,
 *   cancelledAt?: Date,
 *   graceMinutes?: number,
 *   minHoursBeforeCheckIn?: number,
 * }} p
 */
export function qualifiesForGuestCancelGracePeriod(p) {
  const captured =
    p.paymentCapturedAt instanceof Date
      ? p.paymentCapturedAt
      : p.paymentCapturedAt
        ? new Date(p.paymentCapturedAt)
        : null
  if (!captured || Number.isNaN(captured.getTime())) return false

  const cancelledAt = p.cancelledAt instanceof Date ? p.cancelledAt : new Date()
  const minutesSinceCapture = (cancelledAt.getTime() - captured.getTime()) / (60 * 1000)
  if (!Number.isFinite(minutesSinceCapture) || minutesSinceCapture < 0) return false

  const graceMinutes =
    p.graceMinutes != null ? Number(p.graceMinutes) : getGuestCancelGraceMinutes()
  const minHours =
    p.minHoursBeforeCheckIn != null
      ? Number(p.minHoursBeforeCheckIn)
      : getGuestCancelGraceMinHoursBeforeCheckIn()
  const hours = Number.isFinite(p.hoursBeforeCheckIn) ? p.hoursBeforeCheckIn : -Infinity

  return minutesSinceCapture <= graceMinutes && hours >= minHours
}

/**
 * @param {string|null|undefined} raw — from listings.cancellation_policy or metadata
 * @returns {CancellationPolicy}
 */
export function normalizeCancellationPolicy(raw) {
  const s = String(raw || 'moderate').toLowerCase().trim();
  if (s === 'flexible' || s === 'moderate' || s === 'strict') return s;
  return 'moderate';
}

/**
 * @param {CancellationPolicy} policy
 * @param {number} hoursBeforeCheckIn — (check_in - cancelled_at) in hours; negative = after start
 * @returns {number} 0..100
 */
export function guestRefundPercentFromPolicy(policy, hoursBeforeCheckIn) {
  const p = normalizeCancellationPolicy(policy);
  const h = Number.isFinite(hoursBeforeCheckIn) ? hoursBeforeCheckIn : -Infinity;

  if (p === 'flexible') {
    if (h >= 24) return 100;
    return 50;
  }
  if (p === 'moderate') {
    if (h >= 168) return 100;
    if (h >= 24) return 50;
    return 0;
  }
  // strict
  if (h >= 168) return 50;
  return 0;
}

/**
 * @param {string|Date|null|undefined} checkInRaw — DB timestamptz or ISO
 * @param {Date} [cancelledAt]
 * @returns {number} hours (can be negative)
 */
export function hoursBeforeCheckIn(checkInRaw, cancelledAt = new Date()) {
  if (checkInRaw == null) return -Infinity;
  const t = typeof checkInRaw === 'string' || checkInRaw instanceof Date
    ? Date.parse(String(checkInRaw))
    : NaN;
  if (Number.isNaN(t)) return -Infinity;
  return (t - cancelledAt.getTime()) / (3600 * 1000);
}

/**
 * @param {{ cancellation_policy?: string|null }} listing
 * @param {string|Date|null|undefined} checkInRaw
 * @param {number} guestTotalPaidThb — guest-side payable THB (ledger guest total)
 * @param {Date} [cancelledAt]
 * @param {{
 *   paymentCapturedAt?: Date | string | null,
 *   graceMinutes?: number,
 *   minHoursBeforeCheckIn?: number,
 * }} [options]
 * @returns {{
 *   refundGuestThb: number,
 *   percent: number,
 *   hoursBefore: number,
 *   policy: CancellationPolicy,
 *   refundReason: string | null,
 *   gracePeriodActive: boolean,
 * }}
 */
export function computeRefundGuestThbFromCancellation(
  listing,
  checkInRaw,
  guestTotalPaidThb,
  cancelledAt = new Date(),
  options = {},
) {
  const policy = normalizeCancellationPolicy(listing?.cancellation_policy);
  const hours = hoursBeforeCheckIn(checkInRaw, cancelledAt);
  let percent = guestRefundPercentFromPolicy(policy, hours);
  let refundReason = null;
  let gracePeriodActive = false;

  if (
    qualifiesForGuestCancelGracePeriod({
      hoursBeforeCheckIn: hours,
      paymentCapturedAt: options.paymentCapturedAt ?? null,
      cancelledAt,
      graceMinutes: options.graceMinutes,
      minHoursBeforeCheckIn: options.minHoursBeforeCheckIn,
    })
  ) {
    percent = 100;
    refundReason = 'grace_period';
    gracePeriodActive = true;
  }

  const gross = Number(guestTotalPaidThb);
  const safe = Number.isFinite(gross) && gross > 0 ? gross : 0;
  const refundGuestThb = Math.round(((safe * percent) / 100) * 100) / 100;
  return { refundGuestThb, percent, hoursBefore: hours, policy, refundReason, gracePeriodActive };
}
