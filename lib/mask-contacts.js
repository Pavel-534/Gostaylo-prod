/**
 * @file lib/mask-contacts.js
 *
 * Частичная маскировка контактных данных в тексте сообщений.
 *
 * Стратегия (Airbnb-style):
 *   Телефон  +66812345678  →  +668********
 *   Email    user@mail.com →  us***@***
 *   Telegram @myhandle     →  @my******
 *   WhatsApp wa.me/668...  →  [wa/viber скрыт]
 *
 * Маскировка применяется на фронтенде при рендеринге текста сообщения
 * через mapApiMessageToRow (lib/chat/map-api-message.js).
 */

// ─── Паттерны ──────────────────────────────────────────────────────────────

// Отдельные константы позволяют сбрасывать lastIndex перед каждым вызовом
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(\+?[0-9]{1,3}[\s\-.]?)?(\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2})/g
const TG_RE    = /@[A-Za-z][A-Za-z0-9_]{4,}/g
const WA_RE    = /https?:\/\/(wa\.me|api\.whatsapp\.com|viber\.click)\/[^\s]*/gi

// ─── Функции частичного маскирования ─────────────────────────────────────

/**
 * Телефон: показываем первые 4 символа совпадения, остальные заменяем на *.
 * +66812345678 (12 символов) → +668 + ******** (8 звёздочек)
 */
function partialPhone(match) {
  const SHOW = 4
  if (match.length <= SHOW) return match  // слишком короткий — не трогаем
  return match.slice(0, SHOW) + '*'.repeat(match.length - SHOW)
}

/**
 * Email: показываем первые 2 символа локальной части + маскируем остальное.
 * user@example.com → us***@***
 */
function partialEmail(match) {
  const atIdx = match.indexOf('@')
  if (atIdx < 0) return '***@***'
  const local = match.slice(0, atIdx)
  const show = Math.min(2, local.length)
  return local.slice(0, show) + '***@***'
}

/**
 * Telegram: показываем @xx (3 символа), остальное — *.
 * @myhandle → @my*****
 */
function partialTelegram(match) {
  const SHOW = 3
  if (match.length <= SHOW) return match
  return match.slice(0, SHOW) + '*'.repeat(match.length - SHOW)
}

// ─── Публичный API ────────────────────────────────────────────────────────

/**
 * Маскирует телефоны, email, Telegram-юзернеймы и WhatsApp/Viber-ссылки
 * в тексте сообщения (частичная маскировка).
 *
 * @param {string} text
 * @returns {string}
 */
export function maskContactInfo(text) {
  if (!text) return text
  let result = String(text)

  EMAIL_RE.lastIndex = 0
  result = result.replace(EMAIL_RE, partialEmail)

  PHONE_RE.lastIndex = 0
  result = result.replace(PHONE_RE, partialPhone)

  TG_RE.lastIndex = 0
  result = result.replace(TG_RE, partialTelegram)

  WA_RE.lastIndex = 0
  result = result.replace(WA_RE, '[wa/viber скрыт]')

  return result
}

/**
 * Возвращает true, если бронирование прошло точку «гарантии» для общего UI
 * (промо-блоки, счета и т.д.): подтверждение хозяином или оплата.
 *
 * @param {string|undefined} bookingStatus
 * @returns {boolean}
 */
export function isBookingPaid(bookingStatus) {
  const s = String(bookingStatus || '').toUpperCase()
  return (
    s === 'CONFIRMED' ||
    s === 'PAID' ||
    s === 'PAID_ESCROW' ||
    s === 'THAWED' ||
    s === 'COMPLETED' ||
    s === 'CHECKED_IN' ||
    s === 'CHECKED_OUT'
  )
}

/**
 * Телефон/email в ленте чата раскрываются только после оплаты (или завершённого цикла).
 * CONFIRMED без оплаты — контакты остаются замаскированными.
 *
 * @param {string|undefined} bookingStatus
 * @returns {boolean}
 */
export function areContactsRevealedForBooking(bookingStatus) {
  const s = String(bookingStatus || '').toUpperCase()
  return (
    s === 'PAID' ||
    s === 'PAID_ESCROW' ||
    s === 'THAWED' ||
    s === 'COMPLETED' ||
    s === 'CHECKED_IN' ||
    s === 'CHECKED_OUT'
  )
}

/**
 * Человекочитаемая подсказка — почему контакт скрыт.
 * Используется в UI-тултипах и банерах (не в тексте маски).
 *
 * @param {string} [language]
 * @returns {string}
 */
export function getMaskLabel(language = 'ru') {
  if (language === 'en') return '[contact hidden until booking confirmed]'
  if (language === 'th') return '[ซ่อนข้อมูลติดต่อจนกว่าจะยืนยันการจอง]'
  if (language === 'zh') return '[联系方式在确认预订前隐藏]'
  return '[контакт скрыт до подтверждения]'
}
