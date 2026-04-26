/**
 * Stage 69.0 — короткий кеш строк `categories` для SEO `/listings` (без дублирования логики клиента).
 */

import { supabaseAdmin } from '@/lib/supabase'

let cache = { ts: 0, rows: null }
const TTL_MS = 5 * 60 * 1000

/**
 * @returns {Promise<Array<{ id: string, slug: string, name: string, parent_id: string | null, name_i18n: object | null, wizard_profile?: string | null, description?: string | null }>>}
 */
export async function fetchCategoriesSeoSnapshot() {
  const now = Date.now()
  if (cache.rows && now - cache.ts < TTL_MS) return cache.rows
  if (!supabaseAdmin) {
    cache = { ts: now, rows: [] }
    return []
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, slug, name, parent_id, name_i18n, wizard_profile, description')
      .eq('is_active', true)
    if (error) {
      console.warn('[SEO categories snapshot]', error.message)
      cache = { ts: now, rows: [] }
      return []
    }
    const rows = data || []
    cache = { ts: now, rows }
    return rows
  } catch (e) {
    console.warn('[SEO categories snapshot]', e?.message || e)
    cache = { ts: now, rows: [] }
    return []
  }
}
