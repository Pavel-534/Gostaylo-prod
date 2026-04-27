import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { readFeeSplitFromSnapshot } from '@/lib/services/booking/pricing.service';
import WalletService from '@/lib/services/finance/wallet.service';

const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
});

const REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  EARNED: 'earned',
  CANCELED: 'canceled',
});

const DEFAULT_REFERRAL_REINVESTMENT_PERCENT = 70;
const DEFAULT_REFERRAL_SPLIT_RATIO = 0.5;
const DEFAULT_ACQUIRING_FEE_PERCENT = 0;
const DEFAULT_OPERATIONAL_RESERVE_PERCENT = 0;
const DEFAULT_MARKETING_PROMO_POT = 0;
const DEFAULT_PROMO_BOOST_PER_BOOKING = 0;
const DEFAULT_ORGANIC_TO_PROMO_POT_PERCENT = 0;
const DEFAULT_REFERRAL_BOOST_ALLOCATION_RULE = 'split_50_50';
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

export class ReferralPnlService {
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
    };
  }

  static async adjustMarketingPromoPot(deltaThb, entryType, options = {}) {
    const delta = round2(deltaThb);
    if (!delta) return { applied: false, reason: 'ZERO_DELTA', newBalanceThb: null };
    const bookingId = options?.bookingId ? String(options.bookingId) : null;
    const metadata = options?.metadata && typeof options.metadata === 'object' ? options.metadata : {};

    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('adjust_marketing_promo_pot', {
      p_delta_thb: delta,
      p_entry_type: String(entryType || ''),
      p_booking_id: bookingId,
      p_metadata: metadata,
    });

    if (rpcError) {
      const msg = String(rpcError?.message || '');
      if (/adjust_marketing_promo_pot|function/i.test(msg)) {
        return { applied: false, reason: 'MISSING_DB_FUNCTION', newBalanceThb: null };
      }
      throw new Error(rpcError.message || 'PROMO_POT_ADJUST_FAILED');
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return {
      applied: row?.applied === true,
      reason: String(row?.reason || ''),
      newBalanceThb: Number.isFinite(Number(row?.new_balance_thb)) ? round2(row.new_balance_thb) : null,
    };
  }

  static async applyOrganicTopup({ booking, netBase, policy, trigger }) {
    const percent = clamp(policy?.organicToPromoPotPercent, 0, 100);
    if (percent <= 0) return { applied: false, amountThb: 0, reason: 'ORGANIC_TOPUP_DISABLED' };
    const amountThb = round2(netBase.netProfitOrderThb * (percent / 100));
    if (amountThb <= 0) return { applied: false, amountThb: 0, reason: 'ORGANIC_TOPUP_ZERO' };

    const adjust = await this.adjustMarketingPromoPot(amountThb, 'organic_topup', {
      bookingId: booking.id,
      metadata: {
        trigger,
        net_profit_order_thb: netBase.netProfitOrderThb,
        organic_to_promo_pot_percent: percent,
      },
    });
    return { ...adjust, amountThb };
  }

  static async applyPromoBoost({ booking, policy, baseReferralPoolThb }) {
    if (policy?.promoTurboModeEnabled !== true) {
      return { boostAppliedThb: 0, reason: 'TURBO_DISABLED', newBalanceThb: policy?.marketingPromoPot ?? 0 };
    }
    const requestedBoostThb = round2(policy?.promoBoostPerBooking);
    if (requestedBoostThb <= 0) {
      return { boostAppliedThb: 0, reason: 'BOOST_ZERO', newBalanceThb: policy?.marketingPromoPot ?? 0 };
    }
    const available = round2(policy?.marketingPromoPot);
    if (available <= 0) {
      return { boostAppliedThb: 0, reason: 'POT_EMPTY', newBalanceThb: 0 };
    }
    const boostAppliedThb = round2(Math.min(requestedBoostThb, available));
    if (boostAppliedThb <= 0) {
      return { boostAppliedThb: 0, reason: 'BOOST_ZERO', newBalanceThb: available };
    }

    const adjust = await this.adjustMarketingPromoPot(-boostAppliedThb, 'referral_boost_debit', {
      bookingId: booking.id,
      metadata: {
        base_referral_pool_thb: baseReferralPoolThb,
        requested_boost_thb: requestedBoostThb,
      },
    });
    if (!adjust.applied) {
      return {
        boostAppliedThb: 0,
        reason: adjust.reason || 'BOOST_DEBIT_NOT_APPLIED',
        newBalanceThb: adjust.newBalanceThb ?? available,
      };
    }
    return {
      boostAppliedThb,
      reason: 'APPLIED',
      newBalanceThb: adjust.newBalanceThb ?? round2(available - boostAppliedThb),
    };
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
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,referrer_id,referee_id,amount_thb,type,status')
      .eq('booking_id', String(bookingId))
      .eq('status', REFERRAL_STATUSES.EARNED);
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_READ_FAILED');

    for (const row of data || []) {
      const amount = round2(row?.amount_thb);
      if (amount <= 0) continue;
      const txType = String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
        ? 'referral_bonus'
        : 'referral_cashback';
      const beneficiaryId =
        txType === 'referral_bonus' ? String(row?.referrer_id || '') : String(row?.referee_id || '');
      if (!beneficiaryId) continue;
      await WalletService.addFunds(
        beneficiaryId,
        amount,
        txType,
        `referral_ledger:${String(row.id)}`,
        { bookingId: String(bookingId), ledgerId: String(row.id), txType },
      );
    }
  }

  static deriveFeeBaseFromBooking(booking) {
    const snapshot =
      booking?.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
        ? booking.pricing_snapshot
        : {};
    const fs = readFeeSplitFromSnapshot(snapshot);
    const subtotalThb = round2(booking?.price_thb);
    const guestServiceFeeThb = Number.isFinite(fs?.guestServiceFeeThb)
      ? round2(fs.guestServiceFeeThb)
      : round2(booking?.commission_thb);
    const hostCommissionThb = Number.isFinite(fs?.hostCommissionThb)
      ? round2(fs.hostCommissionThb)
      : round2(
          subtotalThb * (Number(booking?.applied_commission_rate ?? booking?.commission_rate ?? 0) / 100),
        );
    const platformGrossRevenueThb = Math.max(0, round2(guestServiceFeeThb + hostCommissionThb));
    const insuranceReserveThb = Number.isFinite(Number(snapshot?.fee_split_v2?.insurance_reserve_thb))
      ? round2(snapshot.fee_split_v2.insurance_reserve_thb)
      : Number.isFinite(Number(snapshot?.settlement_v3?.insurance_reserve_amount?.thb))
        ? round2(snapshot.settlement_v3.insurance_reserve_amount.thb)
        : 0;
    const netProfit = PricingService.calculateNetProfitOrder({
      platformGrossRevenueThb,
      insuranceReserveThb,
    });
    return {
      guestServiceFeeThb,
      hostCommissionThb,
      ...netProfit,
    };
  }

  static deriveNetProfitAfterVariableCosts(feeBase, policy) {
    const platformGrossRevenueThb = round2(feeBase?.platformGrossRevenueThb);
    const insuranceReserveThb = round2(feeBase?.insuranceReserveThb);
    const acquiringFeePercent = clamp(
      policy?.acquiringFeePercent,
      0,
      100,
    );
    const operationalReservePercent = clamp(
      policy?.operationalReservePercent,
      0,
      100,
    );
    const acquiringFeeThb = round2(platformGrossRevenueThb * (acquiringFeePercent / 100));
    const operationalReserveThb = round2(
      platformGrossRevenueThb * (operationalReservePercent / 100),
    );
    const netProfitOrderThb = round2(
      Math.max(0, platformGrossRevenueThb - insuranceReserveThb - acquiringFeeThb - operationalReserveThb),
    );
    return {
      platformGrossRevenueThb,
      insuranceReserveThb,
      acquiringFeePercent,
      operationalReservePercent,
      acquiringFeeThb,
      operationalReserveThb,
      netProfitOrderThb,
    };
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
      .select('id, referrer_id, referee_id, referral_code_id')
      .eq('referee_id', rid)
      .maybeSingle();
    return data || null;
  }

  static async getLedgerRowsForBooking(bookingId) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, amount_thb, type, status')
      .eq('booking_id', String(bookingId));
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_READ_FAILED');
    return data || [];
  }

  static async createPendingRows({
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
    const rows = [
      {
        id: makeId('rfl'),
        booking_id: String(booking.id),
        referrer_id: String(relation.referrer_id),
        referee_id: String(relation.referee_id),
        amount_thb: referrerAmountThb,
        type: REFERRAL_TYPES.REFERRER_BONUS,
        status: REFERRAL_STATUSES.PENDING,
        net_profit_order_thb: netProfitOrderThb,
        platform_gross_thb: platformGrossRevenueThb,
        referral_pool_thb: referralPoolThb,
        metadata: {
          split_role: 'referrer',
          policy,
          promo_boost_thb: round2(promoBoostThb),
          trigger,
        },
      },
      {
        id: makeId('rfl'),
        booking_id: String(booking.id),
        referrer_id: String(relation.referrer_id),
        referee_id: String(relation.referee_id),
        amount_thb: refereeAmountThb,
        type: REFERRAL_TYPES.REFEREE_CASHBACK,
        status: REFERRAL_STATUSES.PENDING,
        net_profit_order_thb: netProfitOrderThb,
        platform_gross_thb: platformGrossRevenueThb,
        referral_pool_thb: referralPoolThb,
        metadata: {
          split_role: 'referee',
          policy,
          promo_boost_thb: round2(promoBoostThb),
          trigger,
        },
      },
    ];
    const { error } = await supabaseAdmin.from('referral_ledger').upsert(rows, {
      onConflict: 'booking_id,type',
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_UPSERT_FAILED');
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
    const id = String(bookingId || '').trim();
    if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' };
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.CANCELED,
        updated_at: nowIso,
      })
      .eq('booking_id', id)
      .eq('status', REFERRAL_STATUSES.PENDING)
      .select('id');
    if (error) return { success: false, error: error.message };
    return { success: true, canceledCount: Array.isArray(data) ? data.length : 0 };
  }

  static async markPendingAsEarned(bookingId) {
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: REFERRAL_STATUSES.EARNED,
        earned_at: nowIso,
        updated_at: nowIso,
      })
      .eq('booking_id', String(bookingId))
      .eq('status', REFERRAL_STATUSES.PENDING);
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_EARNED_UPDATE_FAILED');
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
    const referralPoolRaw = round2(
      netBase.netProfitOrderThb * (policy.referralReinvestmentPercent / 100),
    );
    const safetyCapThb = round2(netBase.platformGrossRevenueThb * SAFETY_LOCK_MAX_SHARE);
    const referralPoolThb = round2(Math.min(referralPoolRaw, safetyCapThb));
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
      await this.createPendingRows({
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
      },
    };
  }

  static async getMonitorStats() {
    const [ledgerRes, policy, tankRes, profilesRes, relationsRes] = await Promise.all([
      supabaseAdmin.from('referral_ledger').select('amount_thb,status,type'),
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
    for (const row of data || []) {
      const amount = round2(row?.amount_thb);
      const status = String(row?.status || '').toLowerCase();
      const type = String(row?.type || '').toLowerCase();
      if (status === REFERRAL_STATUSES.EARNED) {
        earnedTotalThb += amount;
        if (type === REFERRAL_TYPES.REFERRER_BONUS) earnedBonusThb += amount;
        if (type === REFERRAL_TYPES.REFEREE_CASHBACK) earnedCashbackThb += amount;
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
      rowsCount: Array.isArray(data) ? data.length : 0,
      marketingPromoPotThb: round2(policy.marketingPromoPot),
      promoTankTopupsThb: round2(promoTankTopupsThb),
      promoTankDebitsThb: round2(promoTankDebitsThb),
      promoTurboModeEnabled: policy.promoTurboModeEnabled === true,
      promoBoostPerBooking: round2(policy.promoBoostPerBooking),
      organicToPromoPotPercent: round2(policy.organicToPromoPotPercent),
      growthSeries: Array.from(growthMap.values()),
    };
  }
}

export default ReferralPnlService;
