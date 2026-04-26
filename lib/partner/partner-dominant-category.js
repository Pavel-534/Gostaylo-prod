/**
 * Stage 26.0 — Доминирующая категория листингов партнёра (по числу объявлений).
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {unknown} partnerId
 * @returns {Promise<string | null>} `categories.slug` или null
 */
export async function fetchDominantListingCategorySlugForPartner(partnerId) {
  const pid = String(partnerId || '').trim()
  if (!pid || !supabaseAdmin) return null

  const { data: rows, error } = await supabaseAdmin
    .from('listings')
    .select('category_id')
    .eq('owner_id', pid)
    .limit(500)

  if (error || !Array.isArray(rows) || !rows.length) return null

  const counts = new Map()
  for (const r of rows) {
    const id = r?.category_id != null ? String(r.category_id) : ''
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  let topId = null
  let topN = 0
  for (const [id, n] of counts) {
    if (n > topN) {
      topN = n
      topId = id
    }
  }
  if (!topId) return null

  const { data: cat, error: cErr } = await supabaseAdmin
    .from('categories')
    .select('slug')
    .eq('id', topId)
    .maybeSingle()

  if (cErr || !cat?.slug) return null
  return String(cat.slug)
}
