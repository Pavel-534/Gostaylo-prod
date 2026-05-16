/**
 * Booking status display SSOT (Stage 100).
 * UI labels, i18n keys, badge colors. Virtual payout states: DISPUTED, THAW_HOLD.
 */

import { BookingStatus } from '@/lib/services/escrow/constants.js'
import {
  isBookingDisputePaymentFrozen,
  getBookingEscrowThawedAtMs,
  isWithdrawalHoldElapsed,
} from '@/lib/partner/partner-payout-eligibility.js'

/** @typedef {'PENDING'|'CONFIRMED'|'PAID'|'PAID_ESCROW'|'THAWED'|'THAW_HOLD'|'DISPUTED'|'READY_FOR_PAYOUT'|'COMPLETED'|'CANCELLED'|'REFUNDED'} BookingUiStatus */

/**
 * @type {Record<string, { labelKey: string, badgeClass: string, defaultRu: string, defaultEn: string }>}
 */
export const BOOKING_STATUS_DISPLAY = {
  PENDING: {
    labelKey: 'bookingStatus_pending',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    defaultRu: 'Ожидает',
    defaultEn: 'Pending',
  },
  CONFIRMED: {
    labelKey: 'bookingStatus_confirmed',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    defaultRu: 'Подтверждено',
    defaultEn: 'Confirmed',
  },
  PAID: {
    labelKey: 'bookingStatus_paid',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    defaultRu: 'Оплачено',
    defaultEn: 'Paid',
  },
  PAID_ESCROW: {
    labelKey: 'bookingStatus_paidEscrow',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
    defaultRu: 'В эскроу',
    defaultEn: 'In escrow',
  },
  THAWED: {
    labelKey: 'bookingStatus_thawed',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-200',
    defaultRu: 'Разморожено',
    defaultEn: 'Thawed',
  },
  THAW_HOLD: {
    labelKey: 'bookingStatus_thawHold',
    badgeClass: 'bg-cyan-50 text-cyan-950 border-cyan-300',
    defaultRu: 'Разморозка (24 ч)',
    defaultEn: 'Thaw hold (24h)',
  },
  DISPUTED: {
    labelKey: 'bookingStatus_disputed',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-200',
    defaultRu: 'Заблокировано спором',
    defaultEn: 'Blocked by dispute',
  },
  READY_FOR_PAYOUT: {
    labelKey: 'bookingStatus_readyForPayout',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    defaultRu: 'К выплате',
    defaultEn: 'Ready for payout',
  },
  COMPLETED: {
    labelKey: 'bookingStatus_completed',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    defaultRu: 'Завершено',
    defaultEn: 'Completed',
  },
  CANCELLED: {
    labelKey: 'bookingStatus_cancelled',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    defaultRu: 'Отменено',
    defaultEn: 'Cancelled',
  },
  REFUNDED: {
    labelKey: 'bookingStatus_refunded',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
    defaultRu: 'Возврат',
    defaultEn: 'Refunded',
  },
}

/**
 * Resolve UI status (may differ from DB status for payout UX).
 * @param {object} booking
 * @param {{ frozenBookingIds?: Set<string>, nowMs?: number }} [opts]
 * @returns {BookingUiStatus}
 */
export function resolveBookingUiStatus(booking, opts = {}) {
  const st = String(booking?.status || '').toUpperCase()
  const nowMs = opts.nowMs ?? Date.now()
  if (isBookingDisputePaymentFrozen(booking, opts.frozenBookingIds)) {
    if (st === BookingStatus.PAID_ESCROW) return st
    return 'DISPUTED'
  }
  if (st === BookingStatus.THAWED) {
    const thawMs = getBookingEscrowThawedAtMs(booking)
    if (thawMs && !isWithdrawalHoldElapsed(booking, nowMs)) return 'THAW_HOLD'
  }
  return /** @type {BookingUiStatus} */ (st || 'PENDING')
}

/**
 * @param {string} uiStatus
 */
export function getBookingStatusDisplay(uiStatus) {
  const key = String(uiStatus || '').toUpperCase()
  return (
    BOOKING_STATUS_DISPLAY[key] || {
      labelKey: 'bookingStatus_unknown',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-200',
      defaultRu: key || '—',
      defaultEn: key || '—',
    }
  )
}

/**
 * @param {string} uiStatus
 */
export function getBookingStatusBadgeClass(uiStatus) {
  return getBookingStatusDisplay(uiStatus).badgeClass
}

/**
 * @param {string} uiStatus
 * @param {(key: string) => string} [t] — i18n translate fn
 * @param {'ru'|'en'|string} [lang]
 */
export function getBookingStatusLabel(uiStatus, t, lang = 'ru') {
  const d = getBookingStatusDisplay(uiStatus)
  if (typeof t === 'function') {
    const translated = t(d.labelKey)
    if (translated && translated !== d.labelKey) return translated
  }
  return lang === 'en' ? d.defaultEn : d.defaultRu
}

/**
 * @param {object} booking
 * @param {{ frozenBookingIds?: Set<string>, t?: (k: string) => string, lang?: string }} [opts]
 */
export function resolveBookingStatusBadge(booking, opts = {}) {
  const uiStatus = resolveBookingUiStatus(booking, opts)
  return {
    uiStatus,
    dbStatus: String(booking?.status || ''),
    label: getBookingStatusLabel(uiStatus, opts.t, opts.lang),
    labelKey: getBookingStatusDisplay(uiStatus).labelKey,
    badgeClass: getBookingStatusBadgeClass(uiStatus),
  }
}

/** @deprecated use getBookingStatusBadgeClass(resolveBookingUiStatus(booking)) */
export const STATUS_COLORS = Object.fromEntries(
  Object.entries(BOOKING_STATUS_DISPLAY).map(([k, v]) => [k, v.badgeClass]),
)
