/**
 * Shared text helpers for notification channels (HTML/Telegram/plain).
 * Stage 2.2
 */

import { readGuestPaymentDisplay } from '@/lib/booking/guest-payment-display.js'

/** JSONB / odd client payloads must not break Telegram/HTML builders */
export function bookingSpecialRequestsSnippet(raw, maxLen = 120) {
  if (raw == null || raw === '') return '';
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export function escapeTelegramHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Guest order total for notifications — SSOT `readGuestPaymentDisplay`. */
export function formatBookingAmountForNotify(booking, totalPriceThb, language = 'ru') {
  const row = readGuestPaymentDisplay(booking, { language })
  if (row?.displayAmount && row.displayAmount !== '—') {
    return row.displayAmount
  }
  const total = Number(totalPriceThb)
  if (Number.isFinite(total) && total > 0) {
    return `฿${total.toLocaleString('ru-RU')}`
  }
  return '—'
}
