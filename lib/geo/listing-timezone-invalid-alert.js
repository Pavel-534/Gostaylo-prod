/**
 * AUDIT_03 W3.8 — alert once per listing+tz when metadata.timezone fails IANA check.
 * Still falls back to Asia/Bangkok (thaw behavior preserved).
 *
 * Safe to import from shared/client modules: Telegram notify is webpackIgnore'd
 * and skipped in the browser (partner finances / booking flow import thaw SSOT).
 */

export const BANGKOK_IANA = 'Asia/Bangkok'

const alertedInvalidTz = new Map()

/**
 * @param {string | null | undefined} listingId
 * @param {string} rawTz
 */
export function notifyInvalidListingTimezone(listingId, rawTz) {
  if (typeof window !== 'undefined') return

  const tz = String(rawTz || '').trim()
  if (!tz) return
  const lid = String(listingId || '').trim() || 'unknown'
  const dedupeKey = `${lid}::${tz}`
  const now = Date.now()
  const prev = alertedInvalidTz.get(dedupeKey)
  // Process-local dedupe 1h (Telegram guard also rate-limits)
  if (prev && now - prev < 60 * 60 * 1000) return
  alertedInvalidTz.set(dedupeKey, now)

  void import(
    /* webpackIgnore: true */
    '../services/system-alert-notify.js',
  )
    .then(({ notifySystemAlert, escapeSystemAlertHtml }) =>
      notifySystemAlert(
        `[CONFIG_ERROR] Invalid timezone for listing ${escapeSystemAlertHtml(lid)}: ` +
          `${escapeSystemAlertHtml(tz)}. Fallback to Bangkok applied.`,
        { severity: 'WARN' },
      ),
    )
    .catch(() => {})
}
