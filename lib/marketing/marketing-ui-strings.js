/**
 * Stage 40.0 — resolve marketing UI strings: constants + optional `system_settings.marketing_ui_strings`.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  MARKETING_UI_LANGS,
  MARKETING_UI_STRING_DEFAULTS,
  MARKETING_UI_STRING_KEYS,
} from '@/lib/constants/marketing'

/**
 * @param {string} lang
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveMarketingUiStrings(lang) {
  const safe = MARKETING_UI_LANGS.includes(String(lang || '').toLowerCase())
    ? String(lang).toLowerCase()
    : 'ru'
  const out = { ...MARKETING_UI_STRING_DEFAULTS[safe] }

  if (!supabaseAdmin) return out

  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'marketing_ui_strings')
      .maybeSingle()
    if (error || !data?.value || typeof data.value !== 'object') return out

    const row = data.value
    const patch = row[safe] && typeof row[safe] === 'object' ? row[safe] : null
    if (!patch) return out

    for (const k of MARKETING_UI_STRING_KEYS) {
      const v = patch[k]
      if (typeof v === 'string' && v.trim()) out[k] = v.trim()
    }
  } catch {
    /* ignore */
  }

  return out
}
