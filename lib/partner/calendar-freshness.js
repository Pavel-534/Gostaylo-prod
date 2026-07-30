/**
 * Stage 199.2 — calendar freshness for partner listings list (pure).
 */

/** Soft nudge when calendar / listing activity older than this many days. */
export const CALENDAR_FRESHNESS_STALE_DAYS = 14

/**
 * @param {object | null | undefined} listing
 * @returns {string | null} ISO timestamp of last known calendar/listing activity
 */
export function resolveListingCalendarActivityAt(listing) {
  if (!listing || typeof listing !== 'object') return null
  const sync = listing.syncSettings || listing.sync_settings
  const meta = listing.metadata && typeof listing.metadata === 'object' ? listing.metadata : {}
  const candidates = [
    sync && typeof sync === 'object' ? sync.last_sync || sync.lastSync || sync.lastGlobalSync : null,
    meta.last_ical_sync,
    meta.lastIcalSync,
    listing.updatedAt || listing.updated_at,
  ]
  let bestMs = NaN
  let bestIso = null
  for (const raw of candidates) {
    if (!raw) continue
    const ms = Date.parse(String(raw))
    if (!Number.isFinite(ms)) continue
    if (!Number.isFinite(bestMs) || ms > bestMs) {
      bestMs = ms
      bestIso = new Date(ms).toISOString()
    }
  }
  return bestIso
}

/**
 * @param {object | null | undefined} listing
 * @param {{ nowMs?: number, staleDays?: number }} [opts]
 * @returns {{ stale: boolean, activityAt: string | null, ageDays: number | null }}
 */
export function evaluateCalendarFreshness(listing, opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now()
  const staleDays =
    Number.isFinite(opts.staleDays) && opts.staleDays > 0
      ? Math.floor(opts.staleDays)
      : CALENDAR_FRESHNESS_STALE_DAYS

  const status = String(listing?.status || '').toUpperCase()
  const isDraft = listing?.metadata?.is_draft === true || listing?.metadata?.is_draft === 'true'
  if (isDraft || status === 'REJECTED') {
    return { stale: false, activityAt: null, ageDays: null, skipped: true }
  }

  const activityAt = resolveListingCalendarActivityAt(listing)
  if (!activityAt) {
    return { stale: true, activityAt: null, ageDays: null, skipped: false }
  }
  const activityMs = Date.parse(activityAt)
  if (!Number.isFinite(activityMs)) {
    return { stale: true, activityAt: null, ageDays: null, skipped: false }
  }
  const ageDays = (nowMs - activityMs) / (24 * 60 * 60 * 1000)
  return {
    stale: ageDays >= staleDays,
    activityAt,
    ageDays: Math.floor(ageDays),
    skipped: false,
  }
}
