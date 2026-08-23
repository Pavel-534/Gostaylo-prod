/**
 * Stage 189.38 — push token hygiene helpers (platform-aware silent probe skip).
 */

/**
 * @param {object|null|undefined} deviceInfo
 * @returns {boolean}
 */
export function shouldSkipSilentBadgeHygieneProbe(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') return false
  const surface = String(deviceInfo.surface || '')
  if (surface === 'ios_pwa') return true
  const ua = String(deviceInfo.userAgent || deviceInfo.user_agent || '')
  const platform = String(deviceInfo.platform || '')
  if (/iPad|iPhone|iPod/i.test(ua)) return true
  if (/iPad|iPhone|iPod/i.test(platform)) return true
  if (platform === 'MacIntel' && /Mobile/i.test(ua)) return true
  return false
}

/**
 * Skip recently active tokens — client ping keeps last_seen_at fresh.
 * @param {string|null|undefined} lastSeenAtIso
 * @param {number} [minAgeHours]
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function shouldSkipHygieneByRecentActivity(lastSeenAtIso, minAgeHours = 48, nowMs = Date.now()) {
  if (!lastSeenAtIso) return false
  const ts = Date.parse(String(lastSeenAtIso))
  if (!Number.isFinite(ts)) return false
  const minAgeMs = minAgeHours * 60 * 60 * 1000
  return nowMs - ts < minAgeMs
}
