/**
 * PR-#4: Guest refund % from listing.cancellation_policy and hours until check_in.
 * Percent applies to guest-paid total THB (same basis as ledger capture guest total).
 *
 * Tiers (tune in product / ADR):
 * - flexible: ≥24h → 100%, else 50%
 * - moderate: ≥168h → 100%, ≥24h → 50%, else 0%
 * - strict: ≥168h → 50%, else 0%
 */

/** @typedef {'flexible'|'moderate'|'strict'} CancellationPolicy */

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
 * @returns {{ refundGuestThb: number, percent: number, hoursBefore: number, policy: CancellationPolicy }}
 */
export function computeRefundGuestThbFromCancellation(listing, checkInRaw, guestTotalPaidThb, cancelledAt = new Date()) {
  const policy = normalizeCancellationPolicy(listing?.cancellation_policy);
  const hours = hoursBeforeCheckIn(checkInRaw, cancelledAt);
  const percent = guestRefundPercentFromPolicy(policy, hours);
  const gross = Number(guestTotalPaidThb);
  const safe = Number.isFinite(gross) && gross > 0 ? gross : 0;
  const refundGuestThb = Math.round(((safe * percent) / 100) * 100) / 100;
  return { refundGuestThb, percent, hoursBefore: hours, policy };
}
