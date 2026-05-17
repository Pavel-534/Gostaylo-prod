/**
 * Bank / currency-control compliance registry CSV (Stage 100.2).
 * SSOT column layout for `/api/admin/finances/compliance-export`.
 */

import { thbToRub } from '@/lib/services/ledger/ledger-capture-legs.js'

/** Supabase select for compliance rows — category via `categories`, not `listings.category_slug`. */
export const COMPLIANCE_BOOKING_SELECT = `
  *,
  listings (
    category_id,
    metadata,
    categories (
      slug,
      wizard_profile
    )
  )
`

export const COMPLIANCE_REGISTRY_COLUMNS = [
  'Номер_Бронирования (UUID)',
  'Дата_Оплаты',
  'Ваучер_Услуги',
  'Оплачено_Гостем_THB',
  'Доход_РФ_ИП_RUB',
  'Доход_КР_ОсОО_RUB',
  'Курсовой_Спред_RUB',
  'К_Выплате_Хосту_THB',
  'Статус_Онлайн_Кассы_54ФЗ',
]

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return ''
  return Math.round(x * 100) / 100
}

/**
 * @param {object} booking
 * @returns {string}
 */
export function resolveVoucherLabel(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const listing = booking?.listings && typeof booking.listings === 'object' ? booking.listings : {}
  const listingMeta =
    listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const slug = String(
    listing.categories?.slug ||
      meta.listing_category_slug ||
      meta.category_slug ||
      listingMeta.category_slug ||
      booking.category_slug ||
      '',
  )
    .toLowerCase()
    .trim()

  if (/(vehicle|vehicles|transport|car|moto|yacht|boat|helicopter)/.test(slug)) {
    return 'Транспорт / Transport'
  }
  if (/(tour|tours|experience|food|dining)/.test(slug)) {
    return 'Услуги / Services'
  }
  return 'Аренда жилья / Stay'
}

/**
 * THB per 1 RUB at booking time.
 * @param {object} booking
 * @param {object} [fb]
 */
export function resolveRubToThbAtBooking(booking, fb = {}) {
  const payCur = String(booking?.currency || 'THB').toUpperCase()
  const rate = Number(booking?.exchange_rate)
  if (payCur === 'RUB' && Number.isFinite(rate) && rate > 0) return rate
  const fx = Number(fb.fx_raw_rate_to_thb ?? fb.fx_customer_rate_to_thb)
  if (Number.isFinite(fx) && fx > 0) return fx
  const snapRate = Number(booking?.pricing_snapshot?.fx_raw_rate_to_thb)
  if (Number.isFinite(snapRate) && snapRate > 0) return snapRate
  return null
}

/**
 * @param {object} booking
 */
function readFinalBreakdown(booking) {
  const snap = booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object' ? booking.pricing_snapshot : {}
  if (snap.v === 2 && snap.final_breakdown) return snap.final_breakdown

  const guestThb =
    Number(booking?.price_paid) && Number(booking?.exchange_rate)
      ? Number(booking.price_paid) * Number(booking.exchange_rate)
      : Number(booking?.price_thb) || 0

  return {
    subtotal_thb: Number(booking?.price_thb) || 0,
    total_guest_payable_rounded_thb: guestThb,
    total_partner_netto_thb: Number(booking?.partner_earnings_thb) || 0,
    ru_fee_thb: Number(booking?.commission_thb) || 0,
    kr_fee_thb: 0,
    fx_markup_thb: 0,
  }
}

/**
 * @param {object} booking
 */
export function resolvePaymentDateIso(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const candidates = [
    meta.paid_at,
    meta.payment_confirmed_at,
    meta.escrow_paid_at,
    booking.paid_at,
    booking.updated_at,
    booking.created_at,
  ]
  for (const c of candidates) {
    if (c) {
      const d = new Date(c)
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
  }
  return booking.created_at || ''
}

/**
 * @param {object} booking
 * @returns {'Успешно' | 'Ошибка' | 'Не требуется' | 'В очереди'}
 */
export function resolveFiscalStatusRu(booking) {
  const meta = booking?.metadata?.fiscal || {}
  const st = String(meta.status || '').toUpperCase()
  if (['ISSUED', 'SANDBOX_MOCK'].includes(st)) return 'Успешно'
  if (st === 'SKIPPED' || st === '') {
    const snap = booking?.pricing_snapshot
    if (snap?.v !== 2) return 'Не требуется'
    if (!st) return 'В очереди'
    return 'Не требуется'
  }
  if (st === 'PENDING_FISCAL' || st === 'PENDING') return 'Ошибка'
  return 'Ошибка'
}

/**
 * @param {object} booking
 * @returns {string[]}
 */
export function bookingToRegistryRow(booking) {
  const fb = readFinalBreakdown(booking)
  const rubToThb = resolveRubToThbAtBooking(booking, fb)

  const guestThb = round2(
    fb.total_guest_payable_rounded_thb ?? fb.total_guest_payable_thb ?? booking.price_thb,
  )
  const ruThb = round2(fb.ru_fee_thb ?? 0)
  const krThb = round2(fb.kr_fee_thb ?? 0)
  const fxThb = round2(fb.fx_markup_thb ?? 0)
  const partnerThb = round2(fb.total_partner_netto_thb ?? booking.partner_earnings_thb ?? 0)

  const payDate = resolvePaymentDateIso(booking)
  const payDateRu = payDate ? new Date(payDate).toLocaleString('ru-RU', { timeZone: 'UTC' }) : ''

  return [
    booking.id,
    payDateRu,
    resolveVoucherLabel(booking),
    guestThb,
    rubToThb != null ? round2(thbToRub(ruThb, rubToThb)) : '',
    rubToThb != null ? round2(thbToRub(krThb, rubToThb)) : '',
    rubToThb != null ? round2(thbToRub(fxThb, rubToThb)) : '',
    partnerThb,
    resolveFiscalStatusRu(booking),
  ].map(esc)
}

/**
 * @param {object[]} bookings
 * @returns {string}
 */
export function buildComplianceRegistryCsv(bookings = []) {
  const lines = [COMPLIANCE_REGISTRY_COLUMNS.join(',')]
  if (!bookings.length) {
    lines.push(COMPLIANCE_REGISTRY_COLUMNS.map(() => '').join(','))
    return lines.join('\n')
  }
  for (const b of bookings) {
    lines.push(bookingToRegistryRow(b).join(','))
  }
  return `\uFEFF${lines.join('\n')}`
}
