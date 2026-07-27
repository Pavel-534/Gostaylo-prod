/**
 * Stage 196.0-C — Thread trip strip + order deep-link SSOT for chat deal panel.
 */

import { format } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { isBookingPayable } from '@/lib/booking/booking-status-rules'
import { readGuestPaymentDisplay } from '@/lib/booking/guest-payment-display.js'

/**
 * @param {unknown} status
 * @param {string} [language='ru']
 * @param {(key: string, lang: string) => string} [getUIText]
 */
export function formatChatBookingStatusLabel(status, language = 'ru', getUIText) {
  const s = String(status || '').trim().toUpperCase()
  if (!s) return ''
  if (typeof getUIText === 'function') {
    const key = `chatBookingStatus_${s}`
    const translated = getUIText(key, language)
    if (translated && translated !== key) return translated
  }
  return s
}

function fmtShortDate(iso, language) {
  if (!iso) return null
  try {
    return format(new Date(iso), 'd MMM', {
      locale: language !== 'en' && language !== 'zh' && language !== 'th' ? ruLocale : undefined,
    })
  } catch {
    return null
  }
}

/**
 * Compact strip lines for chat header.
 * @param {{ booking?: object|null, language?: string, isHosting?: boolean, getUIText?: Function }} args
 */
export function buildThreadTripStripModel({
  booking = null,
  language = 'ru',
  isHosting = false,
  getUIText,
} = {}) {
  if (!booking?.id) return null
  const checkIn = booking.check_in || booking.checkIn
  const checkOut = booking.check_out || booking.checkOut
  const a = fmtShortDate(checkIn, language)
  const b = fmtShortDate(checkOut, language)
  const datesLabel = a && b ? `${a} – ${b}` : a || b || ''
  const statusLabel = formatChatBookingStatusLabel(booking.status, language, getUIText)

  let amountLabel = ''
  if (isHosting) {
    const snap =
      booking.financial_snapshot && typeof booking.financial_snapshot === 'object'
        ? booking.financial_snapshot
        : null
    const earnings =
      snap?.partner_earnings_thb ??
      booking.partner_earnings_thb ??
      booking.partnerEarningsThb ??
      booking.total_price_thb ??
      booking.totalPriceThb ??
      null
    if (earnings != null && earnings !== '') {
      amountLabel = `${Number(earnings).toLocaleString()} THB`
    }
  } else {
    amountLabel = readGuestPaymentDisplay(booking, { language })?.displayAmount || ''
    if (!amountLabel) {
      const guestTotal =
        booking.financial_snapshot?.guest_total_thb ??
        booking.total_price_thb ??
        booking.totalPriceThb ??
        booking.price_thb ??
        booking.priceThb ??
        null
      if (guestTotal != null && guestTotal !== '' && Number.isFinite(Number(guestTotal))) {
        amountLabel = `${Number(guestTotal).toLocaleString()} THB`
      }
    }
  }

  if (!datesLabel && !statusLabel && !amountLabel) return null

  return {
    bookingId: String(booking.id),
    datesLabel,
    statusLabel,
    amountLabel,
    status: String(booking.status || '').toUpperCase(),
  }
}

/**
 * Guest → my-bookings (or checkout if payable). Host → partner bookings.
 * Prefers existing `?booking=` deep-link SSOT; `highlight` accepted as alias on my-bookings.
 * @param {{ booking?: object|null, isHosting?: boolean }} args
 * @returns {string|null}
 */
export function resolveChatOrderDeepLink({ booking = null, isHosting = false } = {}) {
  const id = booking?.id != null ? String(booking.id).trim() : ''
  if (!id) return null
  const status = booking?.status
  if (!isHosting && isBookingPayable(status)) {
    return `/checkout/${encodeURIComponent(id)}`
  }
  if (isHosting) {
    return `/partner/bookings?booking=${encodeURIComponent(id)}`
  }
  return `/my-bookings?booking=${encodeURIComponent(id)}&highlight=${encodeURIComponent(id)}`
}
