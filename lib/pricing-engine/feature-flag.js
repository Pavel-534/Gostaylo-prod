import { supabaseAdmin } from '@/lib/supabase'

let cachedSettingsFlag = null
let cachedSettingsAt = 0
const SETTINGS_TTL_MS = 60_000

/**
 * Stage 97.0.3 — live booking path uses PricingEngine when enabled.
 * Env `PRICING_ENGINE_V2=true|1` overrides; else `system_settings.general.pricingEngineV2Enabled`.
 */
export function isPricingEngineV2EnabledFromEnv() {
  const v = String(process.env.PRICING_ENGINE_V2 || '')
    .trim()
    .toLowerCase()
  return v === 'true' || v === '1' || v === 'yes'
}

/**
 * @returns {Promise<boolean>}
 */
export async function isPricingEngineV2Enabled() {
  if (isPricingEngineV2EnabledFromEnv()) return true

  const now = Date.now()
  if (cachedSettingsFlag !== null && now - cachedSettingsAt < SETTINGS_TTL_MS) {
    return cachedSettingsFlag
  }

  if (!supabaseAdmin) {
    cachedSettingsFlag = false
    cachedSettingsAt = now
    return false
  }

  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
  const enabled =
    data?.value?.pricingEngineV2Enabled === true || data?.value?.pricing_engine_v2_enabled === true
  cachedSettingsFlag = Boolean(enabled)
  cachedSettingsAt = now
  return cachedSettingsFlag
}
