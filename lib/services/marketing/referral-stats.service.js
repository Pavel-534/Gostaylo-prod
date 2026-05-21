/**
 * Stage 109.1 — extracted from referral-pnl.service.js (ReferralStatsService).
 */
import { supabaseAdmin } from '@/lib/supabase';
import { ReferralTierSyncService } from '@/lib/services/marketing/referral-tier-sync.service.js';
import { ReferralLedgerService } from '@/lib/services/marketing/referral-ledger.service.js';
import { ReferralPromoTankService } from '@/lib/services/marketing/referral-promo-tank.service.js';
import {
  REFERRAL_TYPES,
  REFERRAL_STATUSES,
  REFERRAL_LEDGER_REFERRAL_TYPE,
  round2,
  getReferralSettings,
} from '@/lib/services/marketing/referral-calculation.js';

export function normalizeTierRow(row) {
    return ReferralTierSyncService.normalizeTierRow(row);
  }


export async function getReferralTiers() {
    return ReferralTierSyncService.getReferralTiers();
  }


export function tierRankIndex(tiers, tierId) {
    return ReferralTierSyncService.tierRankIndex(tiers, tierId);
  }


export function cohortMonthAnchorUtc(cohortMonthKey) {
    const key = String(cohortMonthKey || '').trim();
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
    return new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  }


export function addMonthsUtc(date, months) {
    const d = new Date(date.getTime());
    d.setUTCMonth(d.getUTCMonth() + months);
    return d;
  }


export function buildCohortRoiSeries({
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
    const horizonStart = ReferralStats.addMonthsUtc(now, -36);
    const cohortEntries = [...cohortMap.values()].filter((c) => {
      const a = ReferralStats.cohortMonthAnchorUtc(c.cohortMonth);
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
      const anchor = ReferralStats.cohortMonthAnchorUtc(c.cohortMonth);
      if (!anchor) continue;
      const cumulativeCommissionThb = {};
      for (const { key, months } of milestones) {
        const end = ReferralStats.addMonthsUtc(anchor, months);
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


export function chunkArray(arr, size) {
    const chunks = [];
    const a = Array.isArray(arr) ? arr : [];
    const n = Math.max(1, Number(size) || 100);
    for (let i = 0; i < a.length; i += n) chunks.push(a.slice(i, i + n));
    return chunks;
  }


export function resolveTierForPartnerCount(tiers, partnersInvitedCount) {
    return ReferralTierSyncService.resolveTierForPartnerCount(tiers, partnersInvitedCount);
  }


export async function countDirectPartnersInvited(referrerId) {
    return ReferralTierSyncService.countDirectPartnersInvited(referrerId);
  }


export async function syncAmbassadorTierForUser(userId, context = {}) {
    return ReferralTierSyncService.syncAmbassadorTierForUser(userId, context);
  }


export async function getMonitorStats() {
    const [ledgerRes, policy, tankRes, profilesRes, relationsRes] = await Promise.all([
      supabaseAdmin.from('referral_ledger').select('amount_thb,status,type,referral_type'),
      getReferralSettings(),
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


export async function getAnalyticsStats() {
    const [tiers, relationsRes, ledgerRes, profilesRes] = await Promise.all([
      ReferralStats.getReferralTiers(),
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
    for (const chunk of ReferralStats.chunkArray(refereeIdsList, 80)) {
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
    for (const chunk of ReferralStats.chunkArray(refereeIdsList, 80)) {
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

    const cohortRoi = ReferralStats.buildCohortRoiSeries({
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
