/**
 * Проверка строки как IANA timezone (через Intl).
 */
export function isValidIanaTimezone(raw) {
  const tz = String(raw || '').trim()
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}
