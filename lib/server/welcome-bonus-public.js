/**
 * Публичный welcome-бонус (THB) из `system_settings.key = general` — тот же SSOT, что
 * `PricingService.getGeneralPricingSettings()` / админка Marketing / регистрация.
 */
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import PricingService from '@/lib/services/pricing.service.js'

function normalizeWelcomeBonusThb(general) {
  return (
    Math.round(
      Math.min(
        1_000_000,
        Math.max(0, Number(general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 500)),
      ) * 100,
    ) / 100
  )
}

/** @returns {Promise<number>} */
export const getCachedWelcomeBonusAmountThb = cache(async () => {
  if (!supabaseAdmin) return 500
  try {
    const general = await PricingService.getGeneralPricingSettings()
    return normalizeWelcomeBonusThb(general || {})
  } catch {
    return 500
  }
})
