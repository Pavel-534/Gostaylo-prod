/**
 * Stage 118.0 — SSOT чтения/записи system_settings (service_role, server-only).
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string[]} keys
 * @returns {Promise<Record<string, { id?: string, key: string, value: unknown, updated_at?: string }>>}
 */
export async function readSystemSettingsByKeys(keys) {
  const unique = [...new Set((keys || []).map((k) => String(k || '').trim()).filter(Boolean))]
  const byKey = {}
  if (!unique.length || !supabaseAdmin) return byKey

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .select('id,key,value,updated_at')
    .in('key', unique)

  if (error) {
    throw new Error(error.message || 'SYSTEM_SETTINGS_READ_FAILED')
  }

  for (const row of data || []) {
    byKey[row.key] = row
  }
  return byKey
}

/**
 * @param {string} key
 * @returns {Promise<unknown|null>}
 */
export async function readSystemSettingValue(key) {
  const byKey = await readSystemSettingsByKeys([key])
  return byKey[key]?.value ?? null
}

/**
 * @param {string} key
 * @param {unknown} value
 */
export async function upsertSystemSetting(key, value) {
  if (!supabaseAdmin) throw new Error('Database not configured')
  const k = String(key || '').trim()
  if (!k) throw new Error('key is required')

  const { data, error } = await supabaseAdmin
    .from('system_settings')
    .upsert({ key: k, value }, { onConflict: 'key' })
    .select('id,key,value,updated_at')
    .single()

  if (error) throw new Error(error.message || 'SYSTEM_SETTINGS_WRITE_FAILED')
  return data
}
