/**
 * Stage 175.3–175.4 — SSOT payment window after host invoice / special offer (Airbnb-class).
 * Transport: 20 min. Housing & other verticals: 3 hours.
 */

import { isTransportListingCategory } from '../listing-category-slug.js'
import { getUIText } from '@/lib/translations'

/** @typedef {'transport' | 'default'} PaymentWindowTier */

export const PAYMENT_WINDOW_TRANSPORT_MINUTES = 20
export const PAYMENT_WINDOW_DEFAULT_MINUTES = 180
/** Legacy invoices without metadata (pre–Stage 175.3). */
export const LEGACY_INVOICE_EXPIRY_MINUTES = 24 * 60

/**
 * @param {string | null | undefined} categorySlug — `categories.slug` or listing metadata slug
 * @returns {number} Minutes until unpaid invoice / hold expires
 */
export function resolvePaymentWindowMinutes(categorySlug) {
  if (isTransportListingCategory(categorySlug)) {
    return PAYMENT_WINDOW_TRANSPORT_MINUTES
  }
  return PAYMENT_WINDOW_DEFAULT_MINUTES
}

/**
 * @param {string | null | undefined} categorySlug
 * @returns {PaymentWindowTier}
 */
export function resolvePaymentWindowTier(categorySlug) {
  return isTransportListingCategory(categorySlug) ? 'transport' : 'default'
}

/**
 * @param {string | number | Date} dateIso
 * @param {number} minutes
 * @returns {string | null}
 */
export function addMinutesToIso(dateIso, minutes) {
  const baseMs = Date.parse(String(dateIso || ''))
  if (!Number.isFinite(baseMs) || !Number.isFinite(minutes)) return null
  return new Date(baseMs + minutes * 60 * 1000).toISOString()
}

/**
 * @param {string | null | undefined} categorySlug
 * @param {string | number | Date} [anchorIso] — default now
 * @returns {string} ISO UTC expiry
 */
export function resolvePaymentWindowExpiresAt(categorySlug, anchorIso = new Date().toISOString()) {
  const anchorMs = Date.parse(String(anchorIso || ''))
  const baseMs = Number.isFinite(anchorMs) ? anchorMs : Date.now()
  const minutes = resolvePaymentWindowMinutes(categorySlug)
  return new Date(baseMs + minutes * 60 * 1000).toISOString()
}

/**
 * SSOT invoice payment deadline (cron, checkout hold, payment intents).
 * @param {object | null | undefined} invoiceRow
 * @param {{ legacyFallbackMinutes?: number }} [options]
 * @returns {string | null}
 */
export function resolveInvoicePaymentExpiresAtIso(invoiceRow, options = {}) {
  if (!invoiceRow) return null
  const meta =
    invoiceRow?.metadata && typeof invoiceRow.metadata === 'object' ? invoiceRow.metadata : {}
  const fromMeta = meta?.expires_at || meta?.invoice?.expires_at || null
  if (fromMeta) return String(fromMeta)

  const holdMinutes = Number(meta?.hold_minutes)
  if (Number.isFinite(holdMinutes) && holdMinutes > 0) {
    return addMinutesToIso(invoiceRow?.created_at, holdMinutes)
  }

  const holdHours = Number(meta?.hold_hours)
  if (Number.isFinite(holdHours) && holdHours > 0) {
    return addMinutesToIso(invoiceRow?.created_at, holdHours * 60)
  }

  const fallback = Number(options.legacyFallbackMinutes ?? LEGACY_INVOICE_EXPIRY_MINUTES)
  return addMinutesToIso(invoiceRow?.created_at, fallback)
}

/**
 * @param {object | null | undefined} booking
 * @returns {string | null}
 */
export function readBookingCheckoutHoldExpiresAt(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const raw =
    meta.checkout_hold_expires_at ||
    meta.chat_invoice_expires_at ||
    meta.invoice_expires_at ||
    null
  return raw ? String(raw) : null
}

/**
 * @param {object | null | undefined} booking
 * @returns {boolean}
 */
export function isChatInvoiceCheckoutBooking(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  return Boolean(
    meta.chat_invoice_id ||
      meta.chat_invoice_special_offer ||
      meta.chat_invoice_expires_at ||
      meta.checkout_hold_expires_at,
  )
}

/**
 * Guest-facing system copy when host sends a payable invoice (Stage 175.4 i18n).
 * @param {string | null | undefined} categorySlug
 * @param {string} [lang]
 * @returns {string}
 */
export function buildInvoicePaymentWindowSystemMessage(categorySlug, lang = 'ru') {
  const key = isTransportListingCategory(categorySlug)
    ? 'invoicePaymentWindow_notice_transport'
    : 'invoicePaymentWindow_notice_default'
  return getUIText(key, lang)
}

export default {
  PAYMENT_WINDOW_TRANSPORT_MINUTES,
  PAYMENT_WINDOW_DEFAULT_MINUTES,
  LEGACY_INVOICE_EXPIRY_MINUTES,
  resolvePaymentWindowMinutes,
  resolvePaymentWindowTier,
  addMinutesToIso,
  resolvePaymentWindowExpiresAt,
  resolveInvoicePaymentExpiresAtIso,
  readBookingCheckoutHoldExpiresAt,
  isChatInvoiceCheckoutBooking,
  buildInvoicePaymentWindowSystemMessage,
}
