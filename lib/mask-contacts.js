/**
 * maskContactInfo — маскирует телефоны, email, Telegram-юзернеймы
 * в тексте сообщения, если бронирование ещё не оплачено.
 *
 * Используйте на фронтенде при рендеринге текста сообщения.
 *
 * @param {string} text
 * @returns {string}
 */

const MASK_LABEL = '[контакт скрыт до оплаты]'

// ─── Паттерны ──────────────────────────────────────────────────────────────
const PATTERNS = [
  // Email
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  // Телефон: +7/8/международный, различные разделители
  /(\+?[0-9]{1,3}[\s\-.]?)?(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2})/g,
  // Telegram @username (минимум 5 символов — по правилам Telegram)
  /@[A-Za-z][A-Za-z0-9_]{4,}/g,
  // WhatsApp / Viber ссылки
  /https?:\/\/(wa\.me|api\.whatsapp\.com|viber\.click)\/[^\s]*/gi,
]

export function maskContactInfo(text) {
  if (!text) return text
  let result = String(text)
  for (const re of PATTERNS) {
    // Сбрасываем lastIndex перед каждым применением
    re.lastIndex = 0
    result = result.replace(re, MASK_LABEL)
  }
  return result
}

/**
 * Возвращает true, если бронирование считается оплаченным (маскировка не нужна).
 * @param {string|undefined} bookingStatus
 */
export function isBookingPaid(bookingStatus) {
  const s = String(bookingStatus || '').toUpperCase()
  return s === 'PAID' || s === 'COMPLETED' || s === 'CHECKED_IN' || s === 'CHECKED_OUT'
}
