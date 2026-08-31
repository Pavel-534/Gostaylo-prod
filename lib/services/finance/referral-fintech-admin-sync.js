/**
 * Stage 131.6 — SSOT bridge: marketing admin UI ↔ system_fintech_settings.
 * Fintech table is the sole runtime source for referral waterfall knobs.
 */
import { updateFintechSettings } from '@/lib/services/finance/fintech-settings.service.js'
import {
  MARKETING_FINTECH_LEGACY_GENERAL_KEYS,
  MARKETING_GENERAL_ONLY_KEYS,
} from '@/lib/admin/marketing-fintech-legacy-keys.js'

export { MARKETING_FINTECH_LEGACY_GENERAL_KEYS, MARKETING_GENERAL_ONLY_KEYS }

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
 * @deprecated Stage 202.21 — Marketing admin no longer syncs fintech SSOT. FinTech panel only.
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
