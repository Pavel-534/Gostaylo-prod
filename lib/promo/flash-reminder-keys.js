/** Bangkok calendar hour bucket for Flash reminder idempotency (Stage 38.0). */
export const BANGKOK_IANA = 'Asia/Bangkok'

/**
 * @param {number} [nowMs]
 * @returns {string} e.g. flash_1h_reminder_2026-04-24-15
 */
export function buildFlash1hReminderKey(nowMs = Date.now()) {
  const d = new Date(nowMs)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const mo = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  const hr = parts.find((p) => p.type === 'hour')?.value
  return `flash_1h_reminder_${y}-${mo}-${day}-${hr}`
}

/**
 * Start/end UTC instants for the current calendar day in Bangkok (for "today" booking counts).
 * @param {number} [nowMs]
 * @returns {{ startIso: string, endIso: string }}
 */
export function getBangkokLocalTodayUtcRange(nowMs = Date.now()) {
  const d = new Date(nowMs)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const mo = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  const dateStr = `${y}-${mo}-${day}`
  const start = new Date(`${dateStr}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}
