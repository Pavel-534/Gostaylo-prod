/**
 * Stage 131.0 — cached SSOT reader for `system_fintech_settings`.
 * Promo tank / welcome bonus remain in `system_settings.general` (marketing budget).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

const CACHE_TTL_MS = 60_000

/** @type {{ row: object | null, loadedAt: number }} */
let cache = { row: null, loadedAt: 0 }

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function parsePercent(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, 0, 100)
}

function parseRatio(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return clamp(n, 0, 1)
}

function parseBool(raw, fallback) {
  if (raw === true || raw === false) return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

export function normalizeFintechSettingsRow(row) {
  const d = FINTECH_CONFIG_DEFAULTS
  const safetyMax = clamp(Number(row?.safety_lock_max_share ?? d.safety_lock_max_share), 0.01, 1)

  return {
    id: 'global',
    acquiringFeePercent: parsePercent(row?.acquiring_fee_percent, d.acquiring_fee_percent),
    usnProvisionPercent: parsePercent(row?.usn_provision_percent, d.usn_provision_percent),
    vatProvisionPercent: parsePercent(row?.vat_provision_percent, d.vat_provision_percent),
    reserveBankPercent: parsePercent(row?.reserve_bank_percent, d.reserve_bank_percent),
    operationalReservePercent: parsePercent(
      row?.operational_reserve_percent,
      d.operational_reserve_percent,
    ),
    safetyLockMaxShare: safetyMax,

    referralReinvestmentPercent: clamp(
      parsePercent(row?.referral_reinvestment_percent, d.referral_reinvestment_percent),
      0,
      safetyMax * 100,
    ),
    referralSplitRatio: parseRatio(row?.referral_split_ratio, d.referral_split_ratio),

    ambassadorGuestL2Enabled: parseBool(
      row?.ambassador_guest_l2_enabled,
      d.ambassador_guest_l2_enabled,
    ),
    ambassadorGuestPoolL1Percent: parsePercent(
      row?.ambassador_guest_pool_l1_percent,
      d.ambassador_guest_pool_l1_percent,
    ),
    ambassadorGuestPoolL2Percent: parsePercent(
      row?.ambassador_guest_pool_l2_percent,
      d.ambassador_guest_pool_l2_percent,
    ),
    ambassadorGuestPoolRefereePercent: parsePercent(
      row?.ambassador_guest_pool_referee_percent,
      d.ambassador_guest_pool_referee_percent,
    ),
    ambassadorGuestL2MaxThbPerBooking: round2(
      clamp(
        Number(row?.ambassador_guest_l2_max_thb_per_booking ?? d.ambassador_guest_l2_max_thb_per_booking),
        0,
        1_000_000_000,
      ),
    ),
    ambassadorGuestL2MaxThbPerMonth: round2(
      clamp(
        Number(row?.ambassador_guest_l2_max_thb_per_month ?? d.ambassador_guest_l2_max_thb_per_month),
        0,
        1_000_000_000,
      ),
    ),

    referralMonthlyProgramCapThb: round2(
      clamp(
        Number(row?.referral_monthly_program_cap_thb ?? d.referral_monthly_program_cap_thb),
        0,
        1_000_000_000,
      ),
    ),
    referralWithdrawalFeePercent: parsePercent(
      row?.referral_withdrawal_fee_percent,
      d.referral_withdrawal_fee_percent,
    ),

    mlmLevel1Percent: parsePercent(row?.mlm_level1_percent, d.mlm_level1_percent),
    mlmLevel2Percent: parsePercent(row?.mlm_level2_percent, d.mlm_level2_percent),
    partnerActivationBonusThb: round2(
      clamp(Number(row?.partner_activation_bonus_thb ?? d.partner_activation_bonus_thb), 0, 1_000_000_000),
    ),

    ambassador3WaterfallEnabled: parseBool(
      row?.ambassador_3_waterfall_enabled,
      d.ambassador_3_waterfall_enabled,
    ),
    ambassador3ProgramCapEnabled: parseBool(
      row?.ambassador_3_program_cap_enabled,
      d.ambassador_3_program_cap_enabled,
    ),

    version: Number(row?.version) || 1,
    updatedAt: row?.updated_at || null,
  }
}

export class SystemConfigService {
  static invalidateCache() {
    cache = { row: null, loadedAt: 0 }
  }

  static async getFintechConfig({ bypassCache = false } = {}) {
    const fresh = bypassCache || Date.now() - cache.loadedAt > CACHE_TTL_MS
    if (!fresh && cache.row) return cache.row

    let row = null
    try {
      const { data, error } = await supabaseAdmin
        .from('system_fintech_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle()
      if (!error && data) row = data
    } catch {
      // table may be absent before migration
    }

    const normalized = normalizeFintechSettingsRow(row || FINTECH_CONFIG_DEFAULTS)
    cache = { row: normalized, loadedAt: Date.now() }
    return normalized
  }

  /**
   * Guest pool split percents (sum = 100 when L2 enabled).
   * @param {Awaited<ReturnType<typeof SystemConfigService.getFintechConfig>>} config
   */
  static resolveGuestPoolSplitPercents(config) {
    if (!config?.ambassadorGuestL2Enabled) {
      const l1 = round2(config.referralSplitRatio * 100)
      return {
        l1Percent: l1,
        l2Percent: 0,
        refereePercent: round2(100 - l1),
        mode: 'legacy_split_ratio',
      }
    }
    return {
      l1Percent: config.ambassadorGuestPoolL1Percent,
      l2Percent: config.ambassadorGuestPoolL2Percent,
      refereePercent: config.ambassadorGuestPoolRefereePercent,
      mode: 'ambassador_3_45_12_43',
    }
  }
}

export default SystemConfigService
