/**
 * Stage 177.2b — JSONB text facet predicates for unified discovery SQL.
 */

export const DISCOVERY_PROPERTY_TYPE_SLUG_RE = /^[a-z0-9_-]{1,48}$/

/**
 * @param {string} path — metadata key (e.g. property_type)
 * @param {string} value — normalized slug
 * @returns {{ op: 'text_eq_ci', path: string, value: string }}
 */
export function buildDiscoveryJsonbTextEqCiPredicate(path, value) {
  const normalizedPath = String(path || '').trim()
  const normalizedValue = String(value || '').trim().toLowerCase()
  if (!normalizedPath || !normalizedValue) {
    throw new Error('buildDiscoveryJsonbTextEqCiPredicate requires path and value')
  }
  return {
    op: 'text_eq_ci',
    path: normalizedPath,
    value: normalizedValue,
  }
}

/**
 * @param {string | null | undefined} raw
 * @returns {{ value: string | null, invalid: boolean }}
 */
export function normalizeDiscoveryPropertyTypeSlug(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { value: null, invalid: false }
  }
  const slug = String(raw).trim().toLowerCase()
  if (!DISCOVERY_PROPERTY_TYPE_SLUG_RE.test(slug)) {
    return { value: null, invalid: true }
  }
  return { value: slug, invalid: false }
}

/**
 * PostgREST column path for metadata text key.
 * @param {string} path
 * @returns {string}
 */
export function discoveryMetadataTextColumn(path) {
  const key = String(path || '').trim()
  if (!key) throw new Error('discoveryMetadataTextColumn requires path')
  return `metadata->>${key}`
}

/**
 * Case-insensitive equality on `metadata->>path` via PostgREST `ilike` (no wildcards).
 *
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {string} path
 * @param {string} value — normalized lowercase slug
 */
export function applyDiscoveryJsonbTextEqCiToQuery(query, path, value) {
  const column = discoveryMetadataTextColumn(path)
  const needle = String(value || '').trim().toLowerCase()
  if (!needle) return query
  return query.filter(column, 'ilike', needle)
}
