/**
 * Network Information API helpers — SEA mobile / save-data aware delivery (Stage 171.20).
 * Pure functions safe for SSR defaults; live values via `useNetworkQuality` on client.
 */

/**
 * @typedef {{ saveData: boolean, effectiveType: string | null, constrained: boolean }} NetworkQualitySnapshot
 */

/**
 * @returns {NetworkInformation | null}
 */
export function readNetworkConnection() {
  if (typeof navigator === 'undefined') return null
  return (
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    null
  )
}

/**
 * @param {NetworkInformation | null | undefined} connection
 * @returns {boolean}
 */
export function isConstrainedNetwork(connection) {
  // Stage 189.0 / IOS-P1-05: iOS Safari rarely exposes Network Information API —
  // without effectiveType, prefer lighter image delivery (Phuket 4G / A13).
  if (!connection || !connection.effectiveType) {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || ''
      const isIos =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      if (isIos) return true
    }
    return false
  }
  if (connection.saveData === true) return true
  const effectiveType = String(connection.effectiveType || '').toLowerCase()
  return effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g'
}

/**
 * @returns {NetworkQualitySnapshot}
 */
export function getNetworkQualitySnapshot() {
  const connection = readNetworkConnection()
  return {
    saveData: connection?.saveData === true,
    effectiveType: connection?.effectiveType ? String(connection.effectiveType) : null,
    constrained: isConstrainedNetwork(connection),
  }
}

/**
 * Public PDP calendar horizon (Stage 189.1) — shorter payload on constrained / iOS.
 * Full horizon remains available after date-range expand on the client.
 * @returns {number}
 */
export function getPublicCalendarDaysAhead() {
  return getNetworkQualitySnapshot().constrained ? 90 : 180
}
