/**
 * Stage 131.0 — Zod + business validation for system_fintech_settings updates.
 */
import { z } from 'zod'
import { computeAdr131ReferenceWaterfall } from '@/lib/services/finance/fintech-waterfall.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'

const percent0to100 = z.coerce.number().min(0).max(100)
const percent0to10 = z.coerce.number().min(0).max(10)
const percent0to90 = z.coerce.number().min(0).max(90)
const ratio0to1 = z.coerce.number().min(0).max(1)
const thbNonNeg = z.coerce.number().min(0)

export const fintechSettingsPutSchema = z
  .object({
    acquiring_fee_percent: percent0to10.optional(),
    usn_provision_percent: percent0to100.optional(),
    vat_provision_percent: percent0to100.optional(),
    reserve_bank_percent: percent0to100.optional(),
    operational_reserve_percent: percent0to100.optional(),
    safety_lock_max_share: z.coerce.number().min(0.5).max(1).optional(),
    referral_reinvestment_percent: percent0to90.optional(),
    referral_split_ratio: ratio0to1.optional(),
    ambassador_guest_l2_enabled: z.boolean().optional(),
    ambassador_guest_pool_l1_percent: percent0to100.optional(),
    ambassador_guest_pool_l2_percent: percent0to100.optional(),
    ambassador_guest_pool_referee_percent: percent0to100.optional(),
    ambassador_guest_l2_max_thb_per_booking: thbNonNeg.optional(),
    ambassador_guest_l2_max_thb_per_month: thbNonNeg.optional(),
    referral_monthly_program_cap_thb: thbNonNeg.optional(),
    referral_withdrawal_fee_percent: percent0to100.optional(),
    mlm_level1_percent: percent0to100.optional(),
    mlm_level2_percent: percent0to100.optional(),
    partner_activation_bonus_thb: thbNonNeg.optional(),
    ambassador_3_waterfall_enabled: z.boolean().optional(),
    ambassador_3_program_cap_enabled: z.boolean().optional(),
  })
  .strict()

/**
 * Merge patch onto current normalized config (camelCase policy shape).
 */
export function mergeFintechPatch(current, patch) {
  const map = {
    acquiring_fee_percent: 'acquiringFeePercent',
    usn_provision_percent: 'usnProvisionPercent',
    vat_provision_percent: 'vatProvisionPercent',
    reserve_bank_percent: 'reserveBankPercent',
    operational_reserve_percent: 'operationalReservePercent',
    safety_lock_max_share: 'safetyLockMaxShare',
    referral_reinvestment_percent: 'referralReinvestmentPercent',
    referral_split_ratio: 'referralSplitRatio',
    ambassador_guest_l2_enabled: 'ambassadorGuestL2Enabled',
    ambassador_guest_pool_l1_percent: 'ambassadorGuestPoolL1Percent',
    ambassador_guest_pool_l2_percent: 'ambassadorGuestPoolL2Percent',
    ambassador_guest_pool_referee_percent: 'ambassadorGuestPoolRefereePercent',
    ambassador_guest_l2_max_thb_per_booking: 'ambassadorGuestL2MaxThbPerBooking',
    ambassador_guest_l2_max_thb_per_month: 'ambassadorGuestL2MaxThbPerMonth',
    referral_monthly_program_cap_thb: 'referralMonthlyProgramCapThb',
    referral_withdrawal_fee_percent: 'referralWithdrawalFeePercent',
    mlm_level1_percent: 'mlmLevel1Percent',
    mlm_level2_percent: 'mlmLevel2Percent',
    partner_activation_bonus_thb: 'partnerActivationBonusThb',
    ambassador_3_waterfall_enabled: 'ambassador3WaterfallEnabled',
    ambassador_3_program_cap_enabled: 'ambassador3ProgramCapEnabled',
  }
  const next = { ...current }
  for (const [snake, camel] of Object.entries(map)) {
    if (patch[snake] !== undefined) next[camel] = patch[snake]
  }
  if (next.referralReinvestmentPercent > next.safetyLockMaxShare * 100) {
    next.referralReinvestmentPercent = next.safetyLockMaxShare * 100
  }
  return next
}

/**
 * @param {object} policy camelCase merged config
 */
export function validateWaterfallEnvelope(policy) {
  const errors = []
  const safetyShare = Number(policy.safetyLockMaxShare ?? 0.95)
  const reinvestment = Number(policy.referralReinvestmentPercent ?? 0)

  if (reinvestment > safetyShare * 100 + 0.001) {
    errors.push(
      `referral_reinvestment_percent (${reinvestment}%) не может превышать safety_lock_max_share (${roundPct(safetyShare * 100)}%)`,
    )
  }

  if (policy.ambassadorGuestL2Enabled) {
    const sum =
      Number(policy.ambassadorGuestPoolL1Percent) +
      Number(policy.ambassadorGuestPoolL2Percent) +
      Number(policy.ambassadorGuestPoolRefereePercent)
    if (Math.abs(sum - 100) > 0.05) {
      errors.push(`guest pool split должен суммироваться в 100% (сейчас ${sum.toFixed(2)}%)`)
    }
  }

  const mlmSum = Number(policy.mlmLevel1Percent) + Number(policy.mlmLevel2Percent)
  if (mlmSum > 100) {
    errors.push(`mlm_level1 + mlm_level2 не может превышать 100% (сейчас ${mlmSum}%)`)
  }

  const { caps } = computeAdr131ReferenceWaterfall(policy)
  const gross = 5_250
  const maxPool = gross * safetyShare
  if (caps.referralPoolThb > maxPool + 1) {
    errors.push(
      `На эталонной брони ADR pool (${caps.referralPoolThb} THB) превышает safety cap (${round2(maxPool)} THB = ${roundPct(safetyShare * 100)}% gross)`,
    )
  }

  return { ok: errors.length === 0, errors, preview: caps }
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function roundPct(n) {
  return Math.round(Number(n) * 10) / 10
}

/**
 * @param {unknown} body
 * @param {object} currentConfig normalized camelCase from SystemConfigService
 */
export function validateFintechSettingsUpdate(body, currentConfig) {
  const parsed = fintechSettingsPutSchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'VALIDATION_FAILED',
      message: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    }
  }
  if (!Object.keys(parsed.data).length) {
    return { ok: false, error: 'EMPTY_PATCH', message: 'Нет полей для обновления' }
  }

  const merged = mergeFintechPatch(currentConfig, parsed.data)
  const envelope = validateWaterfallEnvelope(merged)
  if (!envelope.ok) {
    return {
      ok: false,
      error: 'WATERFALL_ENVELOPE_EXCEEDED',
      message: envelope.errors.join('. '),
      details: envelope.errors,
    }
  }

  return { ok: true, patch: parsed.data, merged, preview: envelope.preview }
}

/** DB row patch (snake_case) from validated zod patch */
export function patchToDbRow(zodPatch) {
  return { ...zodPatch }
}

/** camelCase policy → DB columns for upsert */
export function policyToDbRow(policy) {
  return {
    acquiring_fee_percent: policy.acquiringFeePercent,
    usn_provision_percent: policy.usnProvisionPercent,
    vat_provision_percent: policy.vatProvisionPercent,
    reserve_bank_percent: policy.reserveBankPercent,
    operational_reserve_percent: policy.operationalReservePercent,
    safety_lock_max_share: policy.safetyLockMaxShare,
    referral_reinvestment_percent: policy.referralReinvestmentPercent,
    referral_split_ratio: policy.referralSplitRatio,
    ambassador_guest_l2_enabled: policy.ambassadorGuestL2Enabled,
    ambassador_guest_pool_l1_percent: policy.ambassadorGuestPoolL1Percent,
    ambassador_guest_pool_l2_percent: policy.ambassadorGuestPoolL2Percent,
    ambassador_guest_pool_referee_percent: policy.ambassadorGuestPoolRefereePercent,
    ambassador_guest_l2_max_thb_per_booking: policy.ambassadorGuestL2MaxThbPerBooking,
    ambassador_guest_l2_max_thb_per_month: policy.ambassadorGuestL2MaxThbPerMonth,
    referral_monthly_program_cap_thb: policy.referralMonthlyProgramCapThb,
    referral_withdrawal_fee_percent: policy.referralWithdrawalFeePercent,
    mlm_level1_percent: policy.mlmLevel1Percent,
    mlm_level2_percent: policy.mlmLevel2Percent,
    partner_activation_bonus_thb: policy.partnerActivationBonusThb,
    ambassador_3_waterfall_enabled: policy.ambassador3WaterfallEnabled,
    ambassador_3_program_cap_enabled: policy.ambassador3ProgramCapEnabled,
  }
}

export function dbRowToPolicy(row) {
  return normalizeFintechSettingsRow(row)
}
