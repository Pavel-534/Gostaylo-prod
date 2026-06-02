/**
 * Stage 108.1 / 108.4 — SSOT переходов статуса брони (P0-2, P1-1, P1-6).
 * Наборы для фильтров — `lib/booking/status-sets.js` (Stage 110.2).
 *
 * ## CHECKED_IN ≠ THAWED (не смешивать в UI и support)
 *
 * | Статус | Кто меняет | Смысл для владельца |
 * |--------|------------|---------------------|
 * | **CHECKED_IN** | Гость (`POST …/check-in/confirm`) или staff/partner → COMPLETED | «Гость заехал» — операционный факт, **деньги остаются в эскроу** |
 * | **THAWED** | Cron `escrow-thaw` | «Деньги разморожены» по правилам категории — **не** то же самое, что заезд |
 * | **READY_FOR_PAYOUT** | Cron `promote-ready-for-payout` | Готово включить в пул выплат (после 24h hold) |
 *
 * Выплата prod: PayoutBatchService + ручной банк, не legacy `processPayout`.
 */

/** @typedef {string} BookingStatusCode */

/**
 * Переходы, которые партнёр (или staff PUT через BookingService) может инициировать.
 * @type {Record<BookingStatusCode, BookingStatusCode[]>}
 */
export const PARTNER_BOOKING_STATUS_TRANSITIONS = Object.freeze({
  PENDING: ['CONFIRMED', 'CANCELLED'],
  INQUIRY: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  AWAITING_PAYMENT: ['CANCELLED'],
  PAID: ['COMPLETED', 'REFUNDED'],
  /** Funds in escrow until category thaw cron sets THAWED */
  PAID_ESCROW: ['REFUNDED', 'CANCELLED'],
  /** Guest checked in — does NOT replace escrow thaw */
  CHECKED_IN: ['COMPLETED', 'REFUNDED'],
  THAWED: ['COMPLETED', 'REFUNDED'],
  /** Set by cron only — partner cannot PUT this status */
  READY_FOR_PAYOUT: [],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
})

/**
 * Системные переходы (оплата, cron, batch settle) — документация и валидация серверных job.
 * @type {Record<BookingStatusCode, BookingStatusCode[]>}
 */
export const SYSTEM_BOOKING_STATUS_TRANSITIONS = Object.freeze({
  PENDING: ['CONFIRMED', 'CANCELLED', 'AWAITING_PAYMENT'],
  INQUIRY: ['CONFIRMED', 'CANCELLED', 'AWAITING_PAYMENT'],
  CONFIRMED: ['PAID', 'PAID_ESCROW', 'CANCELLED', 'AWAITING_PAYMENT'],
  AWAITING_PAYMENT: ['PAID_ESCROW', 'CANCELLED'],
  PAID: ['PAID_ESCROW', 'COMPLETED', 'REFUNDED'],
  PAID_ESCROW: ['THAWED', 'CHECKED_IN', 'REFUNDED', 'CANCELLED'],
  CHECKED_IN: ['COMPLETED', 'REFUNDED'],
  THAWED: ['READY_FOR_PAYOUT', 'COMPLETED', 'REFUNDED'],
  READY_FOR_PAYOUT: ['COMPLETED'],
})

export {
  OCCUPYING_BOOKING_STATUSES,
  TRANSPORT_CONFIRM_STATUSES,
  TRANSPORT_PARTNER_CONFIRM_OCCUPYING_STATUSES,
  ESCROW_OR_PAYOUT_PIPELINE_STATUSES,
  occupyingStatusesInFilter,
  transportPartnerConfirmOccupyingCsv,
  transportConfirmOccupyingCsv,
  isOccupyingBookingStatus,
} from '@/lib/booking/status-sets.js'

/**
 * @param {BookingStatusCode | string | null | undefined} from
 * @param {BookingStatusCode | string | null | undefined} to
 */
export function isPartnerBookingStatusTransitionAllowed(from, to) {
  const fromSt = String(from || '').toUpperCase()
  const toSt = String(to || '').toUpperCase()
  if (!fromSt || !toSt || fromSt === toSt) return false
  const allowed = PARTNER_BOOKING_STATUS_TRANSITIONS[fromSt]
  return Array.isArray(allowed) && allowed.includes(toSt)
}

/**
 * @param {BookingStatusCode | string | null | undefined} from
 * @returns {BookingStatusCode[]}
 */
export function getAllowedPartnerBookingStatusTransitions(from) {
  const fromSt = String(from || '').toUpperCase()
  return [...(PARTNER_BOOKING_STATUS_TRANSITIONS[fromSt] || [])]
}

/** Подсказки для UI / support (P1-6). */
export const BOOKING_STATUS_OWNER_HINTS_RU = Object.freeze({
  CHECKED_IN:
    'Гость заехал. Деньги ещё в эскроу — разморозка произойдёт автоматически по расписанию.',
  THAWED: 'Средства разморожены после оплаты. До выплаты — период ожидания и подготовка пула.',
  THAW_HOLD: 'Разморозка выполнена; 24 часа удержания перед выводом партнёру.',
  READY_FOR_PAYOUT: 'Сумма готова к включению в пул выплат (понедельник / четверг).',
  PAID_ESCROW: 'Оплачено гостем; средства в эскроу до разморозки.',
})

/**
 * @param {string} status — DB или UI status
 * @returns {string|null}
 */
export function getBookingStatusOwnerHintRu(status) {
  const key = String(status || '').toUpperCase()
  return BOOKING_STATUS_OWNER_HINTS_RU[key] || null
}

/**
 * PATCH-поля для partner/staff PUT (P1-1 SSOT).
 * Не выставляет `checked_in_at` для legacy `PAID` — только для `CHECKED_IN`.
 *
 * @param {string} toStatus
 * @param {{ checkedInAt?: string, updatedAt?: string }} [metadata]
 */
export function buildPartnerBookingStatusPatch(toStatus, metadata = {}) {
  const toSt = String(toStatus || '').toUpperCase()
  const now = metadata.updatedAt || new Date().toISOString()
  const patch = { status: toSt, updated_at: now }

  if (toSt === 'CONFIRMED') {
    patch.confirmed_at = now
  } else if (toSt === 'CANCELLED') {
    patch.cancelled_at = now
  } else if (toSt === 'COMPLETED') {
    patch.completed_at = now
  } else if (toSt === 'CHECKED_IN') {
    patch.checked_in_at = metadata.checkedInAt || now
  }

  return patch
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ checkedInAt?: string }} [metadata]
 * @returns {{ ok: true, patch: object } | { ok: false, error: string }}
 */
export function validatePartnerBookingStatusTransition(from, to, metadata = {}) {
  if (!isPartnerBookingStatusTransitionAllowed(from, to)) {
    return {
      ok: false,
      error: `Cannot transition from ${from} to ${to}`,
    }
  }
  return {
    ok: true,
    patch: buildPartnerBookingStatusPatch(to, metadata),
  }
}

/**
 * @param {BookingStatusCode | string | null | undefined} from
 * @param {BookingStatusCode | string | null | undefined} to
 */
export function isSystemBookingStatusTransitionAllowed(from, to) {
  const fromSt = String(from || '').toUpperCase()
  const toSt = String(to || '').toUpperCase()
  if (!fromSt || !toSt || fromSt === toSt) return false
  const allowed = SYSTEM_BOOKING_STATUS_TRANSITIONS[fromSt]
  return Array.isArray(allowed) && allowed.includes(toSt)
}

/**
 * @param {string} from
 * @param {string} to
 * @param {{ checkedInAt?: string, updatedAt?: string, extraPatch?: object }} [metadata]
 */
export function validateSystemBookingStatusTransition(from, to, metadata = {}) {
  if (!isSystemBookingStatusTransitionAllowed(from, to)) {
    return {
      ok: false,
      error: `Cannot transition from ${from} to ${to}`,
    }
  }
  const base = buildPartnerBookingStatusPatch(to, metadata)
  const extra =
    metadata?.extraPatch && typeof metadata.extraPatch === 'object' ? metadata.extraPatch : {}
  return {
    ok: true,
    patch: { ...base, ...extra },
  }
}

/** @deprecated use PARTNER_BOOKING_STATUS_TRANSITIONS */
export const BOOKING_STATUS_TRANSITIONS = PARTNER_BOOKING_STATUS_TRANSITIONS
