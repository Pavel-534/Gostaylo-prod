/**
 * Bank / currency-control compliance registry CSV (Stage 100.4).
 * SSOT for `/api/admin/finances/compliance-export` — human-readable Russian, Excel RU (`;`).
 */

import { thbToRub } from '@/lib/services/ledger/ledger-capture-legs.js'

/** Supabase select — category via `categories`, not `listings.category_slug`. */
export const COMPLIANCE_BOOKING_SELECT = `
  *,
  listings (
    title,
    category_id,
    metadata,
    categories (
      slug,
      wizard_profile
    )
  )
`

/** Delimiter for Excel (locale ru-RU). */
export const COMPLIANCE_CSV_DELIMITER = ';'

export const COMPLIANCE_REGISTRY_COLUMNS = [
  '№ бронирования',
  'Дата оплаты',
  'Объявление',
  'Тип услуги (для банка)',
  'Статус брони',
  'Оплачено гостём (бат)',
  'Валюта оплаты гостя',
  'Доход ИП РФ (руб)',
  'Доход ОсОО КР (руб)',
  'Курсовой спред (руб)',
  'К выплате хосту (бат)',
  'Курс: бат за 1 руб',
  'Онлайн-касса 54-ФЗ',
]

const PAID_STATUSES = new Set([
  'PAID_ESCROW',
  'THAWED',
  'READY_FOR_PAYOUT',
  'COMPLETED',
  'CONFIRMED',
])

const BOOKING_STATUS_RU = {
  PAID_ESCROW: 'Оплачено, в эскроу',
  THAWED: 'Разморожено (ожидание 24 ч)',
  READY_FOR_PAYOUT: 'Готово к выплате хосту',
  COMPLETED: 'Завершено',
  CONFIRMED: 'Подтверждено',
  PENDING: 'Ожидает оплаты',
  CANCELLED: 'Отменено',
}

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return ''
  return Math.round(x * 100) / 100
}

/** @param {number | ''} n */
function fmtRuNum(n) {
  if (n === '' || n == null) return ''
  const x = round2(n)
  if (x === '') return ''
  return Number(x).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function joinRow(cells) {
  return cells.map(esc).join(COMPLIANCE_CSV_DELIMITER)
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
    return 'Транспорт'
  }
  if (/(tour|tours|experience|food|dining)/.test(slug)) {
    return 'Услуги'
  }
  return 'Аренда жилья'
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
 * @param {string} iso
 * @returns {string} YYYY-MM-DD
 */
export function paymentDateYmd(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

/**
 * Filter bookings by payment date (inclusive), not booking creation date.
 * @param {object[]} bookings
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 */
export function filterBookingsByPaymentDate(bookings, from, to) {
  return (bookings || []).filter((b) => {
    const ymd = paymentDateYmd(resolvePaymentDateIso(b))
    if (!ymd) return false
    return ymd >= from && ymd <= to
  })
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

function resolveListingTitle(booking) {
  const listing = booking?.listings
  if (listing && typeof listing === 'object' && listing.title) return String(listing.title)
  const meta = booking?.metadata
  if (meta?.listing_title) return String(meta.listing_title)
  return ''
}

function resolveBookingStatusRu(booking) {
  const st = String(booking?.status || '').toUpperCase()
  return BOOKING_STATUS_RU[st] || st || '—'
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
  const payDateRu = payDate
    ? new Date(payDate).toLocaleString('ru-RU', {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  const payCur = String(booking?.currency || 'THB').toUpperCase()

  return [
    booking.id,
    payDateRu,
    resolveListingTitle(booking),
    resolveVoucherLabel(booking),
    resolveBookingStatusRu(booking),
    fmtRuNum(guestThb),
    payCur,
    rubToThb != null ? fmtRuNum(thbToRub(ruThb, rubToThb)) : '',
    rubToThb != null ? fmtRuNum(thbToRub(krThb, rubToThb)) : '',
    rubToThb != null ? fmtRuNum(thbToRub(fxThb, rubToThb)) : '',
    fmtRuNum(partnerThb),
    rubToThb != null ? fmtRuNum(rubToThb) : '',
    resolveFiscalStatusRu(booking),
  ]
}

const EMPTY_PERIOD_NOTE =
  'За выбранный период нет оплаченных броней. Проверьте даты (фильтр по дате оплаты, не создания) или укажите UUID одной брони.'

/**
 * @param {object[]} bookings
 * @param {{ from?: string, to?: string }} [opts]
 * @returns {{ csv: string, rowCount: number, isEmpty: boolean }}
 */
export function buildComplianceRegistryCsv(bookings = [], opts = {}) {
  const lines = [joinRow(COMPLIANCE_REGISTRY_COLUMNS)]
  const rows = (bookings || []).filter((b) => PAID_STATUSES.has(String(b?.status || '').toUpperCase()))

  if (!rows.length) {
    const noteRow = [EMPTY_PERIOD_NOTE, '', '', '', '', '', '', '', '', '', '', '', '']
    if (opts.from && opts.to) {
      noteRow[1] = `Период: ${opts.from} — ${opts.to}`
    }
    lines.push(joinRow(noteRow))
    return { csv: `\uFEFF${lines.join('\r\n')}`, rowCount: 0, isEmpty: true }
  }

  for (const b of rows) {
    lines.push(joinRow(bookingToRegistryRow(b)))
  }
  return { csv: `\uFEFF${lines.join('\r\n')}`, rowCount: rows.length, isEmpty: false }
}
