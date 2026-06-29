/**
 * SSOT: partner master-calendar cell colors, labels, hold expiry formatting (Stage 175.1).
 */

import { format, parseISO } from 'date-fns'
import { ru, enUS, zhCN, th as thLocale } from 'date-fns/locale'
import {
  BLOCK_DISPLAY_KIND,
  isSoftHoldDisplayKind,
  resolveBlockDisplayKind,
} from '@/lib/calendar/block-source-display.js'

const DATE_FNS_LOCALE = { ru, en: enUS, zh: zhCN, th: thLocale }

/** Tailwind classes for booking nights in grid / agenda */
export const BOOKING_STATUS_CELL_CLASS = Object.freeze({
  CONFIRMED: 'bg-brand/100 text-white',
  PENDING: 'bg-amber-400 text-amber-900',
  PAID: 'bg-emerald-500 text-white',
  AWAITING_PAYMENT: 'bg-amber-300 text-amber-950 ring-1 ring-inset ring-amber-400/40',
  PAID_ESCROW: 'bg-emerald-600 text-white',
})

/** Tailwind classes for blocked nights */
export const BLOCK_KIND_CELL_CLASS = Object.freeze({
  [BLOCK_DISPLAY_KIND.MANUAL]: 'bg-slate-300 text-slate-700',
  [BLOCK_DISPLAY_KIND.ICAL]: 'bg-brand/15 text-brand border border-dashed border-brand/40',
  [BLOCK_DISPLAY_KIND.INVOICE_HOLD]:
    'bg-amber-50/95 text-amber-900 border border-amber-400/50 ring-1 ring-inset ring-amber-300/35',
  [BLOCK_DISPLAY_KIND.INQUIRY_HOLD]: 'bg-violet-100/85 text-violet-900 border border-violet-300/60',
  [BLOCK_DISPLAY_KIND.INVENTORY]: 'bg-slate-200 text-slate-500',
})

/** Agenda badge variants (higher contrast chips) */
export const BLOCK_KIND_BADGE_CLASS = Object.freeze({
  [BLOCK_DISPLAY_KIND.MANUAL]: 'bg-slate-400 text-white',
  [BLOCK_DISPLAY_KIND.ICAL]: 'bg-brand/20 text-brand border border-dashed border-brand/40',
  [BLOCK_DISPLAY_KIND.INVOICE_HOLD]: 'bg-amber-100 text-amber-900 border border-amber-400/45 ring-1 ring-inset ring-amber-200/70',
  [BLOCK_DISPLAY_KIND.INQUIRY_HOLD]: 'bg-violet-400/80 text-violet-950 border border-violet-500/40',
  [BLOCK_DISPLAY_KIND.INVENTORY]: 'bg-slate-300 text-slate-700',
})

export const BOOKING_STATUS_BADGE_CLASS = Object.freeze({
  ...BOOKING_STATUS_CELL_CLASS,
})

/**
 * @param {{ blockKind?: string, blockSource?: string }} cellData
 * @returns {string}
 */
export function resolveBlockedCellClass(cellData) {
  const kind =
    cellData?.blockKind ||
    (cellData?.blockSource ? resolveBlockDisplayKind(cellData.blockSource) : BLOCK_DISPLAY_KIND.MANUAL)
  if (kind === BLOCK_DISPLAY_KIND.INVENTORY || kind === 'inventory') {
    return BLOCK_KIND_CELL_CLASS[BLOCK_DISPLAY_KIND.INVENTORY]
  }
  return BLOCK_KIND_CELL_CLASS[kind] || BLOCK_KIND_CELL_CLASS[BLOCK_DISPLAY_KIND.MANUAL]
}

/**
 * @param {{ blockKind?: string, blockSource?: string }} cellData
 * @returns {string}
 */
export function resolveBlockedBadgeClass(cellData) {
  const kind =
    cellData?.blockKind ||
    (cellData?.blockSource ? resolveBlockDisplayKind(cellData.blockSource) : BLOCK_DISPLAY_KIND.MANUAL)
  if (kind === BLOCK_DISPLAY_KIND.INVENTORY || kind === 'inventory') {
    return BLOCK_KIND_BADGE_CLASS[BLOCK_DISPLAY_KIND.INVENTORY]
  }
  return BLOCK_KIND_BADGE_CLASS[kind] || BLOCK_KIND_BADGE_CLASS[BLOCK_DISPLAY_KIND.MANUAL]
}

/**
 * @param {string | null | undefined} bookingStatus
 * @returns {string}
 */
export function resolveBookingStatusCellClass(bookingStatus) {
  return BOOKING_STATUS_CELL_CLASS[bookingStatus] || BOOKING_STATUS_CELL_CLASS.CONFIRMED
}

/**
 * @param {string | null | undefined} bookingStatus
 * @returns {string}
 */
export function resolveBookingStatusBadgeClass(bookingStatus) {
  return BOOKING_STATUS_BADGE_CLASS[bookingStatus] || BOOKING_STATUS_BADGE_CLASS.CONFIRMED
}

export { isSoftHoldDisplayKind, BLOCK_DISPLAY_KIND }

/**
 * @param {string | null | undefined} iso
 * @param {string} [language]
 * @returns {string}
 */
export function formatBlockExpiresAt(iso, language = 'ru') {
  if (!iso) return ''
  try {
    const dfLocale = DATE_FNS_LOCALE[language] || ru
    return format(parseISO(String(iso)), 'd MMM yyyy, HH:mm', { locale: dfLocale })
  } catch {
    return String(iso)
  }
}

/**
 * @param {object} cellData
 * @param {(key: string) => string} t
 * @param {(template: string, vars: Record<string, string>) => string} trTpl
 * @param {string} [language]
 * @returns {string}
 */
export function buildBlockedCellTitle(cellData, t, trTpl, language = 'ru') {
  const kind =
    cellData?.blockKind ||
    (cellData?.blockSource ? resolveBlockDisplayKind(cellData.blockSource) : BLOCK_DISPLAY_KIND.MANUAL)
  const reason = cellData?.reason || t('partnerCal_cellTitleBlocked')
  const expiresSuffix = cellData?.blockExpiresAt
    ? ` · ${trTpl(t('partnerCal_holdExpiresAt'), {
        expires: formatBlockExpiresAt(cellData.blockExpiresAt, language),
      })}`
    : ''

  if (kind === BLOCK_DISPLAY_KIND.INVOICE_HOLD) {
    return trTpl(t('partnerCal_cellTitleInvoiceHold'), { reason }) + expiresSuffix
  }
  if (kind === BLOCK_DISPLAY_KIND.INQUIRY_HOLD) {
    return trTpl(t('partnerCal_cellTitleInquiryHold'), { reason }) + expiresSuffix
  }
  if (kind === BLOCK_DISPLAY_KIND.ICAL) {
    return trTpl(t('partnerCal_cellTitleIcalBlocked'), { reason }) + expiresSuffix
  }
  if (kind === BLOCK_DISPLAY_KIND.MANUAL) {
    return trTpl(t('partnerCal_cellTitleManualBlocked'), { reason }) + expiresSuffix
  }
  return String(reason) + expiresSuffix
}
