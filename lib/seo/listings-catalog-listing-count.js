/**
 * Stage 69.1 — lightweight ACTIVE listings count for `/listings` SEO description (same category scope as search).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { normalizeListingCategorySlugForSearch } from '@/lib/listing-category-slug'
import { nextSearchParamsRecordToURLSearchParams } from '@/lib/search/listings-page-url'
import { resolveListingCategoryIdsForSearchScope } from '@/lib/api/category-search-scope'
import { applySmartWhereFilter } from '@/lib/api/run-listings-search-get'

function pickWhere(sp) {
  const w = sp.get('where')?.trim() || sp.get('location')?.trim() || sp.get('city')?.trim() || ''
  if (!w || w.toLowerCase() === 'all') return null
  return w
}

/**
 * @param {import('next').SearchParams | Record<string, string | string[] | undefined>} searchParamsRecord
 * @returns {Promise<number | null>} null if skipped or error
 */
export async function fetchListingsCountForCatalogSeo(searchParamsRecord) {
  if (!supabaseAdmin) return null
  const sp = nextSearchParamsRecordToURLSearchParams(searchParamsRecord)
  const category = normalizeListingCategorySlugForSearch(sp.get('category'))
  if (!category || category === 'all') return null

  const ids = await resolveListingCategoryIdsForSearchScope(category)
  if (!ids?.length) return null

  const where = pickWhere(sp)
  let q = supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).in('category_id', ids).eq('status', 'ACTIVE')
  q = applySmartWhereFilter(q, where)

  const { count, error } = await q
  if (error) {
    console.warn('[SEO listings count]', error.message)
    return null
  }
  return typeof count === 'number' ? count : null
}
