/**
 * Stage 200.79 — Instant Book × calendar policy (client-safe; no Node-only imports).
 */

import { isIcalSyncSourceEnabled } from '@/lib/ical-sync-source-enabled.js'

/** Stale sync window: feed not successfully refreshed (partner broken URL / empty). */
export const ICAL_INSTANT_BREAKER_STALE_MS = 4 * 60 * 60 * 1000

export const EXCLUSIVE_MANUAL_CALENDAR_META_KEY = 'exclusive_manual_calendar'

/**
 * @param {unknown} syncSettings
 * @returns {boolean}
 */
export function listingHasEnabledIcalSources(syncSettings) {
  const sources = syncSettings?.sources
  if (!Array.isArray(sources) || sources.length === 0) return false
  return sources.some((s) => isIcalSyncSourceEnabled(s) && String(s?.url || '').trim())
}

/**
 * Partner-side feed failures (remote URL / parse). Not our DB write / platform outage.
 * @param {string | null | undefined} errorMessage
 * @returns {boolean}
 */
export function isPartnerIcalFeedError(errorMessage) {
  const msg = String(errorMessage || '').trim()
  if (!msg) return false
  if (/^HTTP\s+[45]\d\d/i.test(msg)) return true
  if (/Invalid iCal format/i.test(msg)) return true
  if (/^Timeout$/i.test(msg) || /aborted|AbortError|fetch failed|network/i.test(msg)) return true
  if (/iCal parse failed/i.test(msg)) return true
  if (/No URL/i.test(msg)) return true
  if (/Fetch failed/i.test(msg)) return true
  return false
}

/**
 * Our platform write / infra failures — do not blame partner feed.
 * @param {string | null | undefined} errorMessage
 * @returns {boolean}
 */
export function isPlatformIcalSyncError(errorMessage) {
  const msg = String(errorMessage || '').trim()
  if (!msg) return false
  if (/Write failed/i.test(msg)) return true
  if (/replace_calendar|RPC|PGRST|supabase|permission denied|JWT/i.test(msg)) return true
  return !isPartnerIcalFeedError(msg) && /failed|error/i.test(msg)
}

/**
 * @param {object|null|undefined} metadata
 * @returns {boolean}
 */
export function hasExclusiveManualCalendarAck(metadata) {
  const m = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
  return m[EXCLUSIVE_MANUAL_CALENDAR_META_KEY] === true
}

/**
 * Instant Book without iCal requires exclusive/manual ack.
 * @param {{ instantBooking?: boolean, metadata?: object, syncSettings?: object }} args
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function assertInstantBookingCalendarPolicy({
  instantBooking = false,
  metadata = null,
  syncSettings = null,
} = {}) {
  if (!instantBooking) return { ok: true }
  if (listingHasEnabledIcalSources(syncSettings)) return { ok: true }
  if (hasExclusiveManualCalendarAck(metadata)) return { ok: true }
  return { ok: false, code: 'INSTANT_BOOKING_NEEDS_ICAL_OR_EXCLUSIVE_ACK' }
}
