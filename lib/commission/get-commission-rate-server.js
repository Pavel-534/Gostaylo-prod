/**
 * Server-only: commission snapshot from `system_settings` + optional partner override.
 * Extracted from `hooks/use-commission.js` (Stage 62.0) so the hook stays client-safe for `next build`.
 */
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { readSystemSettingValue } from '@/lib/admin/system-settings-store'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string | null} [partnerId]
 */
export async function getCommissionRate(partnerId = null) {
  try {
    const settingsValue = await readSystemSettingValue('general')

    const raw = settingsValue?.defaultCommissionRate
    const parsed = parseFloat(raw)
    const systemRate =
      Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : await resolveDefaultCommissionPercent()

    let personalRate = null
    if (partnerId && supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .maybeSingle()

      if (profile?.custom_commission_rate != null) {
        personalRate = profile.custom_commission_rate
      }
    }

    const effectiveRate = personalRate !== null ? personalRate : systemRate

    const g = parseFloat(settingsValue?.guestServiceFeePercent ?? settingsValue?.serviceFeePercent)
    const guestServiceFeePercent =
      Number.isFinite(g) && g >= 0 && g <= 100 ? g : PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent

    const ins = parseFloat(settingsValue?.insuranceFundPercent)
    const insuranceFundPercent =
      Number.isFinite(ins) && ins >= 0 && ins <= 100 ? ins : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent

    const tx = parseFloat(settingsValue?.taxRatePercent)
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
