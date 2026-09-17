/**
 * Server-only: fee policy snapshot from `system_settings` + optional partner override.
 * SSOT: `lib/services/pricing/pricing-fee-policy.js` (ADR-182 / Stage 183).
 *
 * Stage 202.42 — short TTL cache for system (non-partner) snapshot + transient read retry.
 * Does not change fee formulas; display/search hot paths only.
 */
import { unstable_cache } from 'next/cache'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import {
  resolveGuestServiceFeePercentFromGeneral,
  resolveHostCommissionPercentFromGeneral,
} from '@/lib/services/pricing/pricing-fee-policy.js'
import { readSystemSettingValue } from '@/lib/admin/system-settings-store'
import { supabaseAdmin } from '@/lib/supabase'
import { withTransientSupabaseRead } from '@/lib/ops/with-transient-retry.js'

const COMMISSION_CACHE_REVALIDATE_SEC = 45

function buildSnapshotFromGeneral(general, personalRate = null) {
  const systemHostRate = resolveHostCommissionPercentFromGeneral(general)
  const guestServiceFeePercent = resolveGuestServiceFeePercentFromGeneral(general)
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
}

function fallbackSnapshot() {
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

const loadSystemCommissionCached = unstable_cache(
  async () => {
    // readSystemSettingValue already retries transient PostgREST blips (Stage 202.42).
    const general = (await readSystemSettingValue('general')) || {}
    return buildSnapshotFromGeneral(general)
  },
  ['commission-rate-system-v1'],
  { revalidate: COMMISSION_CACHE_REVALIDATE_SEC },
)

async function loadPartnerCustomRate(partnerId) {
  if (!partnerId || !supabaseAdmin) return null
  const { data: profile, error } = await withTransientSupabaseRead(
    () =>
      supabaseAdmin
        .from('profiles')
        .select('custom_commission_rate')
        .eq('id', partnerId)
        .maybeSingle(),
    { attempts: 2, baseDelayMs: 250, label: 'commission-partner-rate' },
  )
  if (error) {
    console.warn('[getCommissionRate] partner rate read failed:', error?.message || error)
    return null
  }
  if (profile?.custom_commission_rate != null) {
    const p = parseFloat(profile.custom_commission_rate)
    if (Number.isFinite(p) && p >= 0 && p <= 100) return p
  }
  return null
}

/**
 * @param {string | null} [partnerId]
 */
export async function getCommissionRate(partnerId = null) {
  try {
    const systemSnap = await loadSystemCommissionCached()
    const pid = partnerId != null ? String(partnerId).trim() : ''
    if (!pid) return systemSnap

    const personalRate = await loadPartnerCustomRate(pid)
    if (personalRate === null) return systemSnap

    return {
      ...systemSnap,
      personalRate,
      effectiveRate: personalRate,
      partnerEarningsPercent: 100 - personalRate,
      hostCommissionPercent: personalRate,
    }
  } catch (error) {
    console.error('getCommissionRate error:', error)
    return fallbackSnapshot()
  }
}
