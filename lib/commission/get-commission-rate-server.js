/**
 * Server-only: commission snapshot from `system_settings` + optional partner override.
 * Extracted from `hooks/use-commission.js` (Stage 62.0) so the hook stays client-safe for `next build`.
 */
import { createClient } from '@supabase/supabase-js'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'

/**
 * @param {string | null} [partnerId]
 */
export async function getCommissionRate(partnerId = null) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )

    const { data: settings } = await supabase.from('system_settings').select('value').eq('key', 'general').single()

    const raw = settings?.value?.defaultCommissionRate
    const parsed = parseFloat(raw)
    const systemRate =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : await resolveDefaultCommissionPercent()

    let personalRate = null
    if (partnerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .single()

      if (profile?.custom_commission_rate !== null && profile?.custom_commission_rate !== undefined) {
        personalRate = profile.custom_commission_rate
      }
    }

    const effectiveRate = personalRate !== null ? personalRate : systemRate

    const g = parseFloat(settings?.value?.guestServiceFeePercent ?? settings?.value?.serviceFeePercent)
    const guestServiceFeePercent =
      Number.isFinite(g) && g >= 0 && g <= 100 ? g : PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent

    const ins = parseFloat(settings?.value?.insuranceFundPercent)
    const insuranceFundPercent =
      Number.isFinite(ins) && ins >= 0 && ins <= 100 ? ins : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent

    const tx = parseFloat(settings?.value?.taxRatePercent)
    const taxRatePercent = Number.isFinite(tx) && tx >= 0 && tx <= 100 ? tx : 0

    return {
      systemRate,
      personalRate,
      effectiveRate,
      partnerEarningsPercent: 100 - effectiveRate,
      guestServiceFeePercent,
      hostCommissionPercent: effectiveRate,
      insuranceFundPercent,
      taxRatePercent,
    }
  } catch (error) {
    console.error('getCommissionRate error:', error)
    const fallback = await resolveDefaultCommissionPercent()
    return {
      systemRate: fallback,
      personalRate: null,
      effectiveRate: fallback,
      partnerEarningsPercent: 100 - fallback,
      guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: fallback,
      insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
      taxRatePercent: 0,
    }
  }
}
