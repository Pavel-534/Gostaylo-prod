import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time compare of two UTF-8 secrets (AUDIT_03 W3.12).
 * Different lengths → false without throwing / truncating.
 * @param {string} provided
 * @param {string} expected
 */
export function secretsTimingSafeEqual(provided, expected) {
  try {
    const a = Buffer.from(String(provided ?? ''), 'utf8')
    const b = Buffer.from(String(expected ?? ''), 'utf8')
    if (a.length !== b.length) return false
    if (a.length === 0) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
