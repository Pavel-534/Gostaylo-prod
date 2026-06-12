/**
 * Stage 109.1 — referral math, policy settings, margin budget (SSOT helpers).
 */
import { PricingService } from '@/lib/services/pricing.service';
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js';
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js';
import { resolveFintechPolicyForBooking } from '@/lib/services/finance/fintech-snapshot.service.js';

export const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
});

export const REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  EARNED: 'earned',
  /** Stage 121.1 — earned accrual in hold; wallet credit after unlock_at. */
  EARNED_HELD: 'earned_held',
  CANCELED: 'canceled',
  /** Stage 119.1 — clawback при недостатке средств на кошельке (metadata.deficit_thb). */
  CANCELED_DEFICIT: 'canceled_deficit',
});

/** Stage 72.2 — ledger attribution (guest booking vs invited-partner host activation). */
export const REFERRAL_LEDGER_REFERRAL_TYPE = Object.freeze({
  GUEST_BOOKING: 'guest_booking',
  HOST_ACTIVATION: 'host_activation',
});

const DEFAULT_OPERATIONAL_RESERVE_PERCENT = 0;
const DEFAULT_MARKETING_PROMO_POT = 0;
const DEFAULT_PROMO_BOOST_PER_BOOKING = 0;
const DEFAULT_ORGANIC_TO_PROMO_POT_PERCENT = 0;
const DEFAULT_REFERRAL_BOOST_ALLOCATION_RULE = 'split_50_50';
const DEFAULT_REFERRAL_HOLD_DAYS = 14;

export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export async function getReferralSettings() {
  const general = await PricingService.getGeneralPricingSettings();
  const rawReinvestment = Number(
    general?.referral_reinvestment_percent ?? general?.referralReinvestmentPercent,
  );
  const rawSplit = Number(general?.referral_split_ratio ?? general?.referralSplitRatio);
  const rawAcquiring = Number(general?.acquiring_fee_percent ?? general?.acquiringFeePercent);
  const rawOperational = Number(
    general?.operational_reserve_percent ?? general?.operationalReservePercent,
  );
  const rawPromoPot = Number(general?.marketing_promo_pot ?? general?.marketingPromoPot);
  const rawBoost = Number(general?.promo_boost_per_booking ?? general?.promoBoostPerBooking);
  const rawOrganicToPot = Number(
    general?.organic_to_promo_pot_percent ?? general?.organicToPromoPotPercent,
  );
  const rawBoostAllocationRule = String(
    general?.referral_boost_allocation_rule ??
      general?.referralBoostAllocationRule ??
      DEFAULT_REFERRAL_BOOST_ALLOCATION_RULE,
  ).toLowerCase();
  const rawReferralHoldDays = Number(general?.referral_hold_days ?? general?.referralHoldDays);
  return {
    referralReinvestmentPercent: fintech.referralReinvestmentPercent,
    referralSplitRatio: fintech.referralSplitRatio,
    acquiringFeePercent: fintech.acquiringFeePercent,
    usnProvisionPercent: fintech.usnProvisionPercent,
    vatProvisionPercent: fintech.vatProvisionPercent,
    reserveBankPercent: fintech.reserveBankPercent,
    safetyLockMaxShare: fintech.safetyLockMaxShare,
    ambassadorGuestL2Enabled: fintech.ambassadorGuestL2Enabled,
    ambassadorGuestPoolL1Percent: fintech.ambassadorGuestPoolL1Percent,
    ambassadorGuestPoolL2Percent: fintech.ambassadorGuestPoolL2Percent,
    ambassadorGuestPoolRefereePercent: fintech.ambassadorGuestPoolRefereePercent,
    ambassadorGuestL2MaxThbPerBooking: fintech.ambassadorGuestL2MaxThbPerBooking,
    ambassadorGuestL2MaxThbPerMonth: fintech.ambassadorGuestL2MaxThbPerMonth,
    referralMonthlyProgramCapThb: fintech.referralMonthlyProgramCapThb,
    referralWithdrawalFeePercent: fintech.referralWithdrawalFeePercent,
    ambassador3WaterfallEnabled: fintech.ambassador3WaterfallEnabled,
    ambassador3ProgramCapEnabled: fintech.ambassador3ProgramCapEnabled,
    operationalReservePercent: clamp(
      Number.isFinite(fintech.operationalReservePercent)
        ? fintech.operationalReservePercent
        : Number.isFinite(rawOperational)
          ? rawOperational
          : DEFAULT_OPERATIONAL_RESERVE_PERCENT,
      0,
      100,
    ),
    marketingPromoPot: round2(
      clamp(Number.isFinite(rawPromoPot) ? rawPromoPot : DEFAULT_MARKETING_PROMO_POT, 0, 1_000_000_000),
    ),
    promoBoostPerBooking: round2(
      clamp(Number.isFinite(rawBoost) ? rawBoost : DEFAULT_PROMO_BOOST_PER_BOOKING, 0, 1_000_000_000),
    ),
    promoTurboModeEnabled:
      general?.promo_turbo_mode_enabled === true || general?.promoTurboModeEnabled === true,
    organicToPromoPotPercent: clamp(
      Number.isFinite(rawOrganicToPot) ? rawOrganicToPot : DEFAULT_ORGANIC_TO_PROMO_POT_PERCENT,
      0,
      100,
    ),
    referralBoostAllocationRule:
      rawBoostAllocationRule === '100_to_referrer' ||
      rawBoostAllocationRule === '100_to_referee' ||
      rawBoostAllocationRule === 'split_50_50'
        ? rawBoostAllocationRule
        : DEFAULT_REFERRAL_BOOST_ALLOCATION_RULE,
    partnerActivationBonusThb: fintech.partnerActivationBonusThb,
    mlmLevel1Percent: fintech.mlmLevel1Percent,
    mlmLevel2Percent: fintech.mlmLevel2Percent,
    mlmLevelsTotalPercent: round2(fintech.mlmLevel1Percent + fintech.mlmLevel2Percent),
    referralHoldDays: clamp(
      Number.isFinite(rawReferralHoldDays) ? rawReferralHoldDays : DEFAULT_REFERRAL_HOLD_DAYS,
      0,
      90,
    ),
  };
}

export function computePlatformMarginBudget({
  guestServiceFeePercent,
  hostCommissionPercent,
  insuranceFundPercent,
  acquiringFeePercent,
  operationalReservePercent,
  taxRatePercent,
  referralReinvestmentPercent,
  mlmLevel1Percent,
  mlmLevel2Percent,
}) {
  const guestFee = clamp(guestServiceFeePercent, 0, 100);
  const hostFee = clamp(hostCommissionPercent, 0, 100);
  const insurance = clamp(insuranceFundPercent, 0, 100);
  const acquiring = clamp(acquiringFeePercent, 0, 100);
  const operational = clamp(operationalReservePercent, 0, 100);
  const tax = clamp(taxRatePercent, 0, 100);
  const reinvestment = clamp(referralReinvestmentPercent, 0, 100);
  const mlmL1 = clamp(mlmLevel1Percent, 0, 100);
  const mlmL2 = clamp(mlmLevel2Percent, 0, 100);
  const mlmLevelsTotalPercent = round2(mlmL1 + mlmL2);

  const platformMarginPercent = round2(guestFee + hostFee);
  const fixedCostPercent = round2(insurance + acquiring + operational + tax);
  const adjustedMarginPercent = round2(Math.max(0, platformMarginPercent - fixedCostPercent));
  const projectedReferralPercent = round2(adjustedMarginPercent * (reinvestment / 100));
  const projectedTotalBurnPercent = round2(projectedReferralPercent + fixedCostPercent);
  const isMlmSplitValid = mlmLevelsTotalPercent <= 100;
  const isWithinMargin = projectedTotalBurnPercent <= platformMarginPercent + 0.0001;
  return {
    platformMarginPercent,
    fixedCostPercent,
    adjustedMarginPercent,
    projectedReferralPercent,
    projectedTotalBurnPercent,
    referralReinvestmentPercent: reinvestment,
    mlmLevel1Percent: mlmL1,
    mlmLevel2Percent: mlmL2,
    mlmLevelsTotalPercent,
    isMlmSplitValid,
    isWithinMargin,
  };
}

export function computeBoostSplit(boostThb, rule) {
  const boost = round2(Math.max(0, boostThb));
  const r = String(rule || '').toLowerCase();
  if (boost <= 0) return { referrerBoostThb: 0, refereeBoostThb: 0 };
  if (r === '100_to_referrer') {
    return { referrerBoostThb: boost, refereeBoostThb: 0 };
  }
  if (r === '100_to_referee') {
    return { referrerBoostThb: 0, refereeBoostThb: boost };
  }
  const referrerBoostThb = round2(boost / 2);
  return {
    referrerBoostThb,
    refereeBoostThb: round2(boost - referrerBoostThb),
  };
}

export function deriveFeeBaseFromBooking(booking) {
  return ReferralPolicyService.deriveFeeBaseFromBooking(booking);
}

export function deriveNetProfitAfterVariableCosts(feeBase, policy) {
  return ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, policy);
}

export function deriveSafetyCaps(netBase, policy) {
  return ReferralPolicyService.deriveSafetyCaps(netBase, policy);
}

export function resolveLiveGuestPoolPayout(referralPoolThb, policy) {
  return ReferralPolicyService.resolveLiveGuestPoolPayout(referralPoolThb, policy);
}
