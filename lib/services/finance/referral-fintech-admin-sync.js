/**
 * Stage 131.6 — SSOT bridge: marketing admin UI ↔ system_fintech_settings.
 * Fintech table is the sole runtime source for referral waterfall knobs.
 */
import { updateFintechSettings } from '@/lib/services/finance/fintech-settings.service.js'

/** Keys written to system_settings.general (promo tank + UX knobs only). */
export const MARKETING_GENERAL_ONLY_KEYS = Object.freeze([
  'marketing_promo_pot',
  'marketingPromoPot',
  'promo_boost_per_booking',
  'promoBoostPerBooking',
  'promo_turbo_mode_enabled',
  'promoTurboModeEnabled',
  'organic_to_promo_pot_percent',
  'organicToPromoPotPercent',
  'referral_boost_allocation_rule',
  'referralBoostAllocationRule',
  'payout_to_internal_ratio',
  'payoutToInternalRatio',
  'welcome_bonus_amount',
  'welcomeBonusAmount',
  'referral_monthly_goal_thb',
  'referralMonthlyGoalThb',
  'referral_hold_days',
  'referralHoldDays',
])

/** Legacy general keys that must not be persisted (fintech SSOT). */
export const MARKETING_FINTECH_LEGACY_GENERAL_KEYS = Object.freeze([
  'referral_reinvestment_percent',
  'referralReinvestmentPercent',
  'referral_split_ratio',
  'referralSplitRatio',
  'acquiring_fee_percent',
  'acquiringFeePercent',
  'operational_reserve_percent',
  'operationalReservePercent',
  'partner_activation_bonus',
  'partnerActivationBonus',
  'mlm_level1_percent',
  'mlmLevel1Percent',
  'mlm_level2_percent',
  'mlmLevel2Percent',
])

function asNumber(value, fallback = NaN) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Build snake_case patch for system_fintech_settings from marketing admin body.
 * @param {object} body
 * @param {object} [prevGeneral] legacy general.value for fallbacks when field omitted
 */
export function buildFintechPatchFromMarketingBody(body, prevGeneral = {}) {
  const prev = prevGeneral && typeof prevGeneral === 'object' ? prevGeneral : {}
  const patch = {}

  const reinvestment = asNumber(body?.referralReinvestmentPercent ?? body?.referral_reinvestment_percent)
  if (Number.isFinite(reinvestment)) patch.referral_reinvestment_percent = reinvestment
  else {
    const p = asNumber(prev?.referral_reinvestment_percent ?? prev?.referralReinvestmentPercent)
    if (Number.isFinite(p)) patch.referral_reinvestment_percent = p
  }

  const split = asNumber(body?.referralSplitRatio ?? body?.referral_split_ratio)
  if (Number.isFinite(split)) patch.referral_split_ratio = split
  else {
    const p = asNumber(prev?.referral_split_ratio ?? prev?.referralSplitRatio)
    if (Number.isFinite(p)) patch.referral_split_ratio = p
  }

  const acquiring = asNumber(body?.acquiringFeePercent ?? body?.acquiring_fee_percent)
  if (Number.isFinite(acquiring)) patch.acquiring_fee_percent = acquiring
  else {
    const p = asNumber(prev?.acquiring_fee_percent ?? prev?.acquiringFeePercent)
    if (Number.isFinite(p)) patch.acquiring_fee_percent = p
  }

  const operational = asNumber(body?.operationalReservePercent ?? body?.operational_reserve_percent)
  if (Number.isFinite(operational)) patch.operational_reserve_percent = operational
  else {
    const p = asNumber(prev?.operational_reserve_percent ?? prev?.operationalReservePercent)
    if (Number.isFinite(p)) patch.operational_reserve_percent = p
  }

  const mlm1 = asNumber(body?.mlmLevel1Percent ?? body?.mlm_level1_percent)
  if (Number.isFinite(mlm1)) patch.mlm_level1_percent = mlm1
  else {
    const p = asNumber(prev?.mlm_level1_percent ?? prev?.mlmLevel1Percent)
    if (Number.isFinite(p)) patch.mlm_level1_percent = p
  }

  const mlm2 = asNumber(body?.mlmLevel2Percent ?? body?.mlm_level2_percent)
  if (Number.isFinite(mlm2)) patch.mlm_level2_percent = mlm2
  else {
    const p = asNumber(prev?.mlm_level2_percent ?? prev?.mlmLevel2Percent)
    if (Number.isFinite(p)) patch.mlm_level2_percent = p
  }

  const activation = asNumber(body?.partnerActivationBonus ?? body?.partner_activation_bonus)
  if (Number.isFinite(activation)) patch.partner_activation_bonus_thb = activation
  else {
    const p = asNumber(prev?.partner_activation_bonus ?? prev?.partnerActivationBonus)
    if (Number.isFinite(p)) patch.partner_activation_bonus_thb = p
  }

  return patch
}

/**
 * Remove fintech SSOT keys from a general settings object before upsert.
 * @param {object} value
 */
export function stripFintechKeysFromGeneralValue(value) {
  if (!value || typeof value !== 'object') return value
  const next = { ...value }
  for (const k of MARKETING_FINTECH_LEGACY_GENERAL_KEYS) {
    delete next[k]
  }
  return next
}

/**
 * Overlay fintech policy onto admin settings response (camelCase API shape).
 * @param {object} settings
 * @param {object} policy normalized fintech policy (camelCase)
 */
export function overlayFintechOnAdminSettings(settings, policy) {
  if (!policy || typeof policy !== 'object') return settings
  return {
    ...settings,
    referralReinvestmentPercent: policy.referralReinvestmentPercent,
    referralSplitRatio: policy.referralSplitRatio,
    acquiringFeePercent: policy.acquiringFeePercent,
    operationalReservePercent: policy.operationalReservePercent,
    partnerActivationBonus: policy.partnerActivationBonusThb,
    mlmLevel1Percent: policy.mlmLevel1Percent,
    mlmLevel2Percent: policy.mlmLevel2Percent,
  }
}

/**
 * Persist fintech patch from marketing admin save.
 * @param {object} fintechPatch snake_case keys
 * @param {string | null} updatedBy staff profile id
 */
export async function syncMarketingPatchToFintech(fintechPatch, updatedBy) {
  if (!fintechPatch || typeof fintechPatch !== 'object' || !Object.keys(fintechPatch).length) {
    return { success: true, skipped: true }
  }
  return updateFintechSettings(fintechPatch, updatedBy)
}
