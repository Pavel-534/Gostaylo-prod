/**
 * Тело .ics для all-day проживания (DTEND exclusive = дата выезда из брони).
 */

export function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function ymdToIcsDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return ymd.replace(/-/g, '')
}

/**
 * @param {{ title: string, location?: string, details?: string, startYmd: string, endYmd: string, bookingId?: string, siteHost?: string }} p
 */
export function buildStayIcsBody(p) {
  const dtStart = ymdToIcsDate(p.startYmd)
  const dtEnd = ymdToIcsDate(p.endYmd)
  if (!dtStart || !dtEnd) return null

  const site = (p.siteHost || 'gostaylo').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const uid = p.bookingId ? `booking-${p.bookingId}@${site}` : `stay-${dtStart}-${dtEnd}-${Date.now()}@${site}`
  const now = new Date()
  const stamp =
    now.getUTCFullYear().toString().padStart(4, '0') +
    (now.getUTCMonth() + 1).toString().padStart(2, '0') +
    now.getUTCDate().toString().padStart(2, '0') +
    'T' +
    now.getUTCHours().toString().padStart(2, '0') +
    now.getUTCMinutes().toString().padStart(2, '0') +
    now.getUTCSeconds().toString().padStart(2, '0') +
    'Z'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoStayLo//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${icsEscape(p.title)}`,
    p.location ? `LOCATION:${icsEscape(p.location)}` : null,
    p.details ? `DESCRIPTION:${icsEscape(p.details)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n') + '\r\n'
}
