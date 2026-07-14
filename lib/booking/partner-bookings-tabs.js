/**
 * Partner bookings list — status tab buckets (Stage 185.0 Phase 1).
 * SSOT for client-side filtering on /partner/bookings.
 */

/** @typedef {'all' | 'action_required' | 'active' | 'completed' | 'cancelled'} PartnerBookingTabId */

export const PARTNER_BOOKING_TAB_IDS = /** @type {const} */ ([
  'action_required',
  'active',
  'completed',
  'cancelled',
  'all',
])

const ACTION_REQUIRED = new Set(['PENDING', 'INQUIRY'])
const ACTIVE = new Set([
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
  'THAW_HOLD',
  'READY_FOR_PAYOUT',
])
const COMPLETED = new Set(['COMPLETED', 'FINISHED'])
const CANCELLED = new Set(['CANCELLED', 'DECLINED', 'REFUNDED'])

function normalizeStatus(booking) {
  return String(booking?.status || '').toUpperCase()
}

/** @param {string} status */
export function partnerBookingTabForStatus(status) {
  const st = String(status || '').toUpperCase()
  if (ACTION_REQUIRED.has(st)) return 'action_required'
  if (CANCELLED.has(st)) return 'cancelled'
  if (COMPLETED.has(st)) return 'completed'
  if (ACTIVE.has(st)) return 'active'
  return 'all'
}

/** @param {object | null | undefined} booking */
export function tabForPartnerBookingDeepLink(booking) {
  if (!booking) return 'all'
  return partnerBookingTabForStatus(booking.status)
}

/** @param {object[]} bookings @param {PartnerBookingTabId} tab */
export function filterPartnerBookingsByTab(bookings, tab) {
  const list = Array.isArray(bookings) ? bookings : []
  if (tab === 'all') return list
  return list.filter((b) => partnerBookingTabForStatus(b.status) === tab)
}

/** @param {object[]} bookings */
export function countPartnerBookingsByTab(bookings) {
  const list = Array.isArray(bookings) ? bookings : []
  return {
    all: list.length,
    action_required: list.filter((b) => ACTION_REQUIRED.has(normalizeStatus(b))).length,
    active: list.filter((b) => ACTIVE.has(normalizeStatus(b))).length,
    completed: list.filter((b) => COMPLETED.has(normalizeStatus(b))).length,
    cancelled: list.filter((b) => CANCELLED.has(normalizeStatus(b))).length,
  }
}

/** i18n key for tab label */
export function partnerBookingTabLabelKey(tab) {
  switch (tab) {
    case 'action_required':
      return 'partnerBookings_tabActionRequired'
    case 'active':
      return 'partnerBookings_tabActive'
    case 'completed':
      return 'partnerBookings_tabCompleted'
    case 'cancelled':
      return 'partnerBookings_tabCancelled'
    default:
      return 'all'
  }
}
