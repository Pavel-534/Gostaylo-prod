/**
 * Stage 177.2b–177.3 — apply discovery plan scalar + JSONB predicates to Supabase/PostgREST chains.
 */

import { applyDiscoveryJsonbTextEqCiToQuery, applyDiscoveryJsonbTextIlikeContainsToQuery } from '@/lib/api/search/discovery-jsonb-text-filter'
import { applyDiscoveryJsonbNumericGteToQuery } from '@/lib/search/discovery-jsonb-numeric-filter'

/** @typedef {import('@/lib/search/filter-registry').DiscoveryQueryPlan} DiscoveryQueryPlan */
/** @typedef {import('@/lib/search/filter-registry').DiscoveryScalarPredicate} DiscoveryScalarPredicate */
/** @typedef {import('@/lib/search/filter-registry').DiscoveryJsonbPredicate} DiscoveryJsonbPredicate */

/**
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {DiscoveryScalarPredicate} predicate
 */
export function applyDiscoveryScalarPredicate(query, predicate) {
  const column = String(predicate?.column || '').trim()
  if (!column) return query

  const value = predicate.value
  switch (predicate.op) {
    case 'gte':
      return query.gte(column, value)
    case 'lte':
      return query.lte(column, value)
    case 'eq':
      return query.eq(column, value)
    case 'in':
      return Array.isArray(value) ? query.in(column, value) : query
    default:
      return query
  }
}

/**
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {DiscoveryJsonbPredicate} predicate
 */
export function applyDiscoveryJsonbPredicate(query, predicate) {
  if (!predicate?.op) return query

  if (predicate.op === '@>') {
    const path = String(predicate.path || '').trim()
    if (path === 'amenities' && Array.isArray(predicate.value) && predicate.value.length) {
      return query.contains('metadata', { amenities: [...predicate.value] })
    }
    if (path && predicate.value != null) {
      return query.contains('metadata', { [path]: predicate.value })
    }
    return query
  }

  if (predicate.op === 'text_eq_ci') {
    return applyDiscoveryJsonbTextEqCiToQuery(query, predicate.path, String(predicate.value || ''))
  }

  if (predicate.op === 'text_ilike_contains') {
    return applyDiscoveryJsonbTextIlikeContainsToQuery(
      query,
      predicate.path,
      String(predicate.value || ''),
    )
  }

  if (predicate.op === 'jsonb_numeric_gte') {
    return applyDiscoveryJsonbNumericGteToQuery(query, predicate.path, Number(predicate.value))
  }

  return query
}

/**
 * JSONB facets from `plan.sql.jsonbPredicates` (amenities @>, property_type text_eq_ci).
 *
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {DiscoveryQueryPlan} plan
 */
export function applyDiscoveryJsonbPredicatesFromPlan(query, plan) {
  if (!plan?.sql) return query

  let q = query
  const predicates = plan.sql.jsonbPredicates || []
  for (const predicate of predicates) {
    q = applyDiscoveryJsonbPredicate(q, predicate)
  }
  return q
}

/**
 * Scalar facets from `plan.sql.scalarPredicates` (price, bedrooms, bathrooms, guests, instant_booking).
 * Also applies JSONB predicates (amenities, property_type) for a single executor call-site.
 *
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {DiscoveryQueryPlan} plan
 */
export function applyDiscoveryScalarFiltersFromPlan(query, plan) {
  if (!plan?.sql) return query

  let q = query
  const predicates = plan.sql.scalarPredicates || []
  for (const predicate of predicates) {
    q = applyDiscoveryScalarPredicate(q, predicate)
  }

  return applyDiscoveryJsonbPredicatesFromPlan(q, plan)
}

/**
 * Strip housing facets from legacy filters when unified plan owns SQL predicates.
 *
 * @param {object} legacyFilters
 * @param {DiscoveryQueryPlan} plan
 */
export function legacyFiltersForUnifiedDiscoveryPlan(legacyFilters, plan) {
  const f = { ...legacyFilters }
  if (!plan?.sql) return f

  f.minPrice = null
  f.maxPrice = null
  f.bedroomsMin = null
  f.bathroomsMin = null
  f.instantBookingOnly = false

  if (plan.sql.amenities?.length) {
    f.amenities = []
  }

  return f
}
