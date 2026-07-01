/**
 * Stage 177.2 — keyset cursor helpers for Supabase/PostgREST catalog queries.
 */

/** @typedef {import('@/lib/search/filter-registry').DiscoverySqlOrderClause} DiscoverySqlOrderClause */
/** @typedef {import('@/lib/search/filter-registry').DiscoverySqlCursor} DiscoverySqlCursor */

const STABLE_KEYSET_ORDER = Object.freeze([
  { column: 'created_at', ascending: false },
  { column: 'id', ascending: false },
])

/**
 * @param {string} value
 * @returns {string}
 */
export function quotePostgrestFilterValue(value) {
  const s = String(value ?? '')
  if (/^[a-zA-Z0-9_-]+$/.test(s)) return s
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * @param {DiscoverySqlOrderClause[]} orderBy
 */
function assertStableKeysetOrder(orderBy) {
  const primary = orderBy?.[0]
  const tie = orderBy?.[1]
  const stablePrimary = STABLE_KEYSET_ORDER[0]
  const stableTie = STABLE_KEYSET_ORDER[1]
  if (
    primary?.column !== stablePrimary.column ||
    tie?.column !== stableTie.column ||
    primary?.ascending !== stablePrimary.ascending ||
    tie?.ascending !== stableTie.ascending
  ) {
    throw new Error('discovery cursor SQL supports only created_at DESC, id DESC')
  }
}

/**
 * PostgREST `.or()` filter for keyset pagination (DESC).
 *
 * @param {DiscoverySqlCursor | null | undefined} cursor
 * @param {DiscoverySqlOrderClause[]} orderBy
 * @returns {string | null}
 */
export function buildDiscoveryKeysetOrFilter(cursor, orderBy) {
  if (!cursor) return null
  assertStableKeysetOrder(orderBy)

  const ts = quotePostgrestFilterValue(cursor.lastCreatedAt)
  const id = quotePostgrestFilterValue(cursor.lastId)
  return `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`
}

/**
 * @param {DiscoverySqlOrderClause[]} orderBy
 * @returns {number}
 */
export function discoveryCursorFetchLimit(pageSize, overFetch = 1) {
  const size = Math.max(1, Math.floor(Number(pageSize) || 24))
  const extra = Math.max(0, Math.floor(Number(overFetch) || 0))
  return size + extra
}

/**
 * Apply stable keyset pagination to a Supabase query builder.
 *
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {DiscoverySqlCursor | null | undefined} cursor
 * @param {DiscoverySqlOrderClause[]} orderBy
 * @param {number} pageSize
 * @param {number} [overFetch]
 */
export function applyDiscoveryCursorToQuery(query, cursor, orderBy, pageSize, overFetch = 1) {
  const clauses = orderBy?.length ? orderBy : [...STABLE_KEYSET_ORDER]
  assertStableKeysetOrder(clauses)

  let q = query
  const orFilter = buildDiscoveryKeysetOrFilter(cursor, clauses)
  if (orFilter) {
    q = q.or(orFilter)
  }

  for (const clause of clauses) {
    q = q.order(clause.column, { ascending: clause.ascending })
  }

  return q.limit(discoveryCursorFetchLimit(pageSize, overFetch))
}
