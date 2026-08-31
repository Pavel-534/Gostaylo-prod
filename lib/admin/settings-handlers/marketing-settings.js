import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { findIgnoredFintechKeysInMarketingBody } from '@/lib/admin/fintech-owner-canon.js'

function asNumber(value, fallback = NaN) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function buildReferralSafetyGuard(values) {
  const budget = ReferralPnlService.computePlatformMarginBudget(values)
  const errors = []
  if (budget.mlmLevelsTotalPercent > 100) {
    errors.push('Сумма долей «прямой» и «второй линии» не может быть больше 100%.')
  }
  if (!budget.isWithinMargin) {
    errors.push(
      `Выплаты и издержки (${budget.projectedTotalBurnPercent.toFixed(2)}%) превышают маржу платформы (${budget.platformMarginPercent.toFixed(2)}%). Уменьшите бонусы или комиссии.`,
    )
  }
  if (budget.platformMarginPercent <= 0) {
    errors.push('Маржа платформы должна быть больше нуля — проверьте сервисный сбор гостя и комиссию хоста.')
  }
  return { ok: errors.length === 0, errors, budget }
}

function resolveFintechPolicyField(fintechPolicy, camelKey, snakeKey, defaultValue) {
  const fromPolicy = fintechPolicy?.[camelKey]
  if (Number.isFinite(Number(fromPolicy))) return Number(fromPolicy)
  return defaultValue
}

/**
 * Marketing settings patch — promo tank / UX knobs only.
 * FinTech SSOT (acquiring, reinvestment, pool split, host activation %) — FinTech panel only (Stage 202.21).
 *
 * @param {object} body
 * @param {object} [prev]
 * @param {object} [safetyInputs]
 * @param {object} [safetyInputs.fintechPolicy] camelCase from SystemConfigService.getFintechConfig()
 */
export function buildMarketingSettingsPatch(body, prev = {}, safetyInputs = {}) {
  const ignoredFintechKeys = findIgnoredFintechKeysInMarketingBody(body)
  const fintech = safetyInputs.fintechPolicy || {}
  const d = FINTECH_CONFIG_DEFAULTS

  const acquiringForGuard = resolveFintechPolicyField(
    fintech,
    'acquiringFeePercent',
    'acquiring_fee_percent',
    d.acquiring_fee_percent,
  )
  const reinvestmentForGuard = resolveFintechPolicyField(
    fintech,
    'referralReinvestmentPercent',
    'referral_reinvestment_percent',
    d.referral_reinvestment_percent,
  )
  const operationalForGuard = resolveFintechPolicyField(
    fintech,
    'operationalReservePercent',
    'operational_reserve_percent',
    d.operational_reserve_percent,
  )
  const mlm1ForGuard = resolveFintechPolicyField(fintech, 'mlmLevel1Percent', 'mlm_level1_percent', d.mlm_level1_percent)
  const mlm2ForGuard = resolveFintechPolicyField(fintech, 'mlmLevel2Percent', 'mlm_level2_percent', d.mlm_level2_percent)

  const resolvedMarketingPromoPot = (() => {
    const n = asNumber(body?.marketingPromoPot ?? body?.marketing_promo_pot)
    return Number.isFinite(n) && n >= 0 ? n : asNumber(prev?.marketing_promo_pot ?? prev?.marketingPromoPot, 0)
  })()
  const resolvedPromoBoostPerBooking = (() => {
    const n = asNumber(body?.promoBoostPerBooking ?? body?.promo_boost_per_booking)
    return Number.isFinite(n) && n >= 0 ? n : asNumber(prev?.promo_boost_per_booking ?? prev?.promoBoostPerBooking, 0)
  })()
  const resolvedPromoTurboModeEnabled =
    body?.promoTurboModeEnabled === true || body?.promo_turbo_mode_enabled === true
      ? true
      : body?.promoTurboModeEnabled === false || body?.promo_turbo_mode_enabled === false
        ? false
        : prev?.promo_turbo_mode_enabled === true || prev?.promoTurboModeEnabled === true
  const resolvedOrganicToPromoPotPercent = (() => {
    const n = asNumber(body?.organicToPromoPotPercent ?? body?.organic_to_promo_pot_percent)
    return Number.isFinite(n) && n >= 0 && n <= 100
      ? n
      : asNumber(prev?.organic_to_promo_pot_percent ?? prev?.organicToPromoPotPercent, 0)
  })()
  const resolvedReferralBoostAllocationRule = (() => {
    const r = String(
      body?.referralBoostAllocationRule ?? body?.referral_boost_allocation_rule ?? '',
    ).toLowerCase()
    if (r === '100_to_referrer' || r === '100_to_referee' || r === 'split_50_50') return r
    return String(prev?.referral_boost_allocation_rule ?? prev?.referralBoostAllocationRule ?? 'split_50_50').toLowerCase()
  })()
  const resolvedPayoutToInternalRatio = (() => {
    const n = asNumber(body?.payoutToInternalRatio ?? body?.payout_to_internal_ratio)
    return Number.isFinite(n) && n >= 0 && n <= 100
      ? n
      : asNumber(prev?.payout_to_internal_ratio ?? prev?.payoutToInternalRatio, 70)
  })()
  const resolvedWelcomeBonusAmount = (() => {
    const n = asNumber(body?.welcomeBonusAmount ?? body?.welcome_bonus_amount)
    return Number.isFinite(n) && n >= 0 ? n : asNumber(prev?.welcome_bonus_amount ?? prev?.welcomeBonusAmount, 0)
  })()
  const resolvedReferralMonthlyGoalThb = (() => {
    const n = asNumber(body?.referralMonthlyGoalThb ?? body?.referral_monthly_goal_thb)
    if (Number.isFinite(n) && n > 0 && n <= 999999999) return Math.round(n * 100) / 100
    return asNumber(prev?.referral_monthly_goal_thb ?? prev?.referralMonthlyGoalThb, 10000)
  })()
  const resolvedReferralHoldDays = (() => {
    const n = parseInt(String(body?.referralHoldDays ?? body?.referral_hold_days ?? ''), 10)
    if (Number.isFinite(n) && n >= 0 && n <= 90) return n
    const prevN = parseInt(String(prev?.referral_hold_days ?? prev?.referralHoldDays ?? ''), 10)
    return Number.isFinite(prevN) && prevN >= 0 && prevN <= 90 ? prevN : 14
  })()

  const guard = buildReferralSafetyGuard({
    guestServiceFeePercent: safetyInputs.guestServiceFeePercent,
    hostCommissionPercent: safetyInputs.hostCommissionPercent,
    insuranceFundPercent: safetyInputs.insuranceFundPercent,
    acquiringFeePercent: acquiringForGuard,
    operationalReservePercent: operationalForGuard,
    taxRatePercent: safetyInputs.taxRatePercent,
    referralReinvestmentPercent: reinvestmentForGuard,
    mlmLevel1Percent: mlm1ForGuard,
    mlmLevel2Percent: mlm2ForGuard,
  })
  if (!guard.ok) {
    return { ok: false, error: 'SAFETY_GATE_REJECTED', details: guard.errors, budget: guard.budget }
  }

  return {
    ok: true,
    ignoredFintechKeys,
    patch: {
      marketing_promo_pot: resolvedMarketingPromoPot,
      promo_boost_per_booking: resolvedPromoBoostPerBooking,
      promo_turbo_mode_enabled: resolvedPromoTurboModeEnabled === true,
      organic_to_promo_pot_percent: resolvedOrganicToPromoPotPercent,
      referral_boost_allocation_rule: resolvedReferralBoostAllocationRule,
      payoutToInternalRatio: resolvedPayoutToInternalRatio,
      payout_to_internal_ratio: resolvedPayoutToInternalRatio,
      welcome_bonus_amount: resolvedWelcomeBonusAmount,
      referralMonthlyGoalThb: resolvedReferralMonthlyGoalThb,
      referral_monthly_goal_thb: resolvedReferralMonthlyGoalThb,
      marketingPromoPot: resolvedMarketingPromoPot,
      promoBoostPerBooking: resolvedPromoBoostPerBooking,
      promoTurboModeEnabled: resolvedPromoTurboModeEnabled === true,
      organicToPromoPotPercent: resolvedOrganicToPromoPotPercent,
      referralBoostAllocationRule: resolvedReferralBoostAllocationRule,
      welcomeBonusAmount: resolvedWelcomeBonusAmount,
      referralMonthlyGoalThb: resolvedReferralMonthlyGoalThb,
      referral_hold_days: resolvedReferralHoldDays,
      referralHoldDays: resolvedReferralHoldDays,
    },
    budget: guard.budget,
  }
}
