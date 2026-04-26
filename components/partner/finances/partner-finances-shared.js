/**
 * Stage 54.0 — shared constants/helpers for partner finances UI.
 */
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'

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

export const PAYOUT_STATUS_LABEL = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Paid',
  PAID: 'Paid',
  FAILED: 'Failed',
  REJECTED: 'Rejected',
  REFUNDED: 'Refunded',
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

export const STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-green-100 text-green-800 border-green-200',
  PAID_ESCROW: 'bg-teal-100 text-teal-800 border-teal-200',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  REFUNDED: 'bg-slate-100 text-slate-800 border-slate-200',
}

/** Partner finances: four UX income streams. */
export function partnerFinancesIncomeDisplayKind(categorySlug) {
  const st = inferListingServiceTypeFromCategorySlug(categorySlug || '')
  if (st === 'transport') return 'transport'
  if (st === 'stay') return 'stay'
  if (st === 'tour') return 'tour'
  return 'service'
}
