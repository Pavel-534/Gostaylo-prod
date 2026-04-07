/**
 * Локализованные сообщения об ошибках бронирования (API codes).
 */
import { getUIText } from '@/lib/translations'

const CODE_TO_KEY = {
  PRICE_MISMATCH: 'bookingErr_priceMismatch',
  DATES_CONFLICT: 'bookingErr_datesConflict',
  GUESTS_EXCEED_CAPACITY: 'bookingErr_guestsExceed',
  PRICE_ATTESTATION_REQUIRED: 'bookingErr_priceAttestationRequired',
  BOOKING_MIN_TOTAL_THB: 'bookingErr_bookingMinTotal',
}

/**
 * @param {{ code?: string, error?: string } | null | undefined} data — тело ответа API
 * @param {string} [language='ru']
 * @returns {string}
 */
export function getBookingApiUserMessage(data, language = 'ru') {
  const code = data && typeof data.code === 'string' ? data.code : ''
  const key = CODE_TO_KEY[code]
  if (key) return getUIText(key, language)
  const raw = data && typeof data.error === 'string' ? data.error.trim() : ''
  if (raw) return raw
  return getUIText('bookingErr_generic', language)
}
