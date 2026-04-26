/**
 * Stage 52.0 — тихие часы / «умная» задержка NEW_MESSAGE (FCM quiet + batch window константы).
 * Логика окна партнёра делегирует в AvailabilityService (SSOT тихого окна).
 */

import {
  resolvePartnerQuietContext,
  getLocalMinutesInTimezone,
  parseQuietHourToMinutes,
  isInsideQuietWindow,
} from '@/lib/services/availability.service'
import {
  LISTING_QUIET_DEFAULT_END,
  LISTING_QUIET_DEFAULT_START,
} from '@/lib/config/availability-quiet-defaults'

/** Окно «веб-вкладка активна» для Smart Delivery. */
export const WEB_ACTIVE_WINDOW_MS = 60_000

/** Задержка перед отправкой NEW_MESSAGE (центр ~40 с). */
export const PREMIUM_CHAT_PUSH_DELAY_MS = 40_000

export const FCM_INSTANT_PUSH_DEBUG = process.env.FCM_INSTANT_PUSH_DEBUG === '1'

export function isWebSurface(deviceInfo) {
  const di = deviceInfo && typeof deviceInfo === 'object' ? deviceInfo : {}
  if (di.surface === 'web') return true
  if (di.surface === 'native' || di.surface === 'mobile') return false
  const ua = String(di.userAgent || '')
  if (!ua) return false
  return /Mozilla|Chrome|Safari|Firefox|Edg/i.test(ua)
}

export function isWebActiveRecently(lastSeenAtIso) {
  if (!lastSeenAtIso) return false
  const t = new Date(lastSeenAtIso).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < WEB_ACTIVE_WINDOW_MS
}

/**
 * «Тихий» FCM для NEW_MESSAGE: то же окно, что fair SLA.
 * @param {string} recipientId
 * @param {Array<{ token: string, device_info?: object }>} _tokenRows
 * @param {{ bookingId?: string|null, listingId?: string|null, emergencyBypass?: boolean }} [opts]
 */
export async function resolveSilentForPushDelivery(recipientId, _tokenRows, opts = {}) {
  if (opts.emergencyBypass === true) return false
  if (!recipientId) return false
  const ctx = await resolvePartnerQuietContext(recipientId, {
    bookingId: opts.bookingId || null,
    listingId: opts.listingId || null,
  })
  const localMinutes = getLocalMinutesInTimezone(ctx.ianaTimeZone)
  if (localMinutes == null) return false
  const startMinutes = parseQuietHourToMinutes(ctx.quietStartHm, LISTING_QUIET_DEFAULT_START)
  const endMinutes = parseQuietHourToMinutes(ctx.quietEndHm, LISTING_QUIET_DEFAULT_END)
  return isInsideQuietWindow(localMinutes, startMinutes, endMinutes)
}
