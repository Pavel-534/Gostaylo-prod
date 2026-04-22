/**
 * Shared text helpers for notification channels (HTML/Telegram/plain).
 * Stage 2.2
 */

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

/** Сумма для уведомлений: в валюте брони (`price_paid`) или THB. */
export function formatBookingAmountForNotify(booking, totalPriceThb) {
  const cur = String(booking.currency || 'THB').toUpperCase();
  const paid = parseFloat(booking.price_paid);
  if (cur !== 'THB' && Number.isFinite(paid) && paid >= 0) {
    return `${paid.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${cur}`;
  }
  return `฿${totalPriceThb.toLocaleString('ru-RU')}`;
}
