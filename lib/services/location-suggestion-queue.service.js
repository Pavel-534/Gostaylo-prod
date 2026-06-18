/**
 * Stage 160 — admin queue: PENDING location_suggestions + listings_count.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {object} row
 */
async function countListingsForSuggestion(row) {
  if (!supabaseAdmin) return 0

  const { data, error } = await supabaseAdmin.rpc('count_listings_for_location_term_v1', {
    p_raw_term: row.raw_term,
    p_kind: row.kind || 'district',
    p_suggested_listing_id: row.suggested_by_listing_id || null,
  })

  if (error) {
    if (error.code === '42883' || error.message?.includes('does not exist')) {
      return countListingsFallback(row)
    }
    console.warn('[location-suggestion-queue] count rpc:', error.message)
    return 0
  }

  return Number(data) || 0
}

/**
 * @param {object} row
 */
async function countListingsFallback(row) {
  const term = String(row.raw_term || '').trim().toLowerCase()
  if (!term || !supabaseAdmin) return 0

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id, district, metadata')
    .eq('status', 'ACTIVE')
    .limit(5000)

  if (error) return 0

  let n = 0
  for (const l of data || []) {
    const d = String(l.district || '').trim().toLowerCase()
    const u = String(l.metadata?.unverified_location?.raw_term || '').trim().toLowerCase()
    if (d === term || u === term || l.id === row.suggested_by_listing_id) n += 1
  }
  return n
}

/**
 * @param {{ status?: string, limit?: number, offset?: number }} [params]
 */
export async function listLocationSuggestionsQueue(params = {}) {
  if (!supabaseAdmin) {
    return { items: [], total: 0 }
  }

  const status = String(params.status || 'PENDING').toUpperCase()
  const limit = Math.min(100, Math.max(1, parseInt(params.limit, 10) || 50))
  const offset = Math.max(0, parseInt(params.offset, 10) || 0)

  const { data, error, count } = await supabaseAdmin
    .from('location_suggestions')
    .select(
      'id, raw_term, kind, country_code, region_code, city_code, status, suggested_by_listing_id, created_at',
      { count: 'exact' },
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    if (error.code === '42P01') {
      return { items: [], total: 0, table_missing: true }
    }
    throw new Error(error.message)
  }

  const rows = data || []
  const withCounts = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      listings_count: await countListingsForSuggestion(row),
    })),
  )

  withCounts.sort(
    (a, b) =>
      (b.listings_count ?? 0) - (a.listings_count ?? 0) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return {
    items: withCounts,
    total: count ?? withCounts.length,
  }
}
