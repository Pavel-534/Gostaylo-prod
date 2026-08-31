/**
 * Launch promo planner — what-if economics for owner (SSOT: fintech-waterfall + ReferralPolicyService).
 * Planning only; does not mutate settings or write ledger.
 */
import { computeWaterfallPreview } from '@/lib/services/finance/fintech-waterfall.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

export const LAUNCH_PLANNER_SUBTOTAL_MIN = 1_000
export const LAUNCH_PLANNER_SUBTOTAL_MAX = 500_000
export const LAUNCH_PLANNER_REINVESTMENT_MIN = 30
export const LAUNCH_PLANNER_REINVESTMENT_MAX = 80

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function clamp(n, min, max) {
  const x = Number(n)
  if (!Number.isFinite(x)) return min
  return Math.min(max, Math.max(min, x))
}

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * @param {Record<string, unknown> | null | undefined} api snake_case from GET fintech-settings
 * @param {{ referralReinvestmentPercent?: number }} [overrides]
 */
export function fintechSettingsToPolicy(api, overrides = {}) {
  const d = FINTECH_CONFIG_DEFAULTS
  const l3Enabled = api?.ambassador_guest_l3_enabled === true
  return {
    acquiringFeePercent: num(api?.acquiring_fee_percent, d.acquiring_fee_percent),
    usnProvisionPercent: num(api?.usn_provision_percent, d.usn_provision_percent),
    vatProvisionPercent: num(api?.vat_provision_percent, d.vat_provision_percent),
    reserveBankPercent: num(api?.reserve_bank_percent, d.reserve_bank_percent),
    operationalReservePercent: num(api?.operational_reserve_percent, d.operational_reserve_percent),
    safetyLockMaxShare: num(api?.safety_lock_max_share, d.safety_lock_max_share),
    referralReinvestmentPercent: clamp(
      overrides.referralReinvestmentPercent ?? num(api?.referral_reinvestment_percent, d.referral_reinvestment_percent),
      LAUNCH_PLANNER_REINVESTMENT_MIN,
      LAUNCH_PLANNER_REINVESTMENT_MAX,
    ),
    referralSplitRatio: num(api?.referral_split_ratio, d.referral_split_ratio),
    ambassadorGuestL2Enabled: api?.ambassador_guest_l2_enabled !== false,
    ambassadorGuestL3Enabled: l3Enabled,
    ambassadorGuestPoolL1Percent: num(api?.ambassador_guest_pool_l1_percent, d.ambassador_guest_pool_l1_percent),
    ambassadorGuestPoolL2Percent: num(api?.ambassador_guest_pool_l2_percent, d.ambassador_guest_pool_l2_percent),
    ambassadorGuestPoolL3Percent: l3Enabled ? num(api?.ambassador_guest_pool_l3_percent, d.ambassador_guest_pool_l3_percent) : 0,
    ambassadorGuestPoolRefereePercent: num(
      api?.ambassador_guest_pool_referee_percent,
      d.ambassador_guest_pool_referee_percent,
    ),
    ambassador3WaterfallEnabled: api?.ambassador_3_waterfall_enabled !== false,
    referralMonthlyProgramCapThb: num(api?.referral_monthly_program_cap_thb, d.referral_monthly_program_cap_thb),
    partnerActivationBonusThb: num(api?.partner_activation_bonus_thb, d.partner_activation_bonus_thb),
  }
}

/**
 * @param {object} raw
 */
export function normalizePlannerInputs(raw = {}) {
  const subtotalThb = clamp(
    Math.round(num(raw.subtotalThb, 10_000)),
    LAUNCH_PLANNER_SUBTOTAL_MIN,
    LAUNCH_PLANNER_SUBTOTAL_MAX,
  )
  const guestServiceFeePercent = clamp(num(raw.guestServiceFeePercent, 15), 0, 100)
  const referralReinvestmentPercent = clamp(
    num(raw.referralReinvestmentPercent, 45),
    LAUNCH_PLANNER_REINVESTMENT_MIN,
    LAUNCH_PLANNER_REINVESTMENT_MAX,
  )
  const totalBookingsPerMonth = Math.max(0, Math.floor(num(raw.totalBookingsPerMonth, 100)))
  let referralBookingsPerMonth = Math.max(0, Math.floor(num(raw.referralBookingsPerMonth, totalBookingsPerMonth)))
  if (referralBookingsPerMonth > totalBookingsPerMonth) {
    referralBookingsPerMonth = totalBookingsPerMonth
  }
  const turboBoostThbPerBooking = clamp(num(raw.turboBoostThbPerBooking, 0), 0, 1_000_000)
  const promoTankThb = clamp(num(raw.promoTankThb, 0), 0, 1_000_000_000)
  const hostActivationsPerMonth = Math.max(0, Math.floor(num(raw.hostActivationsPerMonth, 0)))

  return {
    subtotalThb,
    guestServiceFeePercent,
    referralReinvestmentPercent,
    totalBookingsPerMonth,
    referralBookingsPerMonth,
    turboBoostThbPerBooking,
    promoTankThb,
    hostActivationsPerMonth,
  }
}

function mapPreviewToPerBooking(preview, reinvestmentPercent) {
  const net = preview.netBase || {}
  const split = preview.split || {}
  const acq = round2(net.acquiringFeeThb)
  const usn = round2(net.usnProvisionThb)
  const vat = round2(net.vatProvisionThb)
  const bank = round2(net.reserveBankThb)
  const ins = round2(net.insuranceReserveThb)
  const ops = round2(net.operationalReserveThb)
  const deductionsTotal = round2(acq + usn + vat + bank + ins + ops)

  return {
    guestPaymentThb: round2(preview.guestPaymentThb),
    platformGrossThb: round2(preview.platformGrossRevenueThb),
    deductions: {
      acquiringFeeThb: acq,
      usnProvisionThb: usn,
      vatProvisionThb: vat,
      reserveBankThb: bank,
      insuranceReserveThb: ins,
      operationalReserveThb: ops,
      totalThb: deductionsTotal,
    },
    adjustedNetThb: round2(preview.adjustedNetThb),
    referralPoolThb: round2(preview.referralPoolThb),
    ownerRetainedThb: round2(preview.ownerRetainedThb),
    safetyCapThb: round2(preview.caps?.safetyCapThb),
    poolCappedBySafety: round2(preview.caps?.referralPoolRaw) > round2(preview.caps?.referralPoolThb),
    reinvestmentPercent,
    split: {
      l1AmountThb: round2(split.l1AmountThb),
      l2AmountThb: round2(split.l2AmountThb),
      l3AmountThb: round2(split.l3AmountThb),
      refereeAmountThb: round2(split.refereeAmountThb),
    },
  }
}

/**
 * @param {ReturnType<typeof fintechSettingsToPolicy>} basePolicy
 * @param {ReturnType<typeof normalizePlannerInputs>} inputs
 */
export function computeLaunchPromoPlan(basePolicy, inputs) {
  const scenario = {
    subtotalThb: inputs.subtotalThb,
    guestServiceFeePercent: inputs.guestServiceFeePercent,
    hostCommissionPercent: 0,
  }

  const referralPolicy = {
    ...basePolicy,
    referralReinvestmentPercent: inputs.referralReinvestmentPercent,
  }
  const noReferralPolicy = { ...basePolicy, referralReinvestmentPercent: 0 }

  const referralPreview = computeWaterfallPreview(referralPolicy, scenario)
  const organicPreview = computeWaterfallPreview(noReferralPolicy, scenario)

  const perBookingReferral = mapPreviewToPerBooking(referralPreview, inputs.referralReinvestmentPercent)
  const perBookingOrganic = mapPreviewToPerBooking(organicPreview, 0)

  const refN = inputs.referralBookingsPerMonth
  const totalN = inputs.totalBookingsPerMonth
  const organicN = Math.max(0, totalN - refN)

  const monthlyPoolSpend = round2(refN * perBookingReferral.referralPoolThb)
  const monthlyTurboRequested = round2(refN * inputs.turboBoostThbPerBooking)
  const monthlyTurboSpend = round2(Math.min(monthlyTurboRequested, inputs.promoTankThb))
  const hostBonus = round2(basePolicy.partnerActivationBonusThb)
  const monthlyHostActivationRequested = round2(inputs.hostActivationsPerMonth * hostBonus)
  const tankAfterTurbo = round2(Math.max(0, inputs.promoTankThb - monthlyTurboSpend))
  const monthlyHostActivationSpend = round2(Math.min(monthlyHostActivationRequested, tankAfterTurbo))
  const monthlyPromoTankUsed = round2(monthlyTurboSpend + monthlyHostActivationSpend)

  const monthlyOwnerRetained = round2(
    refN * perBookingReferral.ownerRetainedThb + organicN * perBookingOrganic.adjustedNetThb,
  )
  const monthlyGrossCommission = round2(totalN * perBookingReferral.platformGrossThb)
  const monthlyGuestReferralOutflow = round2(
    refN * (perBookingReferral.split.l1AmountThb +
      perBookingReferral.split.l2AmountThb +
      perBookingReferral.split.l3AmountThb +
      perBookingReferral.split.refereeAmountThb),
  )

  const programCapThb = round2(basePolicy.referralMonthlyProgramCapThb)
  const capUtilizationPct =
    programCapThb > 0 ? round2(Math.min(999, (monthlyPoolSpend / programCapThb) * 100)) : 0
  const capRemainingThb = round2(Math.max(0, programCapThb - monthlyPoolSpend))
  const capExceeded = programCapThb > 0 && monthlyPoolSpend > programCapThb + 0.001
  const bookingsUntilCap =
    perBookingReferral.referralPoolThb > 0
      ? Math.floor(capRemainingThb / perBookingReferral.referralPoolThb)
      : null

  const turboRunwayBookings =
    inputs.turboBoostThbPerBooking > 0
      ? Math.floor(inputs.promoTankThb / inputs.turboBoostThbPerBooking)
      : null

  const warnings = []
  if (capExceeded) {
    warnings.push(
      `Прогноз pool ${monthlyPoolSpend} THB/мес превышает program cap ${programCapThb} THB — начисления уйдут в defer.`,
    )
  }
  if (monthlyTurboRequested > monthlyTurboSpend + 0.001) {
    warnings.push('Turbo boost не хватает promo tank на выбранный объём броней.')
  }
  if (monthlyHostActivationRequested > monthlyHostActivationSpend + 0.001) {
    warnings.push('Host activation не хватает promo tank после turbo.')
  }
  if (perBookingReferral.poolCappedBySafety) {
    warnings.push('Referral pool упёрся в safety lock (95% gross) — reinvestment фактически ниже слайдера.')
  }
  if (inputs.referralReinvestmentPercent > basePolicy.safetyLockMaxShare * 100 + 0.001) {
    warnings.push(
      `Reinvestment ${inputs.referralReinvestmentPercent}% выше safety lock ${round2(basePolicy.safetyLockMaxShare * 100)}% — в проде будет обрезано.`,
    )
  }

  return {
    inputs,
    perBookingReferral,
    perBookingOrganic,
    monthly: {
      referralBookings: refN,
      totalBookings: totalN,
      organicBookings: organicN,
      poolSpendThb: monthlyPoolSpend,
      turboSpendThb: monthlyTurboSpend,
      hostActivationSpendThb: monthlyHostActivationSpend,
      promoTankUsedThb: monthlyPromoTankUsed,
      guestReferralOutflowThb: monthlyGuestReferralOutflow,
      ownerRetainedThb: monthlyOwnerRetained,
      grossCommissionThb: monthlyGrossCommission,
      programCapThb,
      capUtilizationPct,
      capRemainingThb,
      capExceeded,
      bookingsUntilCap,
      turboRunwayBookings,
    },
    warnings,
  }
}
