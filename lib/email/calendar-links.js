/**
 * Ссылки «добавить в календарь» для писем (Google, Outlook, .ics по подписанному токену).
 */

import { getPublicSiteUrl } from '@/lib/site-url'

/** @param {unknown} d */
export function ymdFromBookingDate(d) {
  const s = String(d ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/**
 * All-day stay: check-in date through morning of check-out (end date exclusive в .ics).
 * @param {{ title?: string, location?: string, description?: string, checkIn: unknown, checkOut: unknown }} p
 */
export function googleCalendarStayUrl(p) {
  const s = ymdFromBookingDate(p.checkIn)
  const e = ymdFromBookingDate(p.checkOut)
  if (!s || !e) return null
  const ds = s.replace(/-/g, '')
  const de = e.replace(/-/g, '')
  const text = encodeURIComponent((p.title || 'GoStayLo').slice(0, 300))
  const details = encodeURIComponent((p.description || '').slice(0, 2000))
  const loc = encodeURIComponent((p.location || '').slice(0, 500))
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${ds}%2F${de}&details=${details}&location=${loc}`
}

/**
 * Outlook.com (личный календарь). Для корпоративных аккаунтов пользователь может вставить событие вручную из .ics.
 */
export function outlookWebCalendarStayUrl(p) {
  const s = ymdFromBookingDate(p.checkIn)
  const e = ymdFromBookingDate(p.checkOut)
  if (!s || !e) return null
  const subject = encodeURIComponent((p.title || 'GoStayLo').slice(0, 300))
  const body = encodeURIComponent((p.description || '').slice(0, 2000))
  const loc = encodeURIComponent((p.location || '').slice(0, 500))
  const startdt = encodeURIComponent(`${s}T00:00:00`)
  const enddt = encodeURIComponent(`${e}T00:00:00`)
  return `https://outlook.live.com/calendar/0/action/compose?rru=addevent&subject=${subject}&startdt=${startdt}&enddt=${enddt}&body=${body}&location=${loc}`
}

/**
 * Скачивание .ics по подписанному токену (см. lib/calendar/calendar-stay-token.js).
 * @param {string | null | undefined} token
 */
export function stayIcsDownloadUrlFromToken(token) {
  if (!token) return null
  const base = getPublicSiteUrl()
  return `${base}/api/calendar/stay?t=${encodeURIComponent(token)}`
}
