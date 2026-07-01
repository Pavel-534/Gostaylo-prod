/**
 * Stage 177.3 — JSONB numeric facet predicates for unified discovery SQL.
 */

const METADATA_NUMERIC_PATH_RE = /^[a-z0-9_]{1,48}$/

/**
 * PostgREST column path: cast metadata text key to numeric for safe gte/lte.
 * Spike T3.9: `metadata->>key::numeric` is accepted by PostgREST filter columns.
 *
 * @param {string} path — metadata key (e.g. engine_cc, cabins)
 * @returns {string}
 */
export function discoveryMetadataNumericCastColumn(path) {
  const key = String(path || '').trim()
  if (!METADATA_NUMERIC_PATH_RE.test(key)) {
    throw new Error(`discoveryMetadataNumericCastColumn: invalid path "${path}"`)
  }
  return `metadata->>${key}::numeric`
}

/**
 * @param {string} path — metadata key
 * @param {number} value — minimum inclusive
 * @returns {{ op: 'jsonb_numeric_gte', path: string, value: number }}
 */
export function buildDiscoveryJsonbNumericGtePredicate(path, value) {
  const normalizedPath = String(path || '').trim()
  const n = Number(value)
  if (!METADATA_NUMERIC_PATH_RE.test(normalizedPath)) {
    throw new Error('buildDiscoveryJsonbNumericGtePredicate requires valid metadata path')
  }
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('buildDiscoveryJsonbNumericGtePredicate requires positive finite value')
  }
  return {
    op: 'jsonb_numeric_gte',
    path: normalizedPath,
    value: n,
  }
}

/**
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {string} path
 * @param {number} value
 */
export function applyDiscoveryJsonbNumericGteToQuery(query, path, value) {
  const column = discoveryMetadataNumericCastColumn(path)
  const n = Number(value)
  if (!Number.isFinite(n)) return query
  return query.filter(column, 'gte', n)
}
