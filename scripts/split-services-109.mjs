/**
 * Stage 109.1 — split referral-pnl.service.js and dispute.service.js into modules.
 * Run: node scripts/split-services-109.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

function write(rel, content) {
  const full = path.join(root, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, content, 'utf8')
  return full
}

function lineCount(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').split('\n').length
}

// --- referral-pnl ---
const referralSrc = fs.readFileSync(
  path.join(root, 'lib/services/marketing/referral-pnl.service.js'),
  'utf8',
)

write(
  'lib/services/marketing/referral-calculation.js',
  `/**
 * Stage 109.1 — referral math, policy settings, margin budget (SSOT helpers).
 */
import { PricingService } from '@/lib/services/pricing.service';
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js';

export const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
});

export const REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  EARNED: 'earned',
  CANCELED: 'canceled',
});

/** Stage 72.2 — ledger attribution (guest booking vs invited-partner host activation). */
export const REFERRAL_LEDGER_REFERRAL_TYPE = Object.freeze({
  GUEST_BOOKING: 'guest_booking',
  HOST_ACTIVATION: 'host_activation',
});

const DEFAULT_REFERRAL_REINVESTMENT_PERCENT = 70;
const DEFAULT_REFERRAL_SPLIT_RATIO = 0.5;
const DEFAULT_ACQUIRING_FEE_PERCENT = 0;
const DEFAULT_OPERATIONAL_RESERVE_PERCENT = 0;
const DEFAULT_MARKETING_PROMO_POT = 0;
const DEFAULT_PROMO_BOOST_PER_BOOKING = 0;
const DEFAULT_ORGANIC_TO_PROMO_POT_PERCENT = 0;
const DEFAULT_REFERRAL_BOOST_ALLOCATION_RULE = 'split_50_50';
const DEFAULT_PARTNER_ACTIVATION_BONUS = 500;
const DEFAULT_MLM_LEVEL1_PERCENT = 70;
const DEFAULT_MLM_LEVEL2_PERCENT = 30;
const SAFETY_LOCK_MAX_SHARE = 0.95;

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
  return \`\${prefix}-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 8)}\`;
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
  const rawPartnerActivationBonus = Number(
    general?.partner_activation_bonus ?? general?.partnerActivationBonus,
  );
  const rawMlmLevel1Percent = Number(general?.mlm_level1_percent ?? general?.mlmLevel1Percent);
  const rawMlmLevel2Percent = Number(general?.mlm_level2_percent ?? general?.mlmLevel2Percent);
  const mlmLevel1Percent = clamp(
    Number.isFinite(rawMlmLevel1Percent) ? rawMlmLevel1Percent : DEFAULT_MLM_LEVEL1_PERCENT,
    0,
    100,
  );
  const mlmLevel2Percent = clamp(
    Number.isFinite(rawMlmLevel2Percent) ? rawMlmLevel2Percent : DEFAULT_MLM_LEVEL2_PERCENT,
    0,
    100,
  );
  return {
    referralReinvestmentPercent: clamp(
      Number.isFinite(rawReinvestment) ? rawReinvestment : DEFAULT_REFERRAL_REINVESTMENT_PERCENT,
      0,
      SAFETY_LOCK_MAX_SHARE * 100,
    ),
    referralSplitRatio: clamp(Number.isFinite(rawSplit) ? rawSplit : DEFAULT_REFERRAL_SPLIT_RATIO, 0, 1),
    acquiringFeePercent: clamp(
      Number.isFinite(rawAcquiring) ? rawAcquiring : DEFAULT_ACQUIRING_FEE_PERCENT,
      0,
      100,
    ),
    operationalReservePercent: clamp(
      Number.isFinite(rawOperational) ? rawOperational : DEFAULT_OPERATIONAL_RESERVE_PERCENT,
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
    partnerActivationBonusThb: round2(
      clamp(
        Number.isFinite(rawPartnerActivationBonus)
          ? rawPartnerActivationBonus
          : DEFAULT_PARTNER_ACTIVATION_BONUS,
        0,
        1_000_000_000,
      ),
    ),
    mlmLevel1Percent,
    mlmLevel2Percent,
    mlmLevelsTotalPercent: round2(mlmLevel1Percent + mlmLevel2Percent),
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
`,
)

// Extract payout + stats bodies from original by re-importing after we replace main file
// Strategy: keep implementation in submodules imported by thin facade

write(
  'lib/services/marketing/referral-stats.service.js',
  extractClassMethodsToModule(referralSrc, 'ReferralStatsService', [
    'normalizeTierRow',
    'getReferralTiers',
    'tierRankIndex',
    'cohortMonthAnchorUtc',
    'addMonthsUtc',
    'buildCohortRoiSeries',
    'chunkArray',
    'resolveTierForPartnerCount',
    'countDirectPartnersInvited',
    'syncAmbassadorTierForUser',
    'getMonitorStats',
    'getAnalyticsStats',
  ]),
)

write(
  'lib/services/marketing/referral-payout.service.js',
  extractClassMethodsToModule(referralSrc, 'ReferralPayoutService', [
    'adjustMarketingPromoPot',
    'applyOrganicTopup',
    'applyPromoBoost',
    'creditWalletFromEarnedRows',
    'getBookingForDistribution',
    'getReferralRelationByReferee',
    'getLedgerRowsForBooking',
    'createPendingLedgerRows',
    'createPendingRows',
    'normalizePendingToSafetyCap',
    'cancelPendingLedgerForBooking',
    'markPendingAsEarned',
    'distribute',
    'distributeHostPartnerActivation',
  ]),
)

function extractClassMethodsToModule(src, exportName, methodNames) {
  // Pull method bodies from ReferralPnlService class
  const methods = []
  for (const name of methodNames) {
    const re = new RegExp(
      `\\n  static (?:async )?${name}\\([^)]*\\)\\s*\\{`,
      'm',
    )
    const startMatch = src.match(re)
    if (!startMatch) throw new Error(`Method not found: ${name}`)
    const startIdx = startMatch.index + startMatch[0].length - 1
    let depth = 0
    let endIdx = startIdx
    for (let i = startIdx; i < src.length; i++) {
      const ch = src[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }
    const body = src.slice(startMatch.index, endIdx)
    methods.push(body.replace(/^  static /m, 'export async function ').replace(/^  static /m, 'export function '))
  }

  const isAsync = (block) => /export async function/.test(block)

  const header = `/**
 * Stage 109.1 — extracted from referral-pnl.service.js (${exportName}).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { recordCriticalSignal } from '@/lib/critical-telemetry.js';
import WalletService from '@/lib/services/finance/wallet.service';
import { ReferralTierSyncService } from '@/lib/services/marketing/referral-tier-sync.service.js';
import { ReferralLedgerService } from '@/lib/services/marketing/referral-ledger.service.js';
import { ReferralPromoTankService } from '@/lib/services/marketing/referral-promo-tank.service.js';
import {
  recordReferralTeamFeedAfterGuestBooking,
  recordReferralTeamFeedAfterHostActivation,
} from '@/lib/referral/referral-feed-recorder';
import {
  REFERRAL_TYPES,
  REFERRAL_STATUSES,
  REFERRAL_LEDGER_REFERRAL_TYPE,
  round2,
  clamp,
  makeId,
  safeJsonArray,
  getReferralSettings,
  computeBoostSplit,
  deriveFeeBaseFromBooking,
  deriveNetProfitAfterVariableCosts,
  deriveSafetyCaps,
} from '@/lib/services/marketing/referral-calculation.js';
import * as ReferralStats from '@/lib/services/marketing/referral-stats.service.js';

`

  let transformed = methods
    .map((block) => {
      let b = block
      b = b.replace(/\bthis\.getReferralSettings\b/g, 'getReferralSettings')
      b = b.replace(/\bthis\.computeBoostSplit\b/g, 'computeBoostSplit')
      b = b.replace(/\bthis\.deriveFeeBaseFromBooking\b/g, 'deriveFeeBaseFromBooking')
      b = b.replace(/\bthis\.deriveNetProfitAfterVariableCosts\b/g, 'deriveNetProfitAfterVariableCosts')
      b = b.replace(/\bthis\.deriveSafetyCaps\b/g, 'deriveSafetyCaps')
      b = b.replace(/\bthis\.getBookingForDistribution\b/g, 'getBookingForDistribution')
      b = b.replace(/\bthis\.getReferralRelationByReferee\b/g, 'getReferralRelationByReferee')
      b = b.replace(/\bthis\.getLedgerRowsForBooking\b/g, 'getLedgerRowsForBooking')
      b = b.replace(/\bthis\.createPendingLedgerRows\b/g, 'createPendingLedgerRows')
      b = b.replace(/\bthis\.createPendingRows\b/g, 'createPendingRows')
      b = b.replace(/\bthis\.normalizePendingToSafetyCap\b/g, 'normalizePendingToSafetyCap')
      b = b.replace(/\bthis\.markPendingAsEarned\b/g, 'markPendingAsEarned')
      b = b.replace(/\bthis\.creditWalletFromEarnedRows\b/g, 'creditWalletFromEarnedRows')
      b = b.replace(/\bthis\.applyOrganicTopup\b/g, 'applyOrganicTopup')
      b = b.replace(/\bthis\.applyPromoBoost\b/g, 'applyPromoBoost')
      b = b.replace(/\bthis\.syncAmbassadorTierForUser\b/g, 'ReferralStats.syncAmbassadorTierForUser')
      b = b.replace(/\bthis\.getReferralTiers\b/g, 'ReferralStats.getReferralTiers')
      b = b.replace(/\bthis\.chunkArray\b/g, 'ReferralStats.chunkArray')
      b = b.replace(/\bthis\.buildCohortRoiSeries\b/g, 'ReferralStats.buildCohortRoiSeries')
      b = b.replace(/\bthis\.cohortMonthAnchorUtc\b/g, 'ReferralStats.cohortMonthAnchorUtc')
      b = b.replace(/\bthis\.addMonthsUtc\b/g, 'ReferralStats.addMonthsUtc')
      b = b.replace(/\bReferralTierSyncService\./g, 'ReferralTierSyncService.')
      return b
    })
    .join('\n\n')

  // Fix static async -> export async
  transformed = transformed.replace(/^export function async /gm, 'export async function ')
  transformed = transformed.replace(/^export async function (\w+)/gm, (m, fn) => {
    const orig = methods.find((b) => b.includes(` ${fn}(`))
    if (orig && orig.includes('static async')) return `export async function ${fn}`
    return m
  })

  return header + transformed + '\n'
}

// Fix stats module - no circular import from payout
const statsContent = extractClassMethodsToModule(referralSrc, 'ReferralStatsService', [
  'normalizeTierRow',
  'getReferralTiers',
  'tierRankIndex',
  'cohortMonthAnchorUtc',
  'addMonthsUtc',
  'buildCohortRoiSeries',
  'chunkArray',
  'resolveTierForPartnerCount',
  'countDirectPartnersInvited',
  'syncAmbassadorTierForUser',
  'getMonitorStats',
  'getAnalyticsStats',
])
  .replace(
    "import * as ReferralStats from '@/lib/services/marketing/referral-stats.service.js';\n\n",
    '',
  )
  .replace(/\bthis\.getReferralSettings\b/g, 'getReferralSettings')
  .replace(/\bthis\.getReferralTiers\b/g, 'getReferralTiers')
  .replace(/\bthis\.chunkArray\b/g, 'chunkArray')
  .replace(/\bthis\.buildCohortRoiSeries\b/g, 'buildCohortRoiSeries')
  .replace(/\bthis\.cohortMonthAnchorUtc\b/g, 'cohortMonthAnchorUtc')
  .replace(/\bthis\.addMonthsUtc\b/g, 'addMonthsUtc')

write('lib/services/marketing/referral-stats.service.js', statsContent)

const payoutContent = extractClassMethodsToModule(referralSrc, 'ReferralPayoutService', [
  'adjustMarketingPromoPot',
  'applyOrganicTopup',
  'applyPromoBoost',
  'creditWalletFromEarnedRows',
  'getBookingForDistribution',
  'getReferralRelationByReferee',
  'getLedgerRowsForBooking',
  'createPendingLedgerRows',
  'createPendingRows',
  'normalizePendingToSafetyCap',
  'cancelPendingLedgerForBooking',
  'markPendingAsEarned',
  'distribute',
  'distributeHostPartnerActivation',
])

write('lib/services/marketing/referral-payout.service.js', payoutContent)

write(
  'lib/services/marketing/referral-pnl.service.js',
  `/**
 * Stage 109.1 — referral P&L facade (implementation in topic modules).
 * @deprecated Import referral-calculation / referral-stats / referral-payout for new code.
 */
import { ReferralTierSyncService } from '@/lib/services/marketing/referral-tier-sync.service.js';
import {
  REFERRAL_LEDGER_REFERRAL_TYPE,
  computePlatformMarginBudget,
  deriveFeeBaseFromBooking,
  deriveNetProfitAfterVariableCosts,
  deriveSafetyCaps,
  getReferralSettings,
  computeBoostSplit,
} from '@/lib/services/marketing/referral-calculation.js';
import * as ReferralStats from '@/lib/services/marketing/referral-stats.service.js';
import * as ReferralPayout from '@/lib/services/marketing/referral-payout.service.js';

export { REFERRAL_LEDGER_REFERRAL_TYPE } from '@/lib/services/marketing/referral-calculation.js';

export class ReferralPnlService {
  static normalizeTierRow(row) {
    return ReferralStats.normalizeTierRow(row);
  }
  static getReferralTiers() {
    return ReferralStats.getReferralTiers();
  }
  static tierRankIndex(tiers, tierId) {
    return ReferralStats.tierRankIndex(tiers, tierId);
  }
  static cohortMonthAnchorUtc(cohortMonthKey) {
    return ReferralStats.cohortMonthAnchorUtc(cohortMonthKey);
  }
  static addMonthsUtc(date, months) {
    return ReferralStats.addMonthsUtc(date, months);
  }
  static buildCohortRoiSeries(args) {
    return ReferralStats.buildCohortRoiSeries(args);
  }
  static chunkArray(arr, size) {
    return ReferralStats.chunkArray(arr, size);
  }
  static resolveTierForPartnerCount(tiers, partnersInvitedCount) {
    return ReferralStats.resolveTierForPartnerCount(tiers, partnersInvitedCount);
  }
  static countDirectPartnersInvited(referrerId) {
    return ReferralStats.countDirectPartnersInvited(referrerId);
  }
  static syncAmbassadorTierForUser(userId, context) {
    return ReferralStats.syncAmbassadorTierForUser(userId, context);
  }
  static getReferralSettings() {
    return getReferralSettings();
  }
  static computePlatformMarginBudget(args) {
    return computePlatformMarginBudget(args);
  }
  static adjustMarketingPromoPot(deltaThb, entryType, options) {
    return ReferralPayout.adjustMarketingPromoPot(deltaThb, entryType, options);
  }
  static applyOrganicTopup(args) {
    return ReferralPayout.applyOrganicTopup(args);
  }
  static applyPromoBoost(args) {
    return ReferralPayout.applyPromoBoost(args);
  }
  static computeBoostSplit(boostThb, rule) {
    return computeBoostSplit(boostThb, rule);
  }
  static creditWalletFromEarnedRows(bookingId) {
    return ReferralPayout.creditWalletFromEarnedRows(bookingId);
  }
  static deriveFeeBaseFromBooking(booking) {
    return deriveFeeBaseFromBooking(booking);
  }
  static deriveNetProfitAfterVariableCosts(feeBase, policy) {
    return deriveNetProfitAfterVariableCosts(feeBase, policy);
  }
  static deriveSafetyCaps(netBase, policy) {
    return deriveSafetyCaps(netBase, policy);
  }
  static getBookingForDistribution(bookingId) {
    return ReferralPayout.getBookingForDistribution(bookingId);
  }
  static getReferralRelationByReferee(refereeId) {
    return ReferralPayout.getReferralRelationByReferee(refereeId);
  }
  static getLedgerRowsForBooking(bookingId) {
    return ReferralPayout.getLedgerRowsForBooking(bookingId);
  }
  static createPendingLedgerRows(args) {
    return ReferralPayout.createPendingLedgerRows(args);
  }
  static createPendingRows(args) {
    return ReferralPayout.createPendingRows(args);
  }
  static normalizePendingToSafetyCap(bookingId, pendingRows, safetyCapThb) {
    return ReferralPayout.normalizePendingToSafetyCap(bookingId, pendingRows, safetyCapThb);
  }
  static cancelPendingLedgerForBooking(bookingId) {
    return ReferralPayout.cancelPendingLedgerForBooking(bookingId);
  }
  static markPendingAsEarned(bookingId) {
    return ReferralPayout.markPendingAsEarned(bookingId);
  }
  static distribute(bookingId, options) {
    return ReferralPayout.distribute(bookingId, options);
  }
  static distributeHostPartnerActivation(bookingId) {
    return ReferralPayout.distributeHostPartnerActivation(bookingId);
  }
  static getMonitorStats() {
    return ReferralStats.getMonitorStats();
  }
  static getAnalyticsStats() {
    return ReferralStats.getAnalyticsStats();
  }
}

export default ReferralPnlService;
`,
)

console.log('referral modules:', {
  calculation: lineCount('lib/services/marketing/referral-calculation.js'),
  stats: lineCount('lib/services/marketing/referral-stats.service.js'),
  payout: lineCount('lib/services/marketing/referral-payout.service.js'),
  facade: lineCount('lib/services/marketing/referral-pnl.service.js'),
})

console.log('Run npm run build to verify.')
