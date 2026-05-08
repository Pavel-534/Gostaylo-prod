import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { recordCriticalSignal } from '@/lib/critical-telemetry.js';
import WalletService from '@/lib/services/finance/wallet.service';
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js';
import { ReferralTierSyncService } from '@/lib/services/marketing/referral-tier-sync.service.js';
import { ReferralLedgerService } from '@/lib/services/marketing/referral-ledger.service.js';
import { ReferralPromoTankService } from '@/lib/services/marketing/referral-promo-tank.service.js';
import {
  recordReferralTeamFeedAfterGuestBooking,
  recordReferralTeamFeedAfterHostActivation,
} from '@/lib/referral/referral-feed-recorder';

const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
});

const REFERRAL_STATUSES = Object.freeze({
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

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonArray(value) {
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

export class ReferralPnlService {
  static normalizeTierRow(row) {
    return ReferralTierSyncService.normalizeTierRow(row);
  }

  static async getReferralTiers() {
    return ReferralTierSyncService.getReferralTiers();
  }

  static tierRankIndex(tiers, tierId) {
    return ReferralTierSyncService.tierRankIndex(tiers, tierId);
  }

  static cohortMonthAnchorUtc(cohortMonthKey) {
    const key = String(cohortMonthKey || '').trim();
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
    return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  }

  static addMonthsUtc(date, months) {
    const d = new Date(date.getTime());
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
  }

  /**
   * Referral cohort ROI: group referees by signup month (referred_at → profile.created_at),
   * cumulative guest commission from their completed bookings by M0/M1/M3/M6 windows,
   * vs bonus cost (earned ledger tied to those referees).
   *
   * Cohort month key uses **UTC** calendar (getUTCFullYear/getUTCMonth) — SSOT для глобальной
   * админ-аналитики; не смешивать с `resolveReferralStatsTimeZone` (кабинет пользователя).
   */
  static buildCohortRoiSeries({
    relations,
    refereeProfilesById,
    bookingsByRenter,
    ledgerRowsByReferee,
  }) {
    const milestones = [
      { key: 'M0', months: 1 },
      { key: 'M1', months: 2 },
      { key: 'M3', months: 4 },
      { key: 'M6', months: 7 },
    ];

    const cohortMap = new Map();

    for (const rel of relations || []) {
      const rid = String(rel?.referee_id || '').trim();
      if (!rid) continue;
      const refIso = rel?.referred_at || null;
      const prof = refereeProfilesById.get(rid);
      const createdIso = prof?.created_at || null;
      const anchorIso = refIso || createdIso;
      if (!anchorIso) continue;
      const d = new Date(anchorIso);
      if (Number.isNaN(d.getTime())) continue;
      const cohortMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!cohortMap.has(cohortMonth)) {
        cohortMap.set(cohortMonth, { cohortMonth, refereeIds: new Set(), bonusCostThb: 0 });
      }
      cohortMap.get(cohortMonth).refereeIds.add(rid);
    }

    const now = new Date();
    const horizonStart = this.addMonthsUtc(now, -36);
    const cohortEntries = [...cohortMap.values()].filter((c) => {
      const a = this.cohortMonthAnchorUtc(c.cohortMonth);
      return a && a >= horizonStart;
    });

    for (const c of cohortEntries) {
      let bonus = 0;
      for (const rid of c.refereeIds) {
        bonus += ledgerRowsByReferee.get(rid) || 0;
      }
      c.bonusCostThb = round2(bonus);
    }

    for (const c of cohortEntries) {
      const anchor = this.cohortMonthAnchorUtc(c.cohortMonth);
      if (!anchor) continue;
      const cumulativeCommissionThb = {};
      for (const { key, months } of milestones) {
        const end = this.addMonthsUtc(anchor, months);
        let sum = 0;
        for (const rid of c.refereeIds) {
          const rows = bookingsByRenter.get(rid) || [];
          for (const b of rows) {
            if (String(b?.status || '').toUpperCase() !== 'COMPLETED') continue;
            const completedRaw = b?.completed_at || b?.updated_at || null;
            if (!completedRaw) continue;
            const ct = new Date(completedRaw);
            if (Number.isNaN(ct.getTime()) || ct < anchor || ct >= end) continue;
            sum += Number(b?.commission_thb) || 0;
          }
        }
        cumulativeCommissionThb[key] = round2(sum);
      }
      c.refereeCount = c.refereeIds.size;
      c.cumulativeCommissionThb = cumulativeCommissionThb;
      delete c.refereeIds;
    }

    cohortEntries.sort((a, b) => String(b.cohortMonth).localeCompare(String(a.cohortMonth)));
    return {
      milestones: milestones.map((m) => m.key),
      cohorts: cohortEntries,
    };
  }

  static chunkArray(arr, size) {
    const chunks = [];
    const a = Array.isArray(arr) ? arr : [];
    const n = Math.max(1, Number(size) || 100);
    for (let i = 0; i < a.length; i += n) chunks.push(a.slice(i, i + n));
    return chunks;
  }

  static resolveTierForPartnerCount(tiers, partnersInvitedCount) {
    return ReferralTierSyncService.resolveTierForPartnerCount(tiers, partnersInvitedCount);
  }

  static async countDirectPartnersInvited(referrerId) {
    return ReferralTierSyncService.countDirectPartnersInvited(referrerId);
  }

  static async syncAmbassadorTierForUser(userId, context = {}) {
    return ReferralTierSyncService.syncAmbassadorTierForUser(userId, context);
  }

  static async getReferralSettings() {
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
    const rawMlmLevel1Percent = Number(
      general?.mlm_level1_percent ?? general?.mlmLevel1Percent,
    );
    const rawMlmLevel2Percent = Number(
      general?.mlm_level2_percent ?? general?.mlmLevel2Percent,
    );
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
      referralSplitRatio: clamp(
        Number.isFinite(rawSplit) ? rawSplit : DEFAULT_REFERRAL_SPLIT_RATIO,
        0,
        1,
      ),
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
        clamp(
          Number.isFinite(rawPromoPot) ? rawPromoPot : DEFAULT_MARKETING_PROMO_POT,
          0,
          1_000_000_000,
        ),
      ),
      promoBoostPerBooking: round2(
        clamp(
          Number.isFinite(rawBoost) ? rawBoost : DEFAULT_PROMO_BOOST_PER_BOOKING,
          0,
          1_000_000_000,
        ),
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

  static computePlatformMarginBudget({
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

  static async adjustMarketingPromoPot(deltaThb, entryType, options = {}) {
    return ReferralPromoTankService.adjustMarketingPromoPot(deltaThb, entryType, options);
  }

  static async applyOrganicTopup({ booking, netBase, policy, trigger }) {
    return ReferralPromoTankService.applyOrganicTopup({ booking, netBase, policy, trigger });
  }

  static async applyPromoBoost({ booking, policy, baseReferralPoolThb }) {
    return ReferralPromoTankService.applyPromoBoost({ booking, policy, baseReferralPoolThb });
  }

  static computeBoostSplit(boostThb, rule) {
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

  static async creditWalletFromEarnedRows(bookingId) {
    return ReferralLedgerService.creditWalletFromEarnedRows(bookingId);
  }

  static deriveFeeBaseFromBooking(booking) {
    return ReferralPolicyService.deriveFeeBaseFromBooking(booking);
  }

  static deriveNetProfitAfterVariableCosts(feeBase, policy) {
    return ReferralPolicyService.deriveNetProfitAfterVariableCosts(feeBase, policy);
  }

  static deriveSafetyCaps(netBase, policy) {
    return ReferralPolicyService.deriveSafetyCaps(netBase, policy);
  }

  static async getBookingForDistribution(bookingId) {
    const id = String(bookingId || '').trim();
    if (!id) return { error: 'BOOKING_ID_REQUIRED', status: 400 };
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id,status,renter_id,price_thb,commission_thb,commission_rate,applied_commission_rate,pricing_snapshot',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) return { error: error.message || 'BOOKING_READ_FAILED', status: 500 };
    if (!data) return { error: 'BOOKING_NOT_FOUND', status: 404 };
    return { data };
  }

  static async getReferralRelationByReferee(refereeId) {
    const rid = String(refereeId || '').trim();
    if (!rid) return null;
    const { data } = await supabaseAdmin
      .from('referral_relations')
      .select('id, referrer_id, referee_id, referral_code_id, network_depth, ancestor_path')
      .eq('referee_id', rid)
      .maybeSingle();
    return data || null;
  }

  static async getLedgerRowsForBooking(bookingId) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, amount_thb, type, status, referral_type, ledger_depth')
      .eq('booking_id', String(bookingId));
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_READ_FAILED');
    return data || [];
  }

  static async createPendingLedgerRows({
    booking,
    relation,
    referralPoolThb,
    referrerAmountThb,
    refereeAmountThb,
    netProfitOrderThb,
    platformGrossRevenueThb,
    promoBoostThb = 0,
    policy,
    trigger,
  }) {
    return ReferralLedgerService.createPendingLedgerRows({
      booking,
      relation,
      referralPoolThb,
      referrerAmountThb,
      refereeAmountThb,
      netProfitOrderThb,
      platformGrossRevenueThb,
      promoBoostThb,
      policy,
      trigger,
      referralType: REFERRAL_LEDGER_REFERRAL_TYPE.GUEST_BOOKING,
    });
  }

  static async createPendingRows(args) {
    return this.createPendingLedgerRows(args);
  }

  static async normalizePendingToSafetyCap(bookingId, pendingRows, safetyCapThb) {
    const cap = round2(Math.max(0, safetyCapThb));
    const current = round2(
      pendingRows.reduce((acc, row) => acc + (Number(row?.amount_thb) || 0), 0),
    );
    if (current <= cap || current <= 0) return { adjusted: false, adjustedPoolThb: current };
    const ratio = cap / current;
    const normalized = pendingRows.map((row) => ({
      ...row,
      amount_thb: round2((Number(row.amount_thb) || 0) * ratio),
    }));
    const subtotal = round2(normalized.reduce((acc, row) => acc + row.amount_thb, 0));
    const drift = round2(cap - subtotal);
    if (Math.abs(drift) > 0 && normalized.length > 0) {
      normalized[0].amount_thb = round2(normalized[0].amount_thb + drift);
    }
    for (const row of normalized) {
      const { error } = await supabaseAdmin
        .from('referral_ledger')
        .update({
          amount_thb: row.amount_thb,
          referral_pool_thb: cap,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('booking_id', String(bookingId))
        .eq('status', REFERRAL_STATUSES.PENDING);
      if (error) throw new Error(error.message || 'REFERRAL_LEDGER_SAFETY_UPDATE_FAILED');
    }
    return { adjusted: true, adjustedPoolThb: cap };
  }

  /**
   * Booking cancelled: void referral ledger rows still in `pending` (defensive; normally PENDING is short-lived).
   */
  static async cancelPendingLedgerForBooking(bookingId) {
    return ReferralLedgerService.cancelPendingLedgerForBooking(bookingId);
  }

  static async markPendingAsEarned(bookingId) {
    return ReferralLedgerService.markPendingAsEarned(bookingId);
  }

  static async distribute(bookingId, options = {}) {
    const trigger = String(options?.trigger || 'booking_completed');
    const bookingRes = await this.getBookingForDistribution(bookingId);
    if (bookingRes.error) return { success: false, error: bookingRes.error, status: bookingRes.status };
    const booking = bookingRes.data;
    if (String(booking.status || '').toUpperCase() !== 'COMPLETED') {
      return { success: true, skipped: true, reason: 'BOOKING_NOT_COMPLETED' };
    }
    const feeBase = this.deriveFeeBaseFromBooking(booking);
    if (feeBase.platformGrossRevenueThb <= 0) {
      return { success: true, skipped: true, reason: 'ZERO_PLATFORM_GROSS' };
    }

    const policy = await this.getReferralSettings();
    const netBase = this.deriveNetProfitAfterVariableCosts(feeBase, policy);
    const relation = await this.getReferralRelationByReferee(booking.renter_id);
    if (!relation) {
      const organicTopup = await this.applyOrganicTopup({
        booking,
        netBase,
        policy,
        trigger,
      });
      return {
        success: true,
        skipped: true,
        reason: 'NO_REFERRAL_RELATION',
        data: {
          bookingId: booking.id,
          platformGrossRevenueThb: netBase.platformGrossRevenueThb,
          netProfitOrderThb: netBase.netProfitOrderThb,
          organicToPromoPotPercent: policy.organicToPromoPotPercent,
          organicTopupAmountThb: organicTopup.amountThb || 0,
          organicTopupApplied: organicTopup.applied === true,
          promoPotBalanceThb: organicTopup.newBalanceThb ?? policy.marketingPromoPot,
        },
      };
    }
    const referrerId = String(relation?.referrer_id || '').trim();
    const renterId = String(booking?.renter_id || '').trim();
    if (referrerId && renterId && referrerId === renterId) {
      recordCriticalSignal('POTENTIAL_SELF_REFERRAL', {
        threshold: 1,
        windowMs: 1,
        tag: '[REFERRAL_GUARD]',
        detailLines: [
          'hard-stop in ReferralPnlService.distribute',
          `bookingId: ${String(booking.id || '')}`,
          `referrerId: ${referrerId}`,
          `renterId: ${renterId}`,
          `trigger: ${trigger}`,
        ],
      });
      return {
        success: true,
        skipped: true,
        reason: 'SELF_REFERRAL_BLOCKED',
        data: {
          bookingId: booking.id,
          referrerId,
          renterId,
        },
      };
    }
    const { safetyCapThb, referralPoolThb } = this.deriveSafetyCaps(netBase, policy);
    const existing = await this.getLedgerRowsForBooking(booking.id);
    const alreadyEarned = existing.some((row) => row.status === REFERRAL_STATUSES.EARNED);
    if (alreadyEarned) {
      return { success: true, skipped: true, reason: 'ALREADY_EARNED' };
    }

    const boost = await this.applyPromoBoost({
      booking,
      policy,
      baseReferralPoolThb: referralPoolThb,
    });
    const baseReferrerAmountThb = round2(referralPoolThb * policy.referralSplitRatio);
    const baseRefereeAmountThb = round2(referralPoolThb - baseReferrerAmountThb);
    const boostSplit = this.computeBoostSplit(
      boost.boostAppliedThb,
      policy.referralBoostAllocationRule,
    );
    const referrerAmountThb = round2(baseReferrerAmountThb + boostSplit.referrerBoostThb);
    const refereeAmountThb = round2(baseRefereeAmountThb + boostSplit.refereeBoostThb);
    const finalReferralPoolThb = round2(referrerAmountThb + refereeAmountThb);

    const pendingRows = existing.filter((row) => row.status === REFERRAL_STATUSES.PENDING);
    if (pendingRows.length === 0) {
      await this.createPendingLedgerRows({
        booking,
        relation,
        referralPoolThb: finalReferralPoolThb,
        promoBoostThb: boost.boostAppliedThb,
        referrerAmountThb,
        refereeAmountThb,
        netProfitOrderThb: netBase.netProfitOrderThb,
        platformGrossRevenueThb: netBase.platformGrossRevenueThb,
        policy,
        trigger,
      });
    } else {
      await this.normalizePendingToSafetyCap(booking.id, pendingRows, safetyCapThb);
    }

    await this.markPendingAsEarned(booking.id);
    await this.creditWalletFromEarnedRows(booking.id);
    let tierSync = null;
    try {
      tierSync = await this.syncAmbassadorTierForUser(String(relation.referrer_id), {
        trigger,
        bookingId: String(booking.id),
        refereeId: String(relation.referee_id || ''),
      });
    } catch (tierErr) {
      console.warn('[REFERRAL] tier sync warning:', tierErr?.message || tierErr);
    }
    try {
      await recordReferralTeamFeedAfterGuestBooking(String(booking.id));
    } catch (feedErr) {
      console.warn('[REFERRAL] team feed (guest booking):', feedErr?.message || feedErr);
    }
    return {
      success: true,
      data: {
        bookingId: booking.id,
        referrerId: relation.referrer_id,
        refereeId: relation.referee_id,
        platformGrossRevenueThb: netBase.platformGrossRevenueThb,
        netProfitOrderThb: netBase.netProfitOrderThb,
        insuranceReserveThb: netBase.insuranceReserveThb,
        acquiringFeeThb: netBase.acquiringFeeThb,
        operationalReserveThb: netBase.operationalReserveThb,
        referralPoolThb: finalReferralPoolThb,
        baseReferralPoolThb: referralPoolThb,
        promoBoostThb: boost.boostAppliedThb,
        safetyCapThb,
        referralReinvestmentPercent: policy.referralReinvestmentPercent,
        referralSplitRatio: policy.referralSplitRatio,
        acquiringFeePercent: policy.acquiringFeePercent,
        operationalReservePercent: policy.operationalReservePercent,
        marketingPromoPotBalanceThb: boost.newBalanceThb,
        promoTurboModeEnabled: policy.promoTurboModeEnabled,
        promoBoostPerBooking: policy.promoBoostPerBooking,
        referralBoostAllocationRule: policy.referralBoostAllocationRule,
        boostReferrerShareThb: boostSplit.referrerBoostThb,
        boostRefereeShareThb: boostSplit.refereeBoostThb,
        tierSync,
      },
    };
  }

  /**
   * Stage 72.3 (supply side) — host activation bonus:
   * debit fixed amount from marketing promo pot and distribute to uplines (L1/L2)
   * after the first COMPLETED booking of invited partner as listing owner.
   * @param {string} bookingId
   * @returns {Promise<{ success: boolean, skipped?: boolean, reason?: string, data?: object }>}
   */
  static async distributeHostPartnerActivation(bookingId) {
    const id = String(bookingId || '').trim();
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' };
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id,status,listing_id,metadata')
      .eq('id', id)
      .maybeSingle();
    if (bookingErr) return { success: false, error: bookingErr.message || 'BOOKING_READ_FAILED' };
    if (!booking) return { success: false, error: 'BOOKING_NOT_FOUND' };
    if (String(booking.status || '').toUpperCase() !== 'COMPLETED') {
      return { success: true, skipped: true, reason: 'BOOKING_NOT_COMPLETED' };
    }

    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .select('id,owner_id')
      .eq('id', String(booking.listing_id || ''))
      .maybeSingle();
    if (listingErr) return { success: false, error: listingErr.message || 'LISTING_READ_FAILED' };
    if (!listing?.owner_id) {
      return { success: true, skipped: true, reason: 'LISTING_OWNER_NOT_FOUND' };
    }

    const relation = await this.getReferralRelationByReferee(String(listing.owner_id));
    if (!relation?.referrer_id) {
      return { success: true, skipped: true, reason: 'HOST_HAS_NO_REFERRAL_RELATION' };
    }

    const { data: ownerListings, error: ownerListingsErr } = await supabaseAdmin
      .from('listings')
      .select('id')
      .eq('owner_id', String(listing.owner_id));
    if (ownerListingsErr) {
      return { success: false, error: ownerListingsErr.message || 'OWNER_LISTINGS_READ_FAILED' };
    }
    const ownerListingIds = (ownerListings || []).map((r) => String(r.id || '')).filter(Boolean);
    if (!ownerListingIds.length) {
      return { success: true, skipped: true, reason: 'OWNER_LISTINGS_NOT_FOUND' };
    }
    const { count: completedCount, error: completedErr } = await supabaseAdmin
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', ownerListingIds)
      .eq('status', 'COMPLETED');
    if (completedErr) {
      return { success: false, error: completedErr.message || 'HOST_COMPLETED_COUNT_FAILED' };
    }
    if ((Number(completedCount) || 0) !== 1) {
      return { success: true, skipped: true, reason: 'NOT_FIRST_HOST_COMPLETED_BOOKING' };
    }

    const { data: existingHostRows, error: existingErr } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,status')
      .eq('booking_id', id)
      .eq('referral_type', REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION);
    if (existingErr) {
      return { success: false, error: existingErr.message || 'HOST_LEDGER_READ_FAILED' };
    }
    if (Array.isArray(existingHostRows) && existingHostRows.length > 0) {
      return { success: true, skipped: true, reason: 'HOST_ACTIVATION_ALREADY_RECORDED' };
    }

    const policy = await this.getReferralSettings();
    const bonusThb = round2(policy.partnerActivationBonusThb);
    if (bonusThb <= 0) {
      return { success: true, skipped: true, reason: 'HOST_ACTIVATION_BONUS_DISABLED' };
    }
    const mlmL1 = clamp(policy.mlmLevel1Percent, 0, 100);
    const mlmL2 = clamp(policy.mlmLevel2Percent, 0, 100);
    const mlmSum = round2(mlmL1 + mlmL2);
    if (mlmSum <= 0) {
      return { success: true, skipped: true, reason: 'MLM_SPLIT_ZERO' };
    }
    if (mlmSum > 100) {
      return { success: false, error: 'MLM_SPLIT_OVER_100' };
    }

    const ancestorIds = safeJsonArray(relation?.ancestor_path)
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const level1ReferrerId = String(relation.referrer_id || '').trim();
    const level2Candidate = ancestorIds.length >= 2 ? ancestorIds[ancestorIds.length - 2] : null;
    const payouts = [];
    if (level1ReferrerId) {
      payouts.push({
        referrerId: level1ReferrerId,
        level: 1,
        configuredPercent: mlmL1,
      });
    }
    if (level2Candidate && level2Candidate !== level1ReferrerId) {
      payouts.push({
        referrerId: level2Candidate,
        level: 2,
        configuredPercent: mlmL2,
      });
    }
    if (!payouts.length) {
      return { success: true, skipped: true, reason: 'NO_MLM_TARGETS' };
    }
    const effectivePercentSum = round2(
      payouts.reduce((acc, p) => acc + Number(p.configuredPercent || 0), 0),
    );
    if (effectivePercentSum <= 0) {
      return { success: true, skipped: true, reason: 'MLM_EFFECTIVE_SPLIT_ZERO' };
    }

    const normalizedRows = payouts.map((p) => ({
      ...p,
      amountThb: round2((bonusThb * p.configuredPercent) / effectivePercentSum),
    }));
    const subtotal = round2(normalizedRows.reduce((acc, p) => acc + p.amountThb, 0));
    const drift = round2(bonusThb - subtotal);
    if (Math.abs(drift) > 0 && normalizedRows.length > 0) {
      normalizedRows[0].amountThb = round2(normalizedRows[0].amountThb + drift);
    }

    const promoDebitFlow = await ReferralPromoTankService.processHostActivationDebit({
      bookingId: id,
      bookingMetadata: booking?.metadata,
      bonusThb,
      metadata: {
        host_partner_id: String(listing.owner_id),
        referee_id: String(relation.referee_id || listing.owner_id),
        mlm_level1_percent: mlmL1,
        mlm_level2_percent: mlmL2,
        mlm_effective_percent_sum: effectivePercentSum,
      },
    });
    if (promoDebitFlow.skipped) return promoDebitFlow;
    const promoDebit = promoDebitFlow.promoDebit;

    const nowIso = new Date().toISOString();
    const ledgerRows = normalizedRows
      .filter((row) => row.amountThb > 0)
      .map((row) => ({
        id: makeId('rfl'),
        booking_id: id,
        referrer_id: String(row.referrerId),
        referee_id: String(relation.referee_id || listing.owner_id),
        amount_thb: row.amountThb,
        type: REFERRAL_TYPES.REFERRER_BONUS,
        referral_type: REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION,
        ledger_depth: row.level,
        status: REFERRAL_STATUSES.EARNED,
        earned_at: nowIso,
        net_profit_order_thb: 0,
        platform_gross_thb: 0,
        referral_pool_thb: bonusThb,
        metadata: {
          split_role: `upline_l${row.level}`,
          split_percent: row.configuredPercent,
          partner_activation_bonus_thb: bonusThb,
          source: 'host_activation',
        },
      }));
    if (!ledgerRows.length) {
      return { success: true, skipped: true, reason: 'HOST_ACTIVATION_LEDGER_ZERO' };
    }

    const { error: insertErr } = await supabaseAdmin.from('referral_ledger').insert(ledgerRows);
    if (insertErr) return { success: false, error: insertErr.message || 'HOST_LEDGER_INSERT_FAILED' };

    try {
      await recordReferralTeamFeedAfterHostActivation(id, ledgerRows);
    } catch (feedErr) {
      console.warn('[REFERRAL] team feed (host activation):', feedErr?.message || feedErr);
    }

    for (const row of ledgerRows) {
      await WalletService.addFunds(
        row.referrer_id,
        row.amount_thb,
        'referral_bonus',
        `referral_ledger:${String(row.id)}`,
        {
          bookingId: id,
          ledgerId: String(row.id),
          txType: 'referral_bonus',
          referralType: REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION,
        },
      );
    }

    const { data: bookingMetaRow } = await supabaseAdmin.from('bookings').select('metadata').eq('id', id).maybeSingle();
    const clearedMeta =
      bookingMetaRow?.metadata && typeof bookingMetaRow.metadata === 'object'
        ? { ...bookingMetaRow.metadata }
        : {};
    if (clearedMeta.host_activation_promo_tank) {
      delete clearedMeta.host_activation_promo_tank;
      await supabaseAdmin.from('bookings').update({ metadata: clearedMeta }).eq('id', id);
    }

    let tierSync = null;
    try {
      tierSync = await this.syncAmbassadorTierForUser(String(relation.referrer_id), {
        trigger: 'host_activation_completed',
        bookingId: id,
        refereeId: String(relation.referee_id || listing.owner_id),
      });
    } catch (tierErr) {
      console.warn('[REFERRAL] host tier sync warning:', tierErr?.message || tierErr);
    }

    return {
      success: true,
      data: {
        bookingId: id,
        hostPartnerId: String(listing.owner_id),
        activatedRefereeId: String(relation.referee_id || listing.owner_id),
        bonusThb,
        mlmLevel1Percent: mlmL1,
        mlmLevel2Percent: mlmL2,
        recipientsCount: ledgerRows.length,
        promoPotBalanceThb: promoDebit.newBalanceThb,
        tierSync,
      },
    };
  }

  static async getMonitorStats() {
    const [ledgerRes, policy, tankRes, profilesRes, relationsRes] = await Promise.all([
      supabaseAdmin.from('referral_ledger').select('amount_thb,status,type,referral_type'),
      this.getReferralSettings(),
      supabaseAdmin.from('marketing_promo_tank_ledger').select('amount_thb,entry_type,created_at'),
      supabaseAdmin
        .from('profiles')
        .select('id,created_at,referred_by')
        .gte(
          'created_at',
          new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString(),
        ),
      supabaseAdmin
        .from('referral_relations')
        .select('referee_id,referred_at')
        .gte(
          'referred_at',
          new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString(),
        ),
    ]);
    const { data, error } = ledgerRes;
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_STATS_READ_FAILED');
    let earnedTotalThb = 0;
    let pendingTotalThb = 0;
    let canceledTotalThb = 0;
    let earnedBonusThb = 0;
    let earnedCashbackThb = 0;
    let earnedHostActivationThb = 0;
    let hostActivationRowsCount = 0;
    for (const row of data || []) {
      const amount = round2(row?.amount_thb);
      const status = String(row?.status || '').toLowerCase();
      const type = String(row?.type || '').toLowerCase();
      const referralType = String(row?.referral_type || '').toLowerCase();
      if (status === REFERRAL_STATUSES.EARNED) {
        earnedTotalThb += amount;
        if (type === REFERRAL_TYPES.REFERRER_BONUS) earnedBonusThb += amount;
        if (type === REFERRAL_TYPES.REFEREE_CASHBACK) earnedCashbackThb += amount;
        if (referralType === REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION) {
          earnedHostActivationThb += amount;
          hostActivationRowsCount += 1;
        }
      } else if (status === REFERRAL_STATUSES.PENDING) {
        pendingTotalThb += amount;
      } else if (status === REFERRAL_STATUSES.CANCELED) {
        canceledTotalThb += amount;
      }
    }

    let promoTankTopupsThb = 0;
    let promoTankDebitsThb = 0;
    for (const row of tankRes.data || []) {
      const amount = round2(row?.amount_thb);
      if (amount > 0) promoTankTopupsThb += amount;
      if (amount < 0) promoTankDebitsThb += Math.abs(amount);
    }
    const projectedDebitPerHostActivationThb = round2(policy.partnerActivationBonusThb);
    const forecastDebitNext10HostActivationsThb = round2(projectedDebitPerHostActivationThb * 10);

    const monthKeys = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const relationSet = new Set((relationsRes.data || []).map((r) => String(r?.referee_id || '')));
    const growthMap = new Map(monthKeys.map((key) => [key, { month: key, organic: 0, referral: 0 }]));
    for (const row of profilesRes.data || []) {
      const createdAt = new Date(row?.created_at || '');
      if (Number.isNaN(createdAt.getTime())) continue;
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!growthMap.has(key)) continue;
      const isReferral =
        relationSet.has(String(row?.id || '')) || String(row?.referred_by || '').trim() !== '';
      if (isReferral) growthMap.get(key).referral += 1;
      else growthMap.get(key).organic += 1;
    }

    return {
      currency: 'THB',
      earnedTotalThb: round2(earnedTotalThb),
      pendingTotalThb: round2(pendingTotalThb),
      canceledTotalThb: round2(canceledTotalThb),
      earnedBonusThb: round2(earnedBonusThb),
      earnedCashbackThb: round2(earnedCashbackThb),
      earnedHostActivationThb: round2(earnedHostActivationThb),
      hostActivationRowsCount,
      rowsCount: Array.isArray(data) ? data.length : 0,
      marketingPromoPotThb: round2(policy.marketingPromoPot),
      promoTankTopupsThb: round2(promoTankTopupsThb),
      promoTankDebitsThb: round2(promoTankDebitsThb),
      payoutsTotalThb: round2(earnedTotalThb),
      currentPromoTankBalanceThb: round2(policy.marketingPromoPot),
      projectedDebitPerHostActivationThb,
      forecastDebitNext10HostActivationsThb,
      promoTurboModeEnabled: policy.promoTurboModeEnabled === true,
      promoBoostPerBooking: round2(policy.promoBoostPerBooking),
      organicToPromoPotPercent: round2(policy.organicToPromoPotPercent),
      partnerActivationBonusThb: round2(policy.partnerActivationBonusThb),
      mlmLevel1Percent: round2(policy.mlmLevel1Percent),
      mlmLevel2Percent: round2(policy.mlmLevel2Percent),
      growthSeries: Array.from(growthMap.values()),
    };
  }

  static async getAnalyticsStats() {
    const [tiers, relationsRes, ledgerRes, profilesRes] = await Promise.all([
      this.getReferralTiers(),
      supabaseAdmin.from('referral_relations').select('referrer_id,referee_id,referred_at'),
      supabaseAdmin
        .from('referral_ledger')
        .select('amount_thb,status,referral_type,referee_id,booking_id'),
      supabaseAdmin
        .from('profiles')
        .select('id,referral_tier_id,referral_tier_name,referral_tier_payout_ratio'),
    ]);
    if (relationsRes.error) throw new Error(relationsRes.error.message || 'RELATIONS_READ_FAILED');
    if (ledgerRes.error) throw new Error(ledgerRes.error.message || 'LEDGER_READ_FAILED');
    if (profilesRes.error) throw new Error(profilesRes.error.message || 'PROFILES_READ_FAILED');

    const relations = relationsRes.data || [];
    const ledger = ledgerRes.data || [];
    const profiles = profilesRes.data || [];
    const referredUserSet = new Set(relations.map((row) => String(row?.referee_id || '')).filter(Boolean));
    const refereeIdsList = [...referredUserSet];

    const bookings = [];
    for (const chunk of this.chunkArray(refereeIdsList, 80)) {
      if (chunk.length === 0) break;
      const { data: bchunk, error: berr } = await supabaseAdmin
        .from('bookings')
        .select('id,renter_id,status,commission_thb,created_at,completed_at,updated_at')
        .eq('status', 'COMPLETED')
        .in('renter_id', chunk);
      if (berr) throw new Error(berr.message || 'BOOKINGS_READ_FAILED');
      for (const row of bchunk || []) bookings.push(row);
    }

    const refereeProfilesById = new Map();
    for (const chunk of this.chunkArray(refereeIdsList, 80)) {
      if (chunk.length === 0) break;
      const { data: pch, error: perr } = await supabaseAdmin
        .from('profiles')
        .select('id,created_at')
        .in('id', chunk);
      if (perr) throw new Error(perr.message || 'REFEREE_PROFILES_READ_FAILED');
      for (const row of pch || []) refereeProfilesById.set(String(row.id), row);
    }

    const ledgerRowsByReferee = new Map();
    for (const row of ledger) {
      if (String(row?.status || '').toLowerCase() !== REFERRAL_STATUSES.EARNED) continue;
      const rid = String(row?.referee_id || '').trim();
      if (!rid) continue;
      const amt = round2(row?.amount_thb);
      ledgerRowsByReferee.set(rid, round2((ledgerRowsByReferee.get(rid) || 0) + amt));
    }

    const bookingsByRenter = new Map();
    for (const row of bookings) {
      const rid = String(row?.renter_id || '').trim();
      if (!rid) continue;
      if (!bookingsByRenter.has(rid)) bookingsByRenter.set(rid, []);
      bookingsByRenter.get(rid).push(row);
    }

    const cohortRoi = this.buildCohortRoiSeries({
      relations,
      refereeProfilesById,
      bookingsByRenter,
      ledgerRowsByReferee,
    });

    const completedReferralBookings = bookings.filter((row) =>
      referredUserSet.has(String(row?.renter_id || '')),
    );
    const ltvFromCommissionThb = round2(
      completedReferralBookings.reduce((acc, row) => acc + (Number(row?.commission_thb) || 0), 0),
    );
    const acquisitionCostThb = round2(
      ledger.reduce((acc, row) => {
        const earned = String(row?.status || '').toLowerCase() === REFERRAL_STATUSES.EARNED;
        if (!earned) return acc;
        return acc + (Number(row?.amount_thb) || 0);
      }, 0),
    );
    const efficiencyIndex =
      acquisitionCostThb > 0 ? round2(ltvFromCommissionThb / acquisitionCostThb) : null;
    const efficiencyStatus = (() => {
      if (efficiencyIndex == null) return 'NO_COST_BASELINE';
      if (efficiencyIndex < 1) return 'LOW_EFFICIENCY';
      if (efficiencyIndex < 1.3) return 'MEDIUM_EFFICIENCY';
      return 'HEALTHY';
    })();

    const invitations = relations.length;
    const registrations = referredUserSet.size;
    const firstBookingsSet = new Set(
      completedReferralBookings.map((row) => String(row?.renter_id || '')).filter(Boolean),
    );
    const partnerActivationsSet = new Set(
      ledger
        .filter(
          (row) =>
            String(row?.status || '').toLowerCase() === REFERRAL_STATUSES.EARNED &&
            String(row?.referral_type || '').toLowerCase() === REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION,
        )
        .map((row) => String(row?.referee_id || ''))
        .filter(Boolean),
    );

    const profileMap = new Map(profiles.map((p) => [String(p?.id || ''), p]));
    const byTierMap = new Map();
    for (const rel of relations) {
      const referrerId = String(rel?.referrer_id || '');
      if (!referrerId) continue;
      const profile = profileMap.get(referrerId);
      const tierName = String(
        profile?.referral_tier_name ||
          profile?.referral_tier_id ||
          'Beginner',
      );
      const item =
        byTierMap.get(tierName) ||
        {
          tierName,
          referrers: new Set(),
          invitations: 0,
          registrations: 0,
        };
      item.referrers.add(referrerId);
      item.invitations += 1;
      item.registrations += 1;
      byTierMap.set(tierName, item);
    }
    const byTier = Array.from(byTierMap.values()).map((item) => ({
      tierName: item.tierName,
      referrersCount: item.referrers.size,
      invitations: item.invitations,
      registrations: item.registrations,
    }));

    return {
      currency: 'THB',
      roi: {
        ltvFromCommissionThb,
        acquisitionCostThb,
        efficiencyIndex,
        efficiencyStatus,
      },
      conversionFunnel: {
        invitations,
        registrations,
        firstBookings: firstBookingsSet.size,
        partnerActivations: partnerActivationsSet.size,
      },
      cohortRoi,
      tiers,
      byTier,
      realtimeUpdatedAt: new Date().toISOString(),
    };
  }
}

export default ReferralPnlService;
