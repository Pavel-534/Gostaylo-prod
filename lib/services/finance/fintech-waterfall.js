/**
 * Stage 131.0 — pure owner waterfall + referral pool preview (UI, smoke, validation).
 */
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {import('@/lib/services/finance/system-config.service.js').SystemConfigService extends { getFintechConfig: Function } ? Awaited<ReturnType<import('@/lib/services/finance/system-config.service.js').SystemConfigService['getFintechConfig']>> : object} config
 * @param {{
 *   subtotalThb?: number,
 *   guestServiceFeePercent?: number,
 *   hostCommissionPercent?: number,
 *   insuranceReserveThb?: number,
 *   fxMarkupThb?: number,
 * }} [scenario]
 */
export function computeWaterfallPreview(config, scenario = {}) {
  const subtotalThb = round2(scenario.subtotalThb ?? 35_000)
  const guestServiceFeePercent = Number(scenario.guestServiceFeePercent ?? 15)
  const hostCommissionPercent = Number(scenario.hostCommissionPercent ?? 0)
  const guestServiceFeeThb = round2(subtotalThb * (guestServiceFeePercent / 100))
  const hostCommissionThb = round2(subtotalThb * (hostCommissionPercent / 100))
  const platformGrossRevenueThb = round2(guestServiceFeeThb + hostCommissionThb)
  const guestPaymentThb = round2(subtotalThb + guestServiceFeeThb)
  const fxMarkupThb = round2(scenario.fxMarkupThb ?? 0)
  const insuranceReserveThb = round2(
    scenario.insuranceReserveThb ?? platformGrossRevenueThb * 0.005,
  )

  const feeBase = {
    guestServiceFeeThb,
    hostCommissionThb,
    platformGrossRevenueThb,
    guestPaymentThb,
    fxMarkupThb,
    ownerRevenueThb: round2(platformGrossRevenueThb + fxMarkupThb),
    insuranceReserveThb,
  }

  const netBase = ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, config)
  const caps = ReferralPolicyService.deriveSafetyCaps(netBase, config)
  const split = ReferralPolicyService.deriveGuestPoolSplit(caps.referralPoolThb, config)

  return {
    scenario: { subtotalThb, guestServiceFeePercent, hostCommissionPercent },
    feeBase,
    netBase,
    caps,
    split,
    guestPaymentThb,
    platformGrossRevenueThb,
    adjustedNetThb: netBase.adjustedNetThb ?? netBase.netProfitOrderThb,
    referralPoolThb: caps.referralPoolThb,
    ownerRetainedThb: caps.ownerRetainedThb,
    l1AmountThb: split.l1AmountThb,
    l2AmountThb: split.l2AmountThb,
    refereeAmountThb: split.refereeAmountThb,
  }
}

/** ADR-131 §8.0.A — TH domestic, 35k / 15% fee, no FX. */
export function buildAdr131ReferenceFeeBase() {
  const subtotalThb = 35_000
  const guestServiceFeeThb = 5_250
  const platformGrossRevenueThb = 5_250
  return {
    guestServiceFeeThb,
    hostCommissionThb: 0,
    platformGrossRevenueThb,
    guestPaymentThb: 40_250,
    fxMarkupThb: 0,
    ownerRevenueThb: 5_250,
    insuranceReserveThb: round2(platformGrossRevenueThb * 0.005),
  }
}

export function computeAdr131ReferenceWaterfall(config) {
  const feeBase = buildAdr131ReferenceFeeBase()
  const netBase = ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, config)
  const caps = ReferralPolicyService.deriveSafetyCaps(netBase, config)
  const split = ReferralPolicyService.deriveGuestPoolSplit(caps.referralPoolThb, config)
  return { feeBase, netBase, caps, split }
}

/** Launch policy shape for ADR reference (L2 split percents active for calculator/smoke). */
export function adr131LaunchPolicy() {
  const base = normalizeFintechSettingsRow(FINTECH_CONFIG_DEFAULTS)
  return {
    ...base,
    ambassadorGuestL2Enabled: true,
    ambassador3WaterfallEnabled: true,
  }
}

function buildReferenceTargets() {
  const policy = {
    acquiringFeePercent: 4.3,
    usnProvisionPercent: 6,
    vatProvisionPercent: 5,
    reserveBankPercent: 0.5,
    operationalReservePercent: 0,
    safetyLockMaxShare: 0.95,
    referralReinvestmentPercent: 45,
    referralSplitRatio: 0.5,
    ambassadorGuestL2Enabled: true,
    ambassadorGuestPoolL1Percent: 45,
    ambassadorGuestPoolL2Percent: 12,
    ambassadorGuestPoolRefereePercent: 43,
    ambassador3WaterfallEnabled: true,
  }
  const { netBase, caps, split } = computeAdr131ReferenceWaterfall(policy)
  const deductionsThb = round2(
    (netBase.insuranceReserveThb || 0) +
      (netBase.acquiringFeeThb || 0) +
      (netBase.usnProvisionThb || 0) +
      (netBase.vatProvisionThb || 0) +
      (netBase.reserveBankThb || 0) +
      (netBase.operationalReserveThb || 0),
  )
  return Object.freeze({
    subtotalThb: 35_000,
    guestPaymentThb: 40_250,
    platformGrossThb: 5_250,
    fxMarkupThb: 0,
    ownerRevenueThb: 5_250,
    deductionsThb,
    adjustedNetThb: netBase.adjustedNetThb,
    referralPoolThb: caps.referralPoolThb,
    ownerRetainedThb: caps.ownerRetainedThb,
    l1AmountThb: split.l1AmountThb,
    l2AmountThb: split.l2AmountThb,
    refereeAmountThb: split.refereeAmountThb,
    acquiringFeeThb: netBase.acquiringFeeThb,
    usnProvisionThb: netBase.usnProvisionThb,
    vatProvisionThb: netBase.vatProvisionThb,
    reserveBankThb: netBase.reserveBankThb,
    insuranceReserveThb: netBase.insuranceReserveThb,
  })
}

/** SSOT itemized reference — 35k / 15% / no FX (ADR §8.0.A, code truth). */
export const ADR131_REFERENCE_TARGETS = buildReferenceTargets()

/** ADR §8.0.B — TH listing, RUB pay, FX markup ~3.5% on owner revenue. */
export function buildAdr131FxReferenceFeeBase(fxMarkupThb = 1_360) {
  const base = buildAdr131ReferenceFeeBase()
  const fx = round2(fxMarkupThb)
  return {
    ...base,
    fxMarkupThb: fx,
    ownerRevenueThb: round2(base.platformGrossRevenueThb + fx),
  }
}

export function computeAdr131FxReferenceWaterfall(config, fxMarkupThb = 1_360) {
  const feeBase = buildAdr131FxReferenceFeeBase(fxMarkupThb)
  const netBase = ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, config)
  const caps = ReferralPolicyService.deriveSafetyCaps(netBase, config)
  const split = ReferralPolicyService.deriveGuestPoolSplit(caps.referralPoolThb, config)
  return { feeBase, netBase, caps, split }
}

export function buildAdr131FxReferenceTargets(fxMarkupThb = 1_360) {
  const policy = {
    acquiringFeePercent: 4.3,
    usnProvisionPercent: 6,
    vatProvisionPercent: 5,
    reserveBankPercent: 0.5,
    operationalReservePercent: 0,
    safetyLockMaxShare: 0.95,
    referralReinvestmentPercent: 45,
    ambassadorGuestL2Enabled: true,
    ambassadorGuestPoolL1Percent: 45,
    ambassadorGuestPoolL2Percent: 12,
    ambassadorGuestPoolRefereePercent: 43,
    ambassador3WaterfallEnabled: true,
  }
  const { netBase, caps, split } = computeAdr131FxReferenceWaterfall(policy, fxMarkupThb)
  const deductionsThb = round2(
    (netBase.insuranceReserveThb || 0) +
      (netBase.acquiringFeeThb || 0) +
      (netBase.usnProvisionThb || 0) +
      (netBase.vatProvisionThb || 0) +
      (netBase.reserveBankThb || 0) +
      (netBase.operationalReserveThb || 0),
  )
  return Object.freeze({
    fxMarkupThb: round2(fxMarkupThb),
    ownerRevenueThb: netBase.ownerRevenueThb,
    deductionsThb,
    adjustedNetThb: netBase.adjustedNetThb,
    referralPoolThb: caps.referralPoolThb,
    ownerRetainedThb: caps.ownerRetainedThb,
    l1AmountThb: split.l1AmountThb,
    l2AmountThb: split.l2AmountThb,
    refereeAmountThb: split.refereeAmountThb,
  })
}

export const ADR131_FX35_REFERENCE_TARGETS = buildAdr131FxReferenceTargets(1_360)
