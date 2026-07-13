import { supabaseAdmin } from '@/lib/supabase'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'

export function parsePercent(raw, fallback = 0) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(100, n)
}

function hasExplicitSettingValue(raw) {
  return raw != null && raw !== ''
}

/**
 * SSOT host commission % from `system_settings.general` (ADR-182 / Stage 183).
 * Explicit `hostCommissionPercent` (including **0**) wins over legacy `defaultCommissionRate`.
 *
 * @param {Record<string, unknown>} [general]
 */
export function resolveHostCommissionPercentFromGeneral(general = {}) {
  if (hasExplicitSettingValue(general?.hostCommissionPercent)) {
    return parsePercent(
      general.hostCommissionPercent,
      PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    )
  }
  if (hasExplicitSettingValue(general?.defaultCommissionRate)) {
    return parsePercent(
      general.defaultCommissionRate,
      PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    )
  }
  return PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral
}

/**
 * SSOT guest service fee % from `system_settings.general`.
 *
 * @param {Record<string, unknown>} [general]
 */
export function resolveGuestServiceFeePercentFromGeneral(general = {}) {
  const raw =
    general?.guestServiceFeePercent ?? general?.serviceFeePercent ?? general?.service_fee_percent
  if (hasExplicitSettingValue(raw)) {
    return parsePercent(raw, PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent)
  }
  return PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
}

export async function getGeneralPricingSettings() {
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('value')
    .eq('key', 'general')
    .maybeSingle()
  return data?.value || {}
}

export async function getFeePolicy(partnerId = null) {
  const [general, partnerRes] = await Promise.all([
    getGeneralPricingSettings(),
    partnerId
      ? supabaseAdmin
          .from('profiles')
          .select('custom_commission_rate')
          .eq('id', partnerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const guestServiceFeePercent = resolveGuestServiceFeePercentFromGeneral(general)
  const insuranceFundPercent = parsePercent(
    general?.insuranceFundPercent,
    PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
  )
  const hostFromGeneral = resolveHostCommissionPercentFromGeneral(general)
  const hostFromPartner = parsePercent(partnerRes?.data?.custom_commission_rate, hostFromGeneral)
  const hostCommissionPercent =
    partnerRes?.data?.custom_commission_rate != null ? hostFromPartner : hostFromGeneral
  const taxRatePercent = parsePercent(general?.taxRatePercent, 0)

  return {
    guestServiceFeePercent,
    hostCommissionPercent,
    insuranceFundPercent,
    taxRatePercent,
  }
}

export async function getFeePolicyBatch(partnerIds = []) {
  const ids = [...new Set((partnerIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  const general = await getGeneralPricingSettings()
  const guestServiceFeePercent = resolveGuestServiceFeePercentFromGeneral(general)
  const insuranceFundPercent = parsePercent(
    general?.insuranceFundPercent,
    PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
  )
  const hostFromGeneral = resolveHostCommissionPercentFromGeneral(general)
  const taxRatePercent = parsePercent(general?.taxRatePercent, 0)

  const policies = new Map()
  for (const id of ids) {
    policies.set(id, {
      guestServiceFeePercent,
      hostCommissionPercent: hostFromGeneral,
      insuranceFundPercent,
      taxRatePercent,
    })
  }

  if (ids.length > 0) {
    const { data } = await supabaseAdmin.from('profiles').select('id, custom_commission_rate').in('id', ids)
    for (const row of data || []) {
      const id = String(row?.id || '').trim()
      if (!id || !policies.has(id)) continue
      const custom = row?.custom_commission_rate
      policies.set(id, {
        guestServiceFeePercent,
        hostCommissionPercent: custom != null ? parsePercent(custom, hostFromGeneral) : hostFromGeneral,
        insuranceFundPercent,
        taxRatePercent,
      })
    }
  }

  return policies
}

export function calculateFeeSplitWithPolicy(subtotalThb, policy) {
  const subtotal = Math.max(0, Math.round(Number(subtotalThb) || 0))
  const p = policy || {
    guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
    hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    taxRatePercent: 0,
  }
  const taxRatePercent = parsePercent(p.taxRatePercent, 0)
  const taxAmountThb = Math.round(subtotal * (taxRatePercent / 100))
  const guestServiceFeeThb = Math.round(subtotal * (p.guestServiceFeePercent / 100))
  const hostCommissionThb = Math.round(subtotal * (p.hostCommissionPercent / 100))
  const partnerEarningsThb = Math.max(0, subtotal - hostCommissionThb)
  const platformGrossRevenueThb = guestServiceFeeThb + hostCommissionThb
  const insuranceReserveThb = Math.round(platformGrossRevenueThb * (p.insuranceFundPercent / 100))
  const netProfitOrderThb = Math.max(0, platformGrossRevenueThb - insuranceReserveThb)

  return {
    subtotalThb: subtotal,
    guestServiceFeePercent: p.guestServiceFeePercent,
    guestServiceFeeThb,
    hostCommissionRate: p.hostCommissionPercent,
    hostCommissionThb,
    partnerEarningsThb,
    platformGrossRevenueThb,
    insuranceFundPercent: p.insuranceFundPercent,
    insuranceReserveThb,
    netProfitOrderThb,
    taxRatePercent,
    taxAmountThb,
    guestPayableThb: subtotal + taxAmountThb + guestServiceFeeThb,
  }
}

export function calculateNetProfitOrder(feeSplitLike = {}) {
  const grossRaw = Number(feeSplitLike?.platformGrossRevenueThb)
  const insuranceRaw = Number(feeSplitLike?.insuranceReserveThb)
  const platformGrossRevenueThb =
    Number.isFinite(grossRaw) && grossRaw >= 0 ? Math.round(grossRaw * 100) / 100 : 0
  const insuranceReserveThb =
    Number.isFinite(insuranceRaw) && insuranceRaw >= 0 ? Math.round(insuranceRaw * 100) / 100 : 0
  const netProfitOrderThb = Math.max(0, Math.round((platformGrossRevenueThb - insuranceReserveThb) * 100) / 100)
  return { platformGrossRevenueThb, insuranceReserveThb, netProfitOrderThb }
}

export async function calculateFeeSplit(subtotalThb, partnerId = null) {
  const policy = await getFeePolicy(partnerId)
  return calculateFeeSplitWithPolicy(subtotalThb, policy)
}

export async function calculateCommission(priceThb, partnerId, _systemSettings = null) {
  const feeSplit = await calculateFeeSplit(priceThb, partnerId)
  const commissionRate = feeSplit.hostCommissionRate
  const commissionThb = feeSplit.guestServiceFeeThb
  const partnerEarnings = feeSplit.partnerEarningsThb

  return {
    commissionRate,
    commissionThb: Math.round(commissionThb),
    partnerEarnings: Math.round(partnerEarnings),
    priceThb: Math.round(Number(priceThb) || 0),
    hostCommissionThb: feeSplit.hostCommissionThb,
    guestServiceFeePercent: feeSplit.guestServiceFeePercent,
    guestServiceFeeThb: feeSplit.guestServiceFeeThb,
    insuranceFundPercent: feeSplit.insuranceFundPercent,
    insuranceReserveThb: feeSplit.insuranceReserveThb,
    platformGrossRevenueThb: feeSplit.platformGrossRevenueThb,
    guestPayableThb: feeSplit.guestPayableThb,
    taxRatePercent: feeSplit.taxRatePercent ?? 0,
    taxAmountThb: feeSplit.taxAmountThb ?? 0,
  }
}
