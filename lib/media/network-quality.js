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
  if (!connection) return false
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
