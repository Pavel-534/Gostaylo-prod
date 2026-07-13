/**
 * Server-only: fee policy snapshot from `system_settings` + optional partner override.
 * SSOT: `lib/services/pricing/pricing-fee-policy.js` (ADR-182 / Stage 183).
 */
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import {
  resolveGuestServiceFeePercentFromGeneral,
  resolveHostCommissionPercentFromGeneral,
} from '@/lib/services/pricing/pricing-fee-policy.js'
import { readSystemSettingValue } from '@/lib/admin/system-settings-store'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {string | null} [partnerId]
 */
export async function getCommissionRate(partnerId = null) {
  try {
    const general = (await readSystemSettingValue('general')) || {}

    const systemHostRate = resolveHostCommissionPercentFromGeneral(general)
    const guestServiceFeePercent = resolveGuestServiceFeePercentFromGeneral(general)

    let personalRate = null
    if (partnerId && supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .maybeSingle()

      if (profile?.custom_commission_rate != null) {
        const p = parseFloat(profile.custom_commission_rate)
        if (Number.isFinite(p) && p >= 0 && p <= 100) personalRate = p
      }
    }

    const effectiveHostRate = personalRate !== null ? personalRate : systemHostRate

    const ins = parseFloat(general?.insuranceFundPercent)
    const insuranceFundPercent =
      Number.isFinite(ins) && ins >= 0 && ins <= 100 ? ins : PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent

    const tx = parseFloat(general?.taxRatePercent)
    const taxRatePercent = Number.isFinite(tx) && tx >= 0 && tx <= 100 ? tx : 0

    return {
      systemRate: systemHostRate,
      personalRate,
      effectiveRate: effectiveHostRate,
      partnerEarningsPercent: 100 - effectiveHostRate,
      guestServiceFeePercent,
      hostCommissionPercent: effectiveHostRate,
      insuranceFundPercent,
      taxRatePercent,
    }
  } catch (error) {
    console.error('getCommissionRate error:', error)
    return {
      systemRate: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      personalRate: null,
      effectiveRate: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      partnerEarningsPercent: 100,
      guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
      hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
      insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
      taxRatePercent: 0,
    }
  }
}
