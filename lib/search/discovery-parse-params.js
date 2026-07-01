/**
 * Stage 177.2b — shared URL param parsers for discovery registry.
 */

/**
 * @typedef {'absent'|'inactive'|'active'|'invalid'} DiscoveryMinIntParseKind
 */

/**
 * Min-int filter: absent, 0 = inactive (no filter), >=1 active, else invalid.
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {{ kind: DiscoveryMinIntParseKind, value?: number }}
 */
export function parseUrlMinIntFilterParam(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const n = parseInt(String(raw), 10)
    if (!Number.isFinite(n)) return { kind: 'invalid' }
    if (n === 0) return { kind: 'inactive' }
    if (n < 1) return { kind: 'invalid' }
    return { kind: 'active', value: n }
  }
  return { kind: 'absent' }
}

/**
 * @param {URLSearchParams} sp
 * @param {string[]} keys
 * @returns {number | null}
 */
export function parseUrlNonNegativePriceThb(sp, ...keys) {
  for (const k of keys) {
    const raw = sp.get(k)
    if (raw == null || raw === '') continue
    const n = parseFloat(String(raw))
    if (!Number.isFinite(n) || n < 0) continue
    return Math.round(n)
  }
  return null
}
