/**
 * Stage 20.0–21.0 — SSOT for partner "active hours" vs quiet window (fair SLA + future channels).
 *
 * Storage archaeology:
 * - `profiles.quiet_mode_enabled`, `quiet_hour_start`, `quiet_hour_end` (TIME / HH:MM) — same as push / settings UI.
 * - Listing has no dedicated DB timezone column; calendar SSOT is `getListingDateTimeZone()` (env LISTING_DATE_TZ).
 * - Optional future: `listings.metadata.timezone` (IANA string) overrides listing TZ when present and valid.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getListingDateTimeZone } from '@/lib/listing-date'
import {
  LISTING_QUIET_DEFAULT_END,
  LISTING_QUIET_DEFAULT_START,
} from '@/lib/config/availability-quiet-defaults'
import { canRenterUseEmergencyContactBooking } from '@/lib/emergency-contact-eligibility'

const IANA_RE = /^[A-Za-z_]+\/[A-Za-z0-9_+\-]+$/

export function normalizeQuietHour(value, fallback) {
  const src = String(value || '').trim()
  const m = src.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return fallback
  const hh = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return fallback
  }
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function parseQuietHourToMinutes(value, fallback) {
  const v = normalizeQuietHour(value, fallback)
  const [hh, mm] = v.split(':').map((n) => parseInt(n, 10))
  return hh * 60 + mm
}

export function getLocalMinutesInTimezone(ianaTimeZone, atMs = Date.now()) {
  const tz = typeof ianaTimeZone === 'string' && ianaTimeZone.trim() ? ianaTimeZone.trim() : 'UTC'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).formatToParts(new Date(atMs))
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '', 10)
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '', 10)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return hour * 60 + minute
  } catch {
    return null
  }
}

export function isInsideQuietWindow(localMinutes, startMinutes, endMinutes) {
  if (!Number.isFinite(localMinutes) || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return false
  }
  if (startMinutes === endMinutes) return true
  if (startMinutes < endMinutes) {
    return localMinutes >= startMinutes && localMinutes < endMinutes
  }
  return localMinutes >= startMinutes || localMinutes < endMinutes
}

/**
 * Milliseconds of [t0Ms, t1Ms) that fall inside the daily quiet window in `ianaTz`.
 * Uses per-minute sampling (safe for SLA max ~7d).
 * @param {number} t0Ms
 * @param {number} t1Ms
 * @param {string} ianaTz
 * @param {string} startHm "HH:MM"
 * @param {string} endHm "HH:MM"
 */
export function countQuietOverlapMs(t0Ms, t1Ms, ianaTz, startHm, endHm) {
  if (!Number.isFinite(t0Ms) || !Number.isFinite(t1Ms) || t1Ms <= t0Ms) return 0
  const span = Math.min(t1Ms - t0Ms, 8 * 24 * 60 * 60 * 1000)
  const end = t0Ms + span
  const startMin = parseQuietHourToMinutes(startHm, LISTING_QUIET_DEFAULT_START)
  const endMin = parseQuietHourToMinutes(endHm, LISTING_QUIET_DEFAULT_END)
  const tz = typeof ianaTz === 'string' && ianaTz.trim() ? ianaTz.trim() : 'UTC'
  let quietMs = 0
  const step = 60 * 1000
  for (let t = t0Ms; t < end; t += step) {
    const local = getLocalMinutesInTimezone(tz, t)
    if (local == null) continue
    if (isInsideQuietWindow(local, startMin, endMin)) quietMs += Math.min(step, end - t)
  }
  return Math.min(quietMs, span)
}

export function resolveListingIanaTimezone(listing) {
  const meta = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const raw = meta.timezone != null ? String(meta.timezone).trim() : ''
  if (raw && IANA_RE.test(raw)) return raw
  return getListingDateTimeZone()
}

/**
 * @param {string} partnerId
 * @param {{ listing?: object | null, listingId?: string | null, bookingId?: string | null }} [opts]
 * @returns {Promise<{ ianaTimeZone: string, quietStartHm: string, quietEndHm: string, personalized: boolean }>}
 */
export async function resolvePartnerQuietContext(partnerId, opts = {}) {
  const pid = String(partnerId || '').trim()
  let listing = opts.listing || null
  if (!listing?.metadata && opts.listingId && supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('listings')
      .select('id, metadata')
      .eq('id', String(opts.listingId))
      .maybeSingle()
    listing = data || null
  }
  if (!listing?.metadata && opts.bookingId && supabaseAdmin) {
    const { data: b } = await supabaseAdmin
      .from('bookings')
      .select('listing_id')
      .eq('id', String(opts.bookingId))
      .maybeSingle()
    if (b?.listing_id) {
      const { data: l } = await supabaseAdmin
        .from('listings')
        .select('id, metadata')
        .eq('id', String(b.listing_id))
        .maybeSingle()
      listing = l || null
    }
  }

  const ianaTimeZone = resolveListingIanaTimezone(listing || {})

  let personalized = false
  let quietStartHm = LISTING_QUIET_DEFAULT_START
  let quietEndHm = LISTING_QUIET_DEFAULT_END

  if (pid && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('quiet_mode_enabled, quiet_hour_start, quiet_hour_end')
      .eq('id', pid)
      .maybeSingle()
    if (!error && data?.quiet_mode_enabled === true) {
      personalized = true
      quietStartHm = normalizeQuietHour(data.quiet_hour_start, LISTING_QUIET_DEFAULT_START)
      quietEndHm = normalizeQuietHour(data.quiet_hour_end, LISTING_QUIET_DEFAULT_END)
    }
  }

  return { ianaTimeZone, quietStartHm, quietEndHm, personalized }
}

/**
 * Whether the partner is inside the listing-TZ quiet window **right now** (for emergency UI / bypass).
 * @param {string} partnerId
 * @param {{ listing?: object | null, listingId?: string | null, bookingId?: string | null }} [opts]
 */
export async function isPartnerInQuietHoursNow(partnerId, opts = {}) {
  const ctx = await resolvePartnerQuietContext(partnerId, opts)
  const local = getLocalMinutesInTimezone(ctx.ianaTimeZone)
  if (local == null) return false
  const startMin = parseQuietHourToMinutes(ctx.quietStartHm, LISTING_QUIET_DEFAULT_START)
  const endMin = parseQuietHourToMinutes(ctx.quietEndHm, LISTING_QUIET_DEFAULT_END)
  return isInsideQuietWindow(local, startMin, endMin)
}

/**
 * Raw wall-clock delay minus time spent inside quiet window (fair SLA).
 * @param {number} anchorMs
 * @param {number} replyMs
 * @param {{ ianaTimeZone: string, quietStartHm: string, quietEndHm: string }} ctx
 */
export function adjustResponseDelayMsForQuietHours(anchorMs, replyMs, ctx) {
  const raw = replyMs - anchorMs
  if (!Number.isFinite(raw) || raw <= 0) return raw
  const q = countQuietOverlapMs(anchorMs, replyMs, ctx.ianaTimeZone, ctx.quietStartHm, ctx.quietEndHm)
  return Math.max(0, raw - q)
}

/**
 * Stage 21.0 + 24.0 — «Красная кнопка» (сервер): арендатор = владелец брони + окно жизненного цикла
 * по **`canRenterUseEmergencyContactBooking`** (шире спора: до услуги, без «48 ч до заезда»).
 * Видимость кнопки в UI по тихим часам — отдельно (**`isPartnerInQuietHoursNow`** + клиентский **`GET .../emergency-context`**).
 * @param {{ actorRole?: string, userId?: string, booking?: Record<string, unknown> }} context
 */
export function isEmergencyBypassAllowed(context = {}) {
  const role = String(context.actorRole || '').toLowerCase()
  if (role !== 'renter') return false
  const uid = String(context.userId || '').trim()
  const booking = context.booking && typeof context.booking === 'object' ? context.booking : {}
  const renterId = String(booking.renter_id ?? booking.renterId ?? '').trim()
  if (!uid || !renterId || renterId !== uid) return false
  const status = booking.status ?? booking.Status ?? ''
  const checkOut = booking.check_out ?? booking.checkOut ?? null
  const elig = canRenterUseEmergencyContactBooking({
    status: String(status || ''),
    checkOutIso: checkOut,
  })
  return elig.allowed === true
}

export const AvailabilityService = {
  normalizeQuietHour,
  parseQuietHourToMinutes,
  getLocalMinutesInTimezone,
  isInsideQuietWindow,
  countQuietOverlapMs,
  resolveListingIanaTimezone,
  resolvePartnerQuietContext,
  isPartnerInQuietHoursNow,
  adjustResponseDelayMsForQuietHours,
  isEmergencyBypassAllowed,
}

export default AvailabilityService
