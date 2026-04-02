/**
 * Фича-флаг: семантический поиск на публичном сайте (system_settings.key = ai).
 */
import { supabaseAdmin } from '@/lib/supabase'

const SETTINGS_KEY = 'ai'

/**
 * @returns {Promise<boolean>} true — на сайте можно включать semantic=1 (по умолчанию, если записи нет)
 */
export async function getSemanticSearchSiteEnabled() {
  if (!supabaseAdmin) return true
  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (error || !data?.value || typeof data.value !== 'object') return true
  const v = data.value.semanticSearchOnSite
  return v !== false
}

/**
 * @param {boolean} enabled
 */
export async function setSemanticSearchSiteEnabled(enabled) {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured')
  }
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()
  if (readErr) throw readErr
  const next = { ...(existing?.value && typeof existing.value === 'object' ? existing.value : {}), semanticSearchOnSite: !!enabled }
  const { error } = await supabaseAdmin.from('system_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )
  if (error) throw error
}
