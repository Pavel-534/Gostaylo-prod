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
import { ReferralPolicyService } from '@/lib/services/marketing/referral-policy.service.js';
import * as ReferralStats from '@/lib/services/marketing/referral-stats.service.js';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';
import {
  bumpReferralCampaignSpent,
  resolveReferralCampaignForRelation,
} from '@/lib/services/marketing/referral-hold.service.js';
import { resolveReferralAccrualPolicy } from '@/lib/services/marketing/referral-reward-rules.service.js';
import { resolveReferralProgramCapGate } from '@/lib/services/marketing/referral-program-cap.service.js';
import {
  resolveGuestL2ReferrerId,
  resolveGuestL2ShadowAccrual,
  persistGuestL2ShadowToBooking,
} from '@/lib/services/marketing/referral-guest-l2-shadow.service.js';
import { getMonthlyGuestL2LiveSpentThb } from '@/lib/services/marketing/referral-guest-l2-live.service.js';
import { ReferralFraudGate } from '@/lib/services/marketing/referral-fraud-gate.service.js';
import {
  distributeReferralLedgerCreditAtomic,
  assertReferralAtomicCreditResult,
} from '@/lib/services/marketing/referral-distribute-atomic.service.js';
import { notifyReferralBonusEarned, notifyReferralBonusHeld } from '@/lib/services/marketing/referral-notification.service.js';


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
        'id,status,renter_id,price_thb,commission_thb,commission_rate,applied_commission_rate,pricing_snapshot,metadata,completed_at,updated_at',
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
    referrerAmountThb: referrerAmountOverride,
    refereeAmountThb: refereeAmountOverride,
    netProfitOrderThb,
    platformGrossRevenueThb,
    promoBoostThb = 0,
    policy,
    trigger,
    attributionId = null,
    campaignSlug = null,
    rewardRuleMetadata = null,
  }) {
    const grossPoolThb = round2(Math.max(0, referralPoolThb));
    const poolSplit = ReferralPolicyService.resolveLiveGuestPoolPayout(grossPoolThb, policy);
    const boostSplit = computeBoostSplit(promoBoostThb, policy?.referralBoostAllocationRule);
    const referrerAmountThb =
      referrerAmountOverride != null
        ? round2(referrerAmountOverride)
        : round2(poolSplit.referrerAmountThb + boostSplit.referrerBoostThb);
    const refereeAmountThb =
      refereeAmountOverride != null
        ? round2(refereeAmountOverride)
        : round2(poolSplit.refereeAmountThb + boostSplit.refereeBoostThb);
    const splitMeta = {
      guest_pool_split_mode: poolSplit.splitMode,
      guest_pool_gross_thb: poolSplit.grossPoolThb,
      guest_pool_payable_thb: round2(referrerAmountThb + refereeAmountThb),
      l2_withheld_thb: poolSplit.l2WithheldThb,
      guest_pool_l1_percent: poolSplit.l1Percent,
      guest_pool_l2_percent: poolSplit.l2Percent,
      guest_pool_referee_percent: poolSplit.refereePercent,
    };

    return ReferralLedgerService.createPendingLedgerRows({
      booking,
      relation,
      referralPoolThb: poolSplit.grossPoolThb,
      referrerAmountThb,
      refereeAmountThb,
      netProfitOrderThb,
      platformGrossRevenueThb,
      promoBoostThb,
      policy,
      trigger,
      referralType: REFERRAL_LEDGER_REFERRAL_TYPE.GUEST_BOOKING,
      attributionId,
      campaignSlug,
      rewardRuleMetadata: { ...(rewardRuleMetadata || {}), ...splitMeta },
    });
  }


export async function createPendingRows(args) {
    return createPendingLedgerRows(args);
  }

/**
 * Stage 131.3 — Live L2 ledger row (only when `ambassador_guest_l2_enabled === true`).
 * Shadow path remains in `referral-guest-l2-shadow.service.js` while flag is false.
 */
export async function createL2PendingLedgerRow({
  booking,
  relation,
  referralPoolThb,
  l2ReferrerId,
  netProfitOrderThb,
  platformGrossRevenueThb,
  policy,
  trigger,
  attributionId = null,
  campaignSlug = null,
  rewardRuleMetadata = null,
}) {
  if (policy?.ambassadorGuestL2Enabled !== true) {
    return { skipped: true, reason: 'L2_LIVE_DISABLED' };
  }
  const l2Id = String(l2ReferrerId || '').trim();
  if (!l2Id) return { skipped: true, reason: 'NO_L2_REFERRER' };

  const grossPoolThb = round2(Math.max(0, referralPoolThb));
  const l2Pct = Number(policy?.ambassadorGuestPoolL2Percent ?? 12);
  let amountThb = round2((grossPoolThb * l2Pct) / 100);

  const perBookingCap = round2(Math.max(0, Number(policy?.ambassadorGuestL2MaxThbPerBooking ?? 500)));
  const monthlyCap = round2(Math.max(0, Number(policy?.ambassadorGuestL2MaxThbPerMonth ?? 50_000)));
  if (perBookingCap > 0) amountThb = round2(Math.min(amountThb, perBookingCap));
  if (amountThb <= 0) return { skipped: true, reason: 'ZERO_L2_AMOUNT' };

  if (monthlyCap > 0) {
    // Live L2 caps — ledger SSOT only (shadow metadata excluded).
    const monthlySpent = await getMonthlyGuestL2LiveSpentThb(l2Id);
    const remaining = round2(Math.max(0, monthlyCap - monthlySpent));
    if (remaining <= 0) return { skipped: true, reason: 'L2_MONTHLY_CAP' };
    amountThb = round2(Math.min(amountThb, remaining));
  }

  const refereeId = String(relation?.referee_id || booking?.renter_id || '').trim();
  if (!refereeId) return { skipped: true, reason: 'NO_REFEREE' };

  const row = {
    id: makeId('rfl'),
    booking_id: String(booking.id),
    referrer_id: l2Id,
    referee_id: refereeId,
    amount_thb: amountThb,
    type: REFERRAL_TYPES.REFERRER_BONUS,
    referral_type: REFERRAL_LEDGER_REFERRAL_TYPE.GUEST_BOOKING,
    ledger_depth: clamp(Number(relation?.network_depth) || 1, 1, 32) + 1,
    status: REFERRAL_STATUSES.PENDING,
    net_profit_order_thb: netProfitOrderThb,
    platform_gross_thb: platformGrossRevenueThb,
    referral_pool_thb: grossPoolThb,
    metadata: {
      split_role: 'l2_mentor',
      l2_live: true,
      policy,
      trigger,
      ...(attributionId ? { attribution_id: String(attributionId) } : {}),
      ...(campaignSlug ? { campaign_slug: String(campaignSlug) } : {}),
      ...(rewardRuleMetadata && typeof rewardRuleMetadata === 'object' ? rewardRuleMetadata : {}),
    },
  };

  const { error } = await supabaseAdmin.from('referral_ledger').upsert([row], {
    onConflict: 'booking_id,type,referral_type,referrer_id',
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message || 'L2_LEDGER_UPSERT_FAILED');

  return { skipped: false, ledgerId: row.id, amountThb, l2ReferrerId: l2Id };
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


export async function clawbackEarnedLedgerForBooking(bookingId, options = {}) {
    return ReferralLedgerService.clawbackEarnedLedgerForBooking(bookingId, options);
  }


export async function revertReferralLedgerForBooking(bookingId, options = {}) {
    return ReferralLedgerService.revertReferralLedgerForBooking(bookingId, options);
  }


export async function markPendingAsEarned(bookingId, options = {}) {
    return ReferralLedgerService.markPendingAsEarned(bookingId, options);
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

    const policy = await getReferralSettings({ booking });
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

    const l2ReferrerId = resolveGuestL2ReferrerId(relation);
    let guestL2Shadow = null;
    if (l2ReferrerId && policy.ambassadorGuestL2Enabled !== true) {
      guestL2Shadow = await resolveGuestL2ShadowAccrual({
        referralPoolThb,
        policy,
        l2ReferrerId,
        at: booking.completed_at ? new Date(booking.completed_at) : new Date(),
      });
      if (guestL2Shadow.applicable) {
        await persistGuestL2ShadowToBooking(booking.id, booking.metadata, guestL2Shadow);
      }
    }

    const existing = await getLedgerRowsForBooking(booking.id);
    const alreadyEarned = existing.some(
      (row) =>
        row.status === REFERRAL_STATUSES.EARNED || row.status === REFERRAL_STATUSES.EARNED_HELD,
    );
    if (alreadyEarned) {
      return { success: true, skipped: true, reason: 'ALREADY_EARNED' };
    }

    const pendingRows = existing.filter((row) => row.status === REFERRAL_STATUSES.PENDING);
    let attribution = await ReferralAttributionService.getAttributionIdForBooking(booking.id);
    if (!attribution?.id && renterId) {
      attribution = await ReferralAttributionService.getAttributionIdForRenter(renterId);
    }
    const attributionId = attribution?.id || null;
    const attributionCampaignSlug = attribution?.campaignSlug || null;
    const campaignGate = await resolveReferralCampaignForRelation(relation);
    const campaign = campaignGate.campaign;
    const campaignSlug = campaign?.campaignSlug || attributionCampaignSlug || null;
    const holdDaysDefault = Math.max(0, Math.floor(Number(policy.referralHoldDays) || 0));
    const rewardResolution = await resolveReferralAccrualPolicy({
      bookingId: booking.id,
      bookingPriceThb: Number(booking.price_thb) || 0,
      campaignGate,
      defaultHoldDays: holdDaysDefault,
      defaultSplitRatio: policy.referralSplitRatio,
    });
    if (rewardResolution.shouldBlockByMinBooking) {
      return {
        success: true,
        skipped: true,
        reason: 'REWARD_RULE_MIN_BOOKING_BLOCK',
        data: {
          bookingId: booking.id,
          ruleId: rewardResolution.productionRule?.id || null,
          ruleVersion: rewardResolution.productionRule?.version || null,
          minBookingValueThb: rewardResolution.minBookingValueThb,
          bookingPriceThb: Number(booking.price_thb) || 0,
        },
      };
    }

    const poolSplit = ReferralPolicyService.resolveLiveGuestPoolPayout(referralPoolThb, policy);
    const boost = await applyPromoBoost({
      booking,
      policy,
      baseReferralPoolThb: referralPoolThb,
    });
    const boostSplit = computeBoostSplit(
      boost.boostAppliedThb,
      policy.referralBoostAllocationRule,
    );
    const referrerAmountThb = round2(poolSplit.referrerAmountThb + boostSplit.referrerBoostThb);
    const refereeAmountThb = round2(poolSplit.refereeAmountThb + boostSplit.refereeBoostThb);
    const finalReferralPoolThb = round2(referrerAmountThb + refereeAmountThb);

    const programCapGate = await resolveReferralProgramCapGate({
      proposedAccrualThb: finalReferralPoolThb,
      booking,
    });
    const capDeferred = programCapGate.deferred === true;
    const capMeta = capDeferred
      ? {
          cap_deferred: true,
          program_cap_thb: programCapGate.capThb,
          program_cap_spent_thb: programCapGate.spentThb,
          program_cap_remaining_thb: programCapGate.remainingThb,
          program_cap_month_start_utc: programCapGate.monthStartIso,
        }
      : {};

    if (pendingRows.length === 0) {
      await createPendingLedgerRows({
        booking,
        relation,
        referralPoolThb,
        promoBoostThb: boost.boostAppliedThb,
        netProfitOrderThb: netBase.netProfitOrderThb,
        platformGrossRevenueThb: netBase.platformGrossRevenueThb,
        policy,
        trigger,
        attributionId,
        campaignSlug,
        rewardRuleMetadata: { ...rewardResolution.metadataPatch, ...capMeta },
      });
    } else {
      await normalizePendingToSafetyCap(booking.id, pendingRows, safetyCapThb);
    }

    let guestL2Live = null;
    if (policy.ambassadorGuestL2Enabled === true && l2ReferrerId) {
      guestL2Live = await createL2PendingLedgerRow({
        booking,
        relation,
        referralPoolThb,
        l2ReferrerId,
        netProfitOrderThb: netBase.netProfitOrderThb,
        platformGrossRevenueThb: netBase.platformGrossRevenueThb,
        policy,
        trigger,
        attributionId,
        campaignSlug,
        rewardRuleMetadata: { ...rewardResolution.metadataPatch, ...capMeta },
      });
    }

    if (capDeferred) {
      return {
        success: true,
        skipped: true,
        reason: 'MONTHLY_PROGRAM_CAP_DEFERRED',
        data: {
          bookingId: booking.id,
          referralPoolThb: finalReferralPoolThb,
          programCap: programCapGate,
          ledgerStatus: REFERRAL_STATUSES.PENDING,
        },
      };
    }

    const completedAt = booking.completed_at || booking.updated_at || new Date().toISOString();
    const holdDays = rewardResolution.holdDays;
    await markPendingAsEarned(booking.id, {
      referralHoldDays: holdDays,
      completedAt,
      rewardRuleMetadata: rewardResolution.metadataPatch,
    });
    if (campaignGate.active && campaign?.codeId) {
      await bumpReferralCampaignSpent({ referralCodeId: campaign.codeId, deltaThb: finalReferralPoolThb });
    }
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
        grossReferralPoolThb: referralPoolThb,
        l2WithheldThb: poolSplit.l2WithheldThb,
        guestPoolSplitMode: poolSplit.splitMode,
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
        campaign: {
          campaignSlug,
          active: campaignGate.active,
          reason: campaignGate.reason || null,
          overrideHoldDaysApplied:
            campaignGate.active && Number.isFinite(campaign?.overrideHoldDays)
              ? Number(campaign.overrideHoldDays)
              : null,
        },
        rewardRule: {
          holdDaysApplied: holdDays,
          holdSource: rewardResolution.holdSource,
          ruleVersion: rewardResolution.productionRule?.version ?? null,
          ruleId: rewardResolution.productionRule?.id ?? null,
          appliedInProduction: rewardResolution.shouldApplyProductionRule,
          splitRatioApplied: null,
          guestPoolL1Percent: poolSplit.l1Percent,
          guestPoolRefereePercent: poolSplit.refereePercent,
          shadow: rewardResolution.shadowPayload,
        },
        guestL2Shadow:
          policy.ambassadorGuestL2Enabled !== true && guestL2Shadow?.applicable
            ? {
                l2ReferrerId: guestL2Shadow.l2ReferrerId,
                shadowL2Thb: guestL2Shadow.shadowL2Thb,
                mode: 'shadow',
              }
            : null,
        guestL2Live:
          policy.ambassadorGuestL2Enabled === true && guestL2Live && !guestL2Live.skipped
            ? {
                l2ReferrerId: guestL2Live.l2ReferrerId,
                amountThb: guestL2Live.amountThb,
                ledgerId: guestL2Live.ledgerId,
                mode: 'live',
              }
            : guestL2Live?.skipped
              ? { mode: 'live_skipped', reason: guestL2Live.reason }
              : null,
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

    const policy = await getReferralSettings({ booking });
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
    const ledgerRows = [];
    for (const row of normalizedRows.filter((r) => r.amountThb > 0)) {
      const draft = {
        id: makeId('rfl'),
        booking_id: id,
        referrer_id: String(row.referrerId),
        referee_id: String(relation.referee_id || listing.owner_id),
        amount_thb: row.amountThb,
        type: REFERRAL_TYPES.REFERRER_BONUS,
        referral_type: REFERRAL_LEDGER_REFERRAL_TYPE.HOST_ACTIVATION,
        ledger_depth: row.level,
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
      };
      const gate = await ReferralFraudGate.evaluateAccrualForLedgerRow({ row: draft, bookingId: id });
      if (gate.hold) {
        ledgerRows.push({
          ...draft,
          status: REFERRAL_STATUSES.EARNED_HELD,
          unlock_at: null,
          metadata: ReferralFraudGate.buildAccrualHoldMetadata(draft.metadata, gate, nowIso),
        });
      } else {
        ledgerRows.push({
          ...draft,
          status: REFERRAL_STATUSES.EARNED,
        });
      }
    }
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
      if (ReferralFraudGate.isFraudGateHeldRow(row)) {
        await ReferralFraudGate.enqueueAccrualFraudHold({
          row,
          gate: {
            ruleCodes: row.metadata?.fraud_gate_rules || [],
            beneficiaryId: String(row.referrer_id),
            referrerId: row.referrer_id,
            refereeId: row.referee_id,
          },
          bookingId: id,
        });
        void notifyReferralBonusHeld({
          beneficiaryId: String(row.referrer_id),
          amountThb: row.amount_thb,
          bookingId: id,
          ledgerId: String(row.id),
          ledgerDepth: row.ledger_depth,
          referralType: row.referral_type,
          referrerId: row.referrer_id,
          refereeId: row.referee_id,
          fraudGateHold: true,
          holdDays: 0,
        });
        continue;
      }
      const credit = await distributeReferralLedgerCreditAtomic({
        row,
        bookingId: id,
        earnedAt: nowIso,
        creditOnly: true,
      });
      assertReferralAtomicCreditResult(credit, {
        bookingId: id,
        ledgerId: String(row.id),
        operation: 'hostActivationWalletCredit',
      });
      if (credit?.walletApplied === true) {
        void notifyReferralBonusEarned({
          beneficiaryId: String(row.referrer_id),
          amountThb: row.amount_thb,
          bookingId: id,
          ledgerId: String(row.id),
          txType: 'referral_bonus',
          ledgerDepth: row.ledger_depth,
          referralType: row.referral_type,
          unlocked: true,
        });
      }
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
