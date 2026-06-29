/**
 * Release version SSOT — critical force-update gate (Stage 175 Silent SW).
 * Set `NEXT_PUBLIC_CRITICAL_RELEASE_VERSION` in Vercel only for breaking releases.
 */

/**
 * @returns {string}
 */
export function getAppReleaseVersion() {
  const v = String(process.env.NEXT_PUBLIC_APP_RELEASE_VERSION || '').trim()
  return v || '0'
}

/**
 * @returns {string}
 */
export function getCriticalReleaseVersion() {
  return String(process.env.NEXT_PUBLIC_CRITICAL_RELEASE_VERSION || '').trim()
}

/**
 * Parse semver-like `major.minor.patch` or plain integer build id.
 * @param {string} raw
 * @returns {number[] | null}
 */
function parseReleaseVersion(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return [parseInt(s, 10)]
  const parts = s.split('.').map((p) => parseInt(p, 10))
  if (parts.some((n) => !Number.isFinite(n))) return null
  return parts
}

/**
 * @param {string} current
 * @param {string} critical
 * @returns {number} negative if current < critical
 */
export function compareReleaseVersions(current, critical) {
  const a = parseReleaseVersion(current)
  const b = parseReleaseVersion(critical)
  if (!a || !b) return 0
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return 0
}

/**
 * True when env critical version is set and running build is strictly older.
 * @returns {boolean}
 */
export function isBelowCriticalRelease() {
  const critical = getCriticalReleaseVersion()
  if (!critical) return false
  const current = getAppReleaseVersion()
  return compareReleaseVersions(current, critical) < 0
}
