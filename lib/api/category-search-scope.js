/**
 * Stage 68.0 — expand search filter: parent category slug → listings in parent OR any active child category.
 */

import { supabaseAdmin } from '@/lib/supabase'

const scopeCache = new Map()
const SCOPE_TTL_MS = 10 * 60 * 1000

/**
 * @param {string} normalizedSlug — already normalized for DB (e.g. via `normalizeListingCategorySlugForSearch`)
 * @returns {Promise<string[] | null>} listing `category_id` values to pass to `.in()`, or null if slug unknown
 */
export async function resolveListingCategoryIdsForSearchScope(normalizedSlug) {
  const slug = String(normalizedSlug || '').toLowerCase().trim()
  if (!slug || slug === 'all' || !supabaseAdmin) return null

  const now = Date.now()
  const cached = scopeCache.get(slug)
  if (cached && now - cached.ts < SCOPE_TTL_MS) {
    return cached.ids
  }

  try {
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (rowErr || !row?.id) {
      scopeCache.set(slug, { ids: null, ts: now })
      return null
    }

    const { data: kids, error: kidsErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('parent_id', row.id)
      .eq('is_active', true)

    if (kidsErr) {
      console.error('[CATEGORY SEARCH SCOPE] children query:', kidsErr.message)
      const ids = [row.id]
      scopeCache.set(slug, { ids, ts: now })
      return ids
    }

    const childIds = (kids || []).map((k) => k.id).filter(Boolean)
    const ids = childIds.length ? [row.id, ...childIds] : [row.id]
    scopeCache.set(slug, { ids, ts: now })
    return ids
  } catch (e) {
    console.error('[CATEGORY SEARCH SCOPE]', e?.message || e)
    return null
  }
}
