/**
 * Stage 54.0 — shared constants/helpers for partner finances UI.
 * Status colors/labels: SSOT `lib/booking/booking-status-display.js` (Stage 100).
 */
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import {
  STATUS_COLORS,
  getBookingStatusBadgeClass,
  resolveBookingUiStatus,
  resolveBookingStatusBadge,
} from '@/lib/booking/booking-status-display'

export {
  STATUS_COLORS,
  getBookingStatusBadgeClass,
  resolveBookingUiStatus,
  resolveBookingStatusBadge,
}

/** SSOT amounts from API `financial_snapshot` (Stage 45.3). */
export function snapshotMoney(booking) {
  const s = booking?.financial_snapshot
  if (s && typeof s === 'object' && Number.isFinite(Number(s.gross))) {
    return {
      gross: Number(s.gross) || 0,
      fee: Number(s.fee) || 0,
      net: Number(s.net) || 0,
    }
  }
  return { gross: 0, fee: 0, net: 0 }
}

export const PAYOUT_STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-900 border-amber-200',
  PROCESSING: 'bg-sky-100 text-sky-900 border-sky-200',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  PAID: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  FAILED: 'bg-red-100 text-red-900 border-red-200',
  REJECTED: 'bg-rose-100 text-rose-900 border-rose-200',
  REFUNDED: 'bg-slate-100 text-slate-800 border-slate-200',
}

/**
 * Stage 194.0-C — payout status label via getUIText SSOT (`partnerFinances_payoutStatus_*`).
 * @param {string} status
 * @param {(key: string) => string} t
 */
export function resolvePayoutStatusLabel(status, t) {
  const st = String(status || '').toUpperCase()
  if (!st) return '—'
  const key = `partnerFinances_payoutStatus_${st}`
  const label = typeof t === 'function' ? t(key) : key
  return label && label !== key ? label : st
}

/** Partner finances: four UX income streams. */
export function partnerFinancesIncomeDisplayKind(categorySlug) {
  const st = inferListingServiceTypeFromCategorySlug(categorySlug || '')
  if (st === 'transport') return 'transport'
  if (st === 'stay') return 'stay'
  if (st === 'tour') return 'tour'
  return 'service'
}

