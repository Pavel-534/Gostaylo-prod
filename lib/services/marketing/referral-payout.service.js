/**
 * Stage 109.1 — extracted from referral-pnl.service.js (ReferralPayoutService).
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


export async function adjustMarketingPromoPot(deltaThb, entryType, options = {}) {
    return ReferralPromoTankService.adjustMarketingPromoPot(deltaThb, entryType, options);
  }


export async function applyOrganicTopup({ booking, netBase, policy, trigger }) {
    return ReferralPromoTankService.applyOrganicTopup({ booking, netBase, policy, trigger });
  }


export async function applyPromoBoost({ booking, policy, baseReferralPoolThb }) {
    return ReferralPromoTankService.applyPromoBoost({ booking, policy, baseReferralPoolThb });
  }


export async function creditWalletFromEarnedRows(bookingId) {
    return ReferralLedgerService.creditWalletFromEarnedRows(bookingId);
  }


export async function getBookingForDistribution(bookingId) {
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


export async function getReferralRelationByReferee(refereeId) {
    const rid = String(refereeId || '').trim();
    if (!rid) return null;
    const { data } = await supabaseAdmin
      .from('referral_relations')
      .select('id, referrer_id, referee_id, referral_code_id, network_depth, ancestor_path')
      .eq('referee_id', rid)
      .maybeSingle();
    return data || null;
  }


export async function getLedgerRowsForBooking(bookingId) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('id, amount_thb, type, status, referral_type, ledger_depth')
      .eq('booking_id', String(bookingId));
    if (error) throw new Error(error.message || 'REFERRAL_LEDGER_READ_FAILED');
    return data || [];
  }


export async function createPendingLedgerRows({
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


export async function createPendingRows(args) {
    return createPendingLedgerRows(args);
  }


export async function normalizePendingToSafetyCap(bookingId, pendingRows, safetyCapThb) {
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


export async function cancelPendingLedgerForBooking(bookingId) {
    return ReferralLedgerService.cancelPendingLedgerForBooking(bookingId);
  }


export async function markPendingAsEarned(bookingId) {
    return ReferralLedgerService.markPendingAsEarned(bookingId);
  }


export async function distribute(bookingId, options = {}) {
    const trigger = String(options?.trigger || 'booking_completed');
    const bookingRes = await getBookingForDistribution(bookingId);
    if (bookingRes.error) return { success: false, error: bookingRes.error, status: bookingRes.status };
    const booking = bookingRes.data;
    if (String(booking.status || '').toUpperCase() !== 'COMPLETED') {
      return { success: true, skipped: true, reason: 'BOOKING_NOT_COMPLETED' };
    }
    const feeBase = deriveFeeBaseFromBooking(booking);
    if (feeBase.platformGrossRevenueThb <= 0) {
      return { success: true, skipped: true, reason: 'ZERO_PLATFORM_GROSS' };
    }

    const policy = await getReferralSettings();
    const netBase = deriveNetProfitAfterVariableCosts(feeBase, policy);
    const relation = await getReferralRelationByReferee(booking.renter_id);
    if (!relation) {
      const organicTopup = await applyOrganicTopup({
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
    const { safetyCapThb, referralPoolThb } = deriveSafetyCaps(netBase, policy);
    const existing = await getLedgerRowsForBooking(booking.id);
    const alreadyEarned = existing.some((row) => row.status === REFERRAL_STATUSES.EARNED);
    if (alreadyEarned) {
      return { success: true, skipped: true, reason: 'ALREADY_EARNED' };
    }

    const boost = await applyPromoBoost({
      booking,
      policy,
      baseReferralPoolThb: referralPoolThb,
    });
    const baseReferrerAmountThb = round2(referralPoolThb * policy.referralSplitRatio);
    const baseRefereeAmountThb = round2(referralPoolThb - baseReferrerAmountThb);
    const boostSplit = computeBoostSplit(
      boost.boostAppliedThb,
      policy.referralBoostAllocationRule,
    );
    const referrerAmountThb = round2(baseReferrerAmountThb + boostSplit.referrerBoostThb);
    const refereeAmountThb = round2(baseRefereeAmountThb + boostSplit.refereeBoostThb);
    const finalReferralPoolThb = round2(referrerAmountThb + refereeAmountThb);

    const pendingRows = existing.filter((row) => row.status === REFERRAL_STATUSES.PENDING);
    if (pendingRows.length === 0) {
      await createPendingLedgerRows({
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
      await normalizePendingToSafetyCap(booking.id, pendingRows, safetyCapThb);
    }

    await markPendingAsEarned(booking.id);
    await creditWalletFromEarnedRows(booking.id);
    let tierSync = null;
    try {
      tierSync = await ReferralStats.syncAmbassadorTierForUser(String(relation.referrer_id), {
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


export async function distributeHostPartnerActivation(bookingId) {
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

    const relation = await getReferralRelationByReferee(String(listing.owner_id));
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

    const policy = await getReferralSettings();
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
      tierSync = await ReferralStats.syncAmbassadorTierForUser(String(relation.referrer_id), {
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
