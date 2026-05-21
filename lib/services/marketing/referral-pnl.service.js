/**
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
  static clawbackEarnedLedgerForBooking(bookingId, options) {
    return ReferralPayout.clawbackEarnedLedgerForBooking(bookingId, options);
  }
  static revertReferralLedgerForBooking(bookingId, options) {
    return ReferralPayout.revertReferralLedgerForBooking(bookingId, options);
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
