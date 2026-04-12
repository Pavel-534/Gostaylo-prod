/**
 * Настройки безопасности чата из system_settings.general.chatSafety
 */

import { supabaseAdmin } from '@/lib/supabase'

const DEFAULTS = {
  autoShadowbanEnabled: false,
  strikeThreshold: 5,
  estimatedBookingValueThb: 8000,
}

function clampInt(n, min, max, fallback) {
  const v = parseInt(String(n), 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function clampPositiveNumber(n, fallback) {
  const v = parseFloat(String(n))
  if (!Number.isFinite(v) || v < 0) return fallback
  return v
}

/**
 * @returns {Promise<{ autoShadowbanEnabled: boolean, strikeThreshold: number, estimatedBookingValueThb: number }>}
 */
export async function getChatSafetySettings() {
  if (!supabaseAdmin) {
    return { ...DEFAULTS }
  }
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
  const cs = data?.value?.chatSafety
  if (!cs || typeof cs !== 'object') {
    return { ...DEFAULTS }
  }
  return {
    autoShadowbanEnabled: cs.autoShadowbanEnabled === true,
    strikeThreshold: clampInt(cs.strikeThreshold, 1, 999, DEFAULTS.strikeThreshold),
    estimatedBookingValueThb: clampPositiveNumber(
      cs.estimatedBookingValueThb,
      DEFAULTS.estimatedBookingValueThb,
    ),
  }
}
