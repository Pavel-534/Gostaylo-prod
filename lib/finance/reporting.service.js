/**
 * Stage 120.5–120.6 — SSOT financial metrics for referral P&L (Phase A complete).
 *
 * READY for Financial Intelligence Dashboard (site-wide):
 * - `computeMargins` / `computeRoi` — gross & net margin, clawback
 * - `fetchReferralLedgerBundle` — earned + canceled ledger rows
 * - `computeReferralPeriodMetrics` — period KPI block + promo tank balance
 * - `buildReferrerMonetaryRows` — per-referrer P&L table
 * - `getReferrerDetail` + `buildReferrerCohortSeries` — drill-down & 1C-style cohorts
 * - CSV builders for referrers and referrer×month
 *
 * Consumers today:
 * - `/admin/marketing/attribution` («Рефералка & Деньги»)
 * - `ReferralAttributionService.getAdminDashboard` / `getAdminReferrerDetail` (thin delegates)
 *
 * Phase B1 — referral funnel SSOT (`computeReferralFunnelBundle`): click → signup → first booking → repeat.
 * Do not fork funnel math in UI or routes.
 *
 * Do NOT duplicate margin/ROI/clawback math outside this module for admin reporting.
 */
import { supabaseAdmin } from '@/lib/supabase';
import { REFERRAL_GUEST_MARGIN_BOOKING_STATUSES } from '@/lib/booking/status-sets.js';
import ReferralPromoTankService from '@/lib/services/marketing/referral-promo-tank.service.js';
import { REFERRAL_STATUSES, round2 } from '@/lib/services/marketing/referral-calculation.js';
import { sumOutstandingHeldReferralThb } from '@/lib/services/marketing/referral-hold.service.js';

/** Paid / in-stay bookings for funnel (not PENDING/INQUIRY). */
const FUNNEL_BOOKING_STATUSES = Object.freeze([
  ...REFERRAL_GUEST_MARGIN_BOOKING_STATUSES,
  'THAWED',
  'READY_FOR_PAYOUT',
]);

function funnelPct(part, whole) {
  const p = Number(part);
  const w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return null;
  return round2((p / w) * 100);
}

function utcDateKey(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildUtcDayKeys(fromIso, toIso) {
  const start = new Date(fromIso);
  const end = new Date(toIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const keys = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= endDay) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function chainFunnelStages(counts, labels) {
  const top = Number(counts[0]) || 0;
  return counts.map((count, i) => ({
    id: labels[i].id,
    label: labels[i].label,
    count: Number(count) || 0,
    pctFromPrevious: i === 0 ? null : funnelPct(count, counts[i - 1]),
    pctFromTop: funnelPct(count, top),
  }));
}

function defaultReferrerFunnelRow() {
  return {
    clicksCount: 0,
    signupsCount: 0,
    firstBookingUsersCount: 0,
    repeatBookingUsersCount: 0,
    repeatBookingsCount: 0,
    firstBookingCrPct: null,
    signupToFirstBookingPct: null,
    earnedThb: 0,
  };
}

const CANCELED_STATUSES = new Set([
  REFERRAL_STATUSES.CANCELED,
  REFERRAL_STATUSES.CANCELED_DEFICIT,
]);

function profileDisplayName(p) {
  if (!p) return '';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return name || p.email || p.id || '';
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function mergeConversionDates(map, referrerId, iso) {
  if (!iso) return;
  const refId = String(referrerId || '').trim();
  if (!refId) return;
  const prev = map.get(refId);
  if (!prev) {
    map.set(refId, { first: iso, last: iso });
    return;
  }
  if (iso < prev.first) prev.first = iso;
  if (iso > prev.last) prev.last = iso;
}

function utcMonthKey(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function computeRoi(commissionThb, bonusesThb) {
  const bonuses = round2(bonusesThb);
  if (bonuses <= 0) return null;
  return round2(Number(commissionThb) / bonuses);
}

function computeMargins({ commissionThb, bonusesThb, clawbackThb }) {
  const commission = round2(commissionThb);
  const bonuses = round2(bonusesThb);
  const clawback = round2(clawbackThb);
  const grossMarginThb = round2(commission - bonuses);
  const netMarginThb = round2(grossMarginThb - clawback);
  return { commissionThb: commission, bonusesThb: bonuses, clawbackThb: clawback, grossMarginThb, netMarginThb };
}

/** Сумма брони в THB (колонка `price_thb`, запасной вариант `price_paid`). */
function bookingGrossThb(row) {
  if (!row) return 0;
  return round2(Number(row.price_thb) || Number(row.price_paid) || 0);
}

async function fetchBookingsByIds(bookingIds) {
  const map = new Map();
  const ids = [...new Set((bookingIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, commission_thb, renter_id, status, created_at, price_thb, price_paid')
      .in('id', chunk);
    if (error) throw new Error(error.message || 'REPORTING_BOOKINGS_READ_FAILED');
    for (const row of data || []) map.set(String(row.id), row);
  }
  return map;
}

export class FinancialReportingService {
  static round2 = round2;

  /**
   * Fetch earned + clawback ledger rows for a period (referral_ledger SSOT).
   * Used by referral dashboard and future global financial rollups.
   */
  static async fetchReferralLedgerBundle({ fromIso, toIso, referrerId = '' } = {}) {
    const rid = referrerId ? String(referrerId).trim() : '';

    let earnedQ = supabaseAdmin
      .from('referral_ledger')
      .select(
        'id, referrer_id, referee_id, booking_id, amount_thb, type, status, metadata, earned_at, created_at, canceled_at',
      )
      .eq('status', REFERRAL_STATUSES.EARNED)
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    if (rid) earnedQ = earnedQ.eq('referrer_id', rid);

    let clawbackQ = supabaseAdmin
      .from('referral_ledger')
      .select(
        'id, referrer_id, referee_id, booking_id, amount_thb, type, status, metadata, earned_at, created_at, canceled_at',
      )
      .in('status', [...CANCELED_STATUSES])
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    if (rid) clawbackQ = clawbackQ.eq('referrer_id', rid);

    const [earnedRes, clawbackRes] = await Promise.all([earnedQ, clawbackQ]);
    if (earnedRes.error) throw new Error(earnedRes.error.message || 'REPORTING_LEDGER_EARNED_FAILED');
    if (clawbackRes.error) throw new Error(clawbackRes.error.message || 'REPORTING_LEDGER_CLAWBACK_FAILED');

    return {
      earnedRows: earnedRes.data || [],
      clawbackRows: clawbackRes.data || [],
    };
  }

  /** Stage 121.1 — outstanding earned_held (live, not period-scoped). */
  static async fetchReferralHeldByReferrerMap({ referrerId = '' } = {}) {
    const rid = referrerId ? String(referrerId).trim() : '';
    let q = supabaseAdmin
      .from('referral_ledger')
      .select('referrer_id, amount_thb, type')
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .eq('type', 'bonus');
    if (rid) q = q.eq('referrer_id', rid);
    const { data, error } = await q.limit(10000);
    if (error) throw new Error(error.message || 'REPORTING_HELD_LEDGER_FAILED');
    const map = new Map();
    for (const row of data || []) {
      const refId = String(row.referrer_id || '').trim();
      if (!refId) continue;
      map.set(refId, round2((map.get(refId) || 0) + (Number(row.amount_thb) || 0)));
    }
    return map;
  }

  static async fetchReferralHeldOutstandingThb({ referrerId = '' } = {}) {
    return sumOutstandingHeldReferralThb({ referrerId });
  }

  /**
   * Period KPI block for referral monetary dashboard + future Financial Intelligence Dashboard.
   */
  static async computeReferralPeriodMetrics({
    fromIso,
    toIso,
    earnedRows = [],
    clawbackRows = [],
    commissionBookingIds = [],
  } = {}) {
    let earnedTotalThb = 0;
    let clawbackTotalThb = 0;
    const refereesWithEarned = new Set();

    for (const row of earnedRows) {
      earnedTotalThb += Number(row.amount_thb) || 0;
      const refereeId = String(row.referee_id || '').trim();
      if (refereeId) refereesWithEarned.add(refereeId);
    }
    for (const row of clawbackRows) {
      clawbackTotalThb += Number(row.amount_thb) || 0;
    }

    earnedTotalThb = round2(earnedTotalThb);
    clawbackTotalThb = round2(clawbackTotalThb);

    let referredCommissionThb = 0;
    const bookingIds = [...new Set((commissionBookingIds || []).map(String).filter(Boolean))];
    if (bookingIds.length) {
      const bookingMap = await fetchBookingsByIds(bookingIds);
      referredCommissionThb = round2(
        bookingIds.reduce((s, bid) => s + (Number(bookingMap.get(bid)?.commission_thb) || 0), 0),
      );
    }

    const margins = computeMargins({
      commissionThb: referredCommissionThb,
      bonusesThb: earnedTotalThb,
      clawbackThb: clawbackTotalThb,
    });

    const promoTank = await ReferralPromoTankService.getCurrentBalance();
    const promoTankBalanceThb = round2(promoTank.balanceThb);
    const promoTankSpendThb = earnedTotalThb;
    const tankDenom = round2(promoTankSpendThb + promoTankBalanceThb);
    const promoTankSpentPct =
      tankDenom > 0 ? round2((promoTankSpendThb / tankDenom) * 100) : null;

    const roiIndex = computeRoi(referredCommissionThb, earnedTotalThb);
    const avgEarnedPerReferralThb =
      refereesWithEarned.size > 0 ? round2(earnedTotalThb / refereesWithEarned.size) : 0;

    return {
      ...margins,
      referralSpendThb: earnedTotalThb,
      promoTankSpendThb: earnedTotalThb,
      earnedBonusesThb: earnedTotalThb,
      referredCommissionThb,
      roiIndex,
      roiPct: roiIndex != null ? round2(roiIndex * 100) : null,
      avgEarnedPerReferralThb,
      promoTankBalanceThb,
      promoTankSpentPct,
      /** @deprecated use netMarginThb — kept for backward compat */
      netMarginThb: margins.netMarginThb,
    };
  }

  /**
   * Phase B1 — full attribution funnel for admin dashboard.
   * Click (last-touch) → signup → first paid booking → repeat bookings.
   */
  static async computeReferralFunnelBundle({
    fromIso,
    toIso,
    referrerId = '',
    utmFilter = '',
    earnedRows = [],
  } = {}) {
    const rid = referrerId ? String(referrerId).trim() : '';
    const utm = utmFilter ? String(utmFilter).trim().toLowerCase() : '';

    let clicksQ = supabaseAdmin
      .from('referral_attributions')
      .select('id, referrer_id, utm_source, created_at')
      .eq('touch_type', 'last')
      .gte('created_at', fromIso)
      .lte('created_at', toIso);
    if (rid) clicksQ = clicksQ.eq('referrer_id', rid);
    if (utm) clicksQ = clicksQ.ilike('utm_source', utm);
    const { data: clickRows, error: clicksErr } = await clicksQ;
    if (clicksErr) throw new Error(clicksErr.message || 'FUNNEL_CLICKS_FAILED');

    let convQ = supabaseAdmin
      .from('referral_attributions')
      .select('referrer_id, converted_profile_id, utm_source, converted_at')
      .eq('status', 'converted')
      .gte('converted_at', fromIso)
      .lte('converted_at', toIso)
      .not('converted_profile_id', 'is', null);
    if (rid) convQ = convQ.eq('referrer_id', rid);
    if (utm) convQ = convQ.ilike('utm_source', utm);
    const { data: convRows, error: convErr } = await convQ;
    if (convErr) throw new Error(convErr.message || 'FUNNEL_CONVERTED_FAILED');

    let relQ = supabaseAdmin
      .from('referral_relations')
      .select('referrer_id, referee_id, referred_at')
      .gte('referred_at', fromIso)
      .lte('referred_at', toIso);
    if (rid) relQ = relQ.eq('referrer_id', rid);
    const { data: relRows, error: relErr } = await relQ;
    if (relErr) throw new Error(relErr.message || 'FUNNEL_RELATIONS_FAILED');

    /** @type {Map<string, { referrerId: string, utmSource: string, referredAt: string }>} */
    const signupByReferee = new Map();
    for (const row of convRows || []) {
      const refereeId = String(row.converted_profile_id || '').trim();
      const refId = String(row.referrer_id || '').trim();
      if (!refereeId || !refId) continue;
      const existing = signupByReferee.get(refereeId);
      const referredAt = row.converted_at ? String(row.converted_at) : '';
      if (!existing || (referredAt && referredAt < existing.referredAt)) {
        signupByReferee.set(refereeId, {
          referrerId: refId,
          utmSource: String(row.utm_source || '').trim() || '(none)',
          referredAt,
        });
      }
    }
    for (const row of relRows || []) {
      const refereeId = String(row.referee_id || '').trim();
      const refId = String(row.referrer_id || '').trim();
      if (!refereeId || !refId) continue;
      if (signupByReferee.has(refereeId)) continue;
      signupByReferee.set(refereeId, {
        referrerId: refId,
        utmSource: '(relation)',
        referredAt: row.referred_at ? String(row.referred_at) : '',
      });
    }

    const refereeIds = [...signupByReferee.keys()];
    const bookingsByReferee = new Map();
    if (refereeIds.length) {
      for (let i = 0; i < refereeIds.length; i += 80) {
        const chunk = refereeIds.slice(i, i + 80);
        const { data: bookings, error: bErr } = await supabaseAdmin
          .from('bookings')
          .select('id, renter_id, status, created_at')
          .in('renter_id', chunk)
          .in('status', [...FUNNEL_BOOKING_STATUSES])
          .order('created_at', { ascending: true });
        if (bErr) throw new Error(bErr.message || 'FUNNEL_BOOKINGS_FAILED');
        for (const b of bookings || []) {
          const renterId = String(b.renter_id || '').trim();
          if (!bookingsByReferee.has(renterId)) bookingsByReferee.set(renterId, []);
          bookingsByReferee.get(renterId).push(b);
        }
      }
    }

    let earnedTotalThb = 0;
    const earnedByReferrer = new Map();
    for (const row of earnedRows || []) {
      const amt = Number(row.amount_thb) || 0;
      earnedTotalThb += amt;
      const refId = String(row.referrer_id || '').trim();
      if (refId) earnedByReferrer.set(refId, (earnedByReferrer.get(refId) || 0) + amt);
    }
    earnedTotalThb = round2(earnedTotalThb);

    const byReferrer = new Map();
    const byUtm = new Map();
    let firstBookingUsers = 0;
    let repeatBookingUsers = 0;
    let repeatBookingsCount = 0;

    const dayKeys = buildUtcDayKeys(fromIso, toIso);
    const chartByDay = new Map(
      dayKeys.map((k) => [
        k,
        { date: k, clicks: 0, signups: 0, firstBookings: 0, repeatBookings: 0, earnedThb: 0 },
      ]),
    );

    for (const row of clickRows || []) {
      const refId = String(row.referrer_id || '').trim();
      const utmKey = String(row.utm_source || '').trim() || '(none)';
      if (!byReferrer.has(refId)) byReferrer.set(refId, { ...defaultReferrerFunnelRow(), referrerId: refId });
      byReferrer.get(refId).clicksCount += 1;
      if (!byUtm.has(utmKey)) {
        byUtm.set(utmKey, { utmSource: utmKey, clicks: 0, signups: 0, firstBookings: 0, repeatBookings: 0 });
      }
      byUtm.get(utmKey).clicks += 1;
      const dk = utcDateKey(row.created_at);
      if (dk && chartByDay.has(dk)) chartByDay.get(dk).clicks += 1;
    }

    for (const [refereeId, meta] of signupByReferee) {
      const refId = meta.referrerId;
      const utmKey = meta.utmSource || '(none)';
      if (!byReferrer.has(refId)) byReferrer.set(refId, { ...defaultReferrerFunnelRow(), referrerId: refId });
      byReferrer.get(refId).signupsCount += 1;
      if (!byUtm.has(utmKey)) {
        byUtm.set(utmKey, { utmSource: utmKey, clicks: 0, signups: 0, firstBookings: 0, repeatBookings: 0 });
      }
      byUtm.get(utmKey).signups += 1;
      const signupDay = utcDateKey(meta.referredAt);
      if (signupDay && chartByDay.has(signupDay)) chartByDay.get(signupDay).signups += 1;

      const userBookings = bookingsByReferee.get(refereeId) || [];
      const paidCount = userBookings.length;
      if (paidCount >= 1) {
        firstBookingUsers += 1;
        byReferrer.get(refId).firstBookingUsersCount += 1;
        byUtm.get(utmKey).firstBookings += 1;
        const firstBk = userBookings[0];
        const fbDay = utcDateKey(firstBk?.created_at);
        if (fbDay && chartByDay.has(fbDay)) chartByDay.get(fbDay).firstBookings += 1;
      }
      if (paidCount >= 2) {
        repeatBookingUsers += 1;
        byReferrer.get(refId).repeatBookingUsersCount += 1;
        const extra = paidCount - 1;
        repeatBookingsCount += extra;
        byReferrer.get(refId).repeatBookingsCount += extra;
        byUtm.get(utmKey).repeatBookings += extra;
        for (let bi = 1; bi < userBookings.length; bi += 1) {
          const rbDay = utcDateKey(userBookings[bi]?.created_at);
          if (rbDay && chartByDay.has(rbDay)) chartByDay.get(rbDay).repeatBookings += 1;
        }
      }
    }

    for (const row of earnedRows || []) {
      const dk = utcDateKey(row.earned_at || row.created_at);
      if (dk && chartByDay.has(dk)) {
        chartByDay.get(dk).earnedThb = round2(
          chartByDay.get(dk).earnedThb + (Number(row.amount_thb) || 0),
        );
      }
    }

    for (const [refId, agg] of byReferrer) {
      agg.earnedThb = round2(earnedByReferrer.get(refId) || 0);
      agg.firstBookingCrPct = funnelPct(agg.firstBookingUsersCount, agg.signupsCount);
      agg.signupToFirstBookingPct = agg.firstBookingCrPct;
      agg.clickToSignupPct = funnelPct(agg.signupsCount, agg.clicksCount);
    }

    const clicksCount = (clickRows || []).length;
    const signupsCount = signupByReferee.size;
    const stageLabels = [
      { id: 'click', label: 'Клики' },
      { id: 'signup', label: 'Регистрации' },
      { id: 'first_booking', label: 'Первая бронь' },
      { id: 'repeat', label: 'Повторные брони (гости)' },
    ];
    const stages = chainFunnelStages(
      [clicksCount, signupsCount, firstBookingUsers, repeatBookingUsers],
      stageLabels,
    );
    stages.push({
      id: 'repeat_events',
      label: 'Повторные брони (события)',
      count: repeatBookingsCount,
      pctFromPrevious: funnelPct(repeatBookingsCount, repeatBookingUsers),
      pctFromTop: funnelPct(repeatBookingsCount, clicksCount),
    });

    const byUtmRows = [...byUtm.values()]
      .map((row) => ({
        ...row,
        clickToSignupPct: funnelPct(row.signups, row.clicks),
        signupToFirstBookingPct: funnelPct(row.firstBookings, row.signups),
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const byReferrerRows = [...byReferrer.values()].map((row) => ({
      ...row,
      clickToSignupPct: funnelPct(row.signupsCount, row.clicksCount),
      signupToFirstBookingPct: row.firstBookingCrPct,
    }));

    return {
      stages,
      summary: {
        clicksCount,
        signupsCount,
        firstBookingUsersCount: firstBookingUsers,
        repeatBookingUsersCount: repeatBookingUsers,
        repeatBookingsCount,
        earnedTotalThb,
        clickToSignupPct: funnelPct(signupsCount, clicksCount),
        signupToFirstBookingPct: funnelPct(firstBookingUsers, signupsCount),
        repeatUserPct: funnelPct(repeatBookingUsers, firstBookingUsers),
      },
      byUtm: byUtmRows,
      byReferrer: byReferrerRows,
      byReferrerMap: new Map(byReferrerRows.map((r) => [r.referrerId, r])),
      chartDaily: [...chartByDay.values()],
    };
  }

  /** Merge funnel metrics into monetary referrer rows. */
  static mergeReferrerRowsWithFunnel(monetaryRows, funnelBundle) {
    const map = funnelBundle?.byReferrerMap || new Map();
    return (monetaryRows || []).map((row) => {
      const f = map.get(row.referrerId) || defaultReferrerFunnelRow();
      return {
        ...row,
        clicksCount: f.clicksCount,
        signupsCount: f.signupsCount || row.referredUsersCount,
        firstBookingUsersCount: f.firstBookingUsersCount,
        repeatBookingUsersCount: f.repeatBookingUsersCount,
        repeatBookingsCount: f.repeatBookingsCount,
        firstBookingCrPct: f.firstBookingCrPct,
        clickToSignupPct: f.clickToSignupPct,
      };
    });
  }

  /**
   * Per-referrer monetary rows (1C-style). Supports profitability filter.
   */
  static async buildReferrerMonetaryRows({
    fromIso,
    toIso,
    utmFilter = '',
    referrerId = '',
    minMarginThb = null,
    profitabilityFilter = 'all',
    earnedRows = [],
    clawbackRows = [],
  } = {}) {
    const rid = referrerId ? String(referrerId).trim() : '';
    let utmReferrerIds = null;
    if (utmFilter) {
      const { data, error } = await supabaseAdmin
        .from('referral_attributions')
        .select('referrer_id')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .ilike('utm_source', utmFilter);
      if (error) throw new Error(error.message || 'REPORTING_UTM_REFERRERS_FAILED');
      utmReferrerIds = new Set(
        (data || []).map((r) => String(r.referrer_id || '').trim()).filter(Boolean),
      );
    }

    const byReferrer = new Map();
    const conversionDates = new Map();

    const ensureAgg = (refId) => {
      if (!byReferrer.has(refId)) {
        byReferrer.set(refId, {
          referrerId: refId,
          bonusesThb: 0,
          clawbackThb: 0,
          bookingIds: new Set(),
          refereeIds: new Set(),
        });
      }
      return byReferrer.get(refId);
    };

    for (const row of earnedRows || []) {
      const refId = String(row.referrer_id || '').trim();
      if (!refId) continue;
      if (rid && refId !== rid) continue;
      if (utmReferrerIds && !utmReferrerIds.has(refId)) continue;
      const agg = ensureAgg(refId);
      agg.bonusesThb += Number(row.amount_thb) || 0;
      if (row.booking_id) agg.bookingIds.add(String(row.booking_id));
      if (row.referee_id) agg.refereeIds.add(String(row.referee_id));
    }

    for (const row of clawbackRows || []) {
      const refId = String(row.referrer_id || '').trim();
      if (!refId) continue;
      if (rid && refId !== rid) continue;
      if (utmReferrerIds && !utmReferrerIds.has(refId)) continue;
      const agg = ensureAgg(refId);
      agg.clawbackThb += Number(row.amount_thb) || 0;
      if (row.booking_id) agg.bookingIds.add(String(row.booking_id));
    }

    let attrQ = supabaseAdmin
      .from('referral_attributions')
      .select('referrer_id, converted_profile_id, converted_at, booking_id')
      .eq('status', 'converted')
      .gte('converted_at', fromIso)
      .lte('converted_at', toIso);
    if (rid) attrQ = attrQ.eq('referrer_id', rid);
    if (utmFilter) attrQ = attrQ.ilike('utm_source', utmFilter);
    const { data: convAttrs, error: convAttrErr } = await attrQ;
    if (convAttrErr) throw new Error(convAttrErr.message || 'REPORTING_CONVERTED_ATTR_FAILED');

    for (const row of convAttrs || []) {
      const refId = String(row.referrer_id || '').trim();
      if (!refId) continue;
      if (utmReferrerIds && !utmReferrerIds.has(refId)) continue;
      const agg = ensureAgg(refId);
      if (row.converted_profile_id) agg.refereeIds.add(String(row.converted_profile_id));
      if (row.booking_id) agg.bookingIds.add(String(row.booking_id));
      mergeConversionDates(conversionDates, refId, row.converted_at ? String(row.converted_at) : null);
    }

    const referrerIds = [...byReferrer.keys()];
    if (referrerIds.length) {
      for (let i = 0; i < referrerIds.length; i += 200) {
        const chunk = referrerIds.slice(i, i + 200);
        const { data: relations, error: relErr } = await supabaseAdmin
          .from('referral_relations')
          .select('referrer_id, referee_id, referred_at')
          .in('referrer_id', chunk);
        if (relErr) throw new Error(relErr.message || 'REPORTING_RELATIONS_FAILED');
        for (const rel of relations || []) {
          const refId = String(rel.referrer_id || '').trim();
          if (!byReferrer.has(refId)) continue;
          byReferrer.get(refId).refereeIds.add(String(rel.referee_id || '').trim());
          mergeConversionDates(
            conversionDates,
            refId,
            rel.referred_at ? String(rel.referred_at) : null,
          );
        }
      }
    }

    const allBookingIds = [
      ...new Set([...byReferrer.values()].flatMap((agg) => [...agg.bookingIds])),
    ];
    const bookingMap = allBookingIds.length ? await fetchBookingsByIds(allBookingIds) : new Map();

    const minMargin =
      minMarginThb != null && minMarginThb !== '' && Number.isFinite(Number(minMarginThb))
        ? Number(minMarginThb)
        : null;

    const profFilter = String(profitabilityFilter || 'all').toLowerCase();
    const heldByReferrer = await this.fetchReferralHeldByReferrerMap({ referrerId: rid });

    const rawRows = [];
    for (const [refId, agg] of byReferrer) {
      let commissionThb = 0;
      for (const bid of agg.bookingIds) {
        commissionThb += Number(bookingMap.get(bid)?.commission_thb) || 0;
      }
      const margins = computeMargins({
        commissionThb,
        bonusesThb: agg.bonusesThb,
        clawbackThb: agg.clawbackThb,
      });
      const roiIndex = computeRoi(margins.commissionThb, margins.bonusesThb);

      if (minMargin != null && margins.netMarginThb < minMargin) continue;
      if (profFilter === 'profitable' && margins.netMarginThb <= 0) continue;
      if (profFilter === 'unprofitable' && margins.netMarginThb > 0) continue;

      const cd = conversionDates.get(refId);
      rawRows.push({
        referrerId: refId,
        referredUsersCount: agg.refereeIds.size,
        bookingsCount: agg.bookingIds.size,
        heldBonusesThb: round2(heldByReferrer.get(refId) || 0),
        ...margins,
        roiIndex,
        firstConversionAt: cd?.first || null,
        lastConversionAt: cd?.last || null,
      });
    }

    const profileIds = rawRows.map((r) => r.referrerId);
    const profileMap = new Map();
    if (profileIds.length) {
      for (let i = 0; i < profileIds.length; i += 200) {
        const chunk = profileIds.slice(i, i + 200);
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email, first_name, last_name, referral_code')
          .in('id', chunk);
        for (const p of profiles || []) profileMap.set(String(p.id), p);
      }
    }

    return rawRows.map((row) => {
      const p = profileMap.get(row.referrerId);
      return {
        ...row,
        name: profileDisplayName(p) || row.referrerId,
        email: p?.email || null,
        referralCode: p?.referral_code || null,
        isProfitable: Number(row.netMarginThb) > 0,
      };
    });
  }

  /**
   * Monthly cohort breakdown for one referrer (drill-down tab).
   * Future Financial Intelligence Dashboard will aggregate cohorts across all referrers.
   */
  static buildReferrerCohortSeries({ referrerId, earnedRows = [], clawbackRows = [], relations = [] }) {
    const rid = String(referrerId || '').trim();
    const byMonth = new Map();

    const ensureMonth = (key) => {
      if (!byMonth.has(key)) {
        byMonth.set(key, {
          cohortMonth: key,
          referredUsersCount: 0,
          bookingsCount: 0,
          commissionThb: 0,
          bonusesThb: 0,
          clawbackThb: 0,
          grossMarginThb: 0,
          netMarginThb: 0,
        });
      }
      return byMonth.get(key);
    };

    const referredByMonth = new Map();
    for (const rel of relations || []) {
      const key = utcMonthKey(rel.referred_at);
      if (!key) continue;
      if (!referredByMonth.has(key)) referredByMonth.set(key, new Set());
      referredByMonth.get(key).add(String(rel.referee_id || '').trim());
    }
    for (const [key, set] of referredByMonth) {
      ensureMonth(key).referredUsersCount = set.size;
    }

    const bookingsByMonth = new Map();
    for (const row of earnedRows || []) {
      if (String(row.referrer_id || '').trim() !== rid) continue;
      const key = utcMonthKey(row.earned_at || row.created_at);
      if (!key) continue;
      const m = ensureMonth(key);
      m.bonusesThb = round2(m.bonusesThb + (Number(row.amount_thb) || 0));
      if (row.booking_id) {
        const bid = String(row.booking_id);
        if (!bookingsByMonth.has(key)) bookingsByMonth.set(key, new Set());
        bookingsByMonth.get(key).add(bid);
      }
    }
    for (const row of clawbackRows || []) {
      if (String(row.referrer_id || '').trim() !== rid) continue;
      const key = utcMonthKey(row.canceled_at || row.created_at);
      if (!key) continue;
      ensureMonth(key).clawbackThb = round2(
        ensureMonth(key).clawbackThb + (Number(row.amount_thb) || 0),
      );
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, row]) => {
        row.bookingsCount = bookingsByMonth.get(key)?.size || 0;
        const margins = computeMargins(row);
        return {
          cohortMonth: key,
          referredUsersCount: row.referredUsersCount,
          bookingsCount: row.bookingsCount,
          ...margins,
          roiIndex: computeRoi(margins.commissionThb, margins.bonusesThb),
        };
      });
  }

  /**
   * Referrer drill-down card with cohort tab data.
   */
  static async getReferrerDetail(referrerId, { dateFrom = null, dateTo = null } = {}) {
    const rid = String(referrerId || '').trim();
    if (!rid) return { error: 'REFERRER_ID_REQUIRED', status: 400 };

    const now = new Date();
    const toIso = dateTo ? new Date(dateTo).toISOString() : now.toISOString();
    const fromDefault = new Date(now.getTime() - 30 * 86400000);
    const fromIso = dateFrom ? new Date(dateFrom).toISOString() : fromDefault.toISOString();

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, first_name, last_name, referral_code, created_at')
      .eq('id', rid)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message || 'REPORTING_PROFILE_FAILED');
    if (!profile) return { error: 'REFERRER_NOT_FOUND', status: 404 };

    const ledgerBundle = await this.fetchReferralLedgerBundle({ fromIso, toIso, referrerId: rid });
    const { earnedRows, clawbackRows } = ledgerBundle;

    const { data: heldRows, error: heldErr } = await supabaseAdmin
      .from('referral_ledger')
      .select(
        'id, referrer_id, referee_id, booking_id, amount_thb, type, status, earned_at, created_at, unlock_at',
      )
      .eq('referrer_id', rid)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .eq('type', 'bonus')
      .limit(500);
    if (heldErr) throw new Error(heldErr.message || 'REPORTING_HELD_ROWS_FAILED');
    const heldOutstandingThb = round2(
      (heldRows || []).reduce((s, r) => s + (Number(r.amount_thb) || 0), 0),
    );

    const { data: relations, error: relErr } = await supabaseAdmin
      .from('referral_relations')
      .select('id, referee_id, referred_at, network_depth')
      .eq('referrer_id', rid)
      .order('referred_at', { ascending: false });
    if (relErr) throw new Error(relErr.message || 'REPORTING_RELATIONS_FAILED');

    const refereeIds = (relations || []).map((r) => String(r.referee_id || '').trim()).filter(Boolean);
    const refereeProfileMap = new Map();
    if (refereeIds.length) {
      for (let i = 0; i < refereeIds.length; i += 200) {
        const chunk = refereeIds.slice(i, i + 200);
        const { data: refProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email, first_name, last_name, created_at')
          .in('id', chunk);
        for (const p of refProfiles || []) refereeProfileMap.set(String(p.id), p);
      }
    }

    const bookingsByReferee = new Map();
    const allBookingIds = new Set();
    if (refereeIds.length) {
      for (let i = 0; i < refereeIds.length; i += 100) {
        const chunk = refereeIds.slice(i, i + 100);
        const { data: bookings, error: bErr } = await supabaseAdmin
          .from('bookings')
          .select('id, renter_id, status, commission_thb, price_thb, price_paid, created_at')
          .in('renter_id', chunk)
          .gte('created_at', fromIso)
          .lte('created_at', toIso)
          .order('created_at', { ascending: false });
        if (bErr) throw new Error(bErr.message || 'REPORTING_BOOKINGS_FAILED');
        for (const b of bookings || []) {
          const renterId = String(b.renter_id || '').trim();
          if (!bookingsByReferee.has(renterId)) bookingsByReferee.set(renterId, []);
          bookingsByReferee.get(renterId).push(b);
          allBookingIds.add(String(b.id));
        }
      }
    }

    for (const lr of [...earnedRows, ...clawbackRows]) {
      if (lr.booking_id) allBookingIds.add(String(lr.booking_id));
    }
    const bookingMap = allBookingIds.size ? await fetchBookingsByIds([...allBookingIds]) : new Map();

    const referredUsers = (relations || []).map((rel) => {
      const refereeId = String(rel.referee_id || '').trim();
      const p = refereeProfileMap.get(refereeId);
      const userBookings = (bookingsByReferee.get(refereeId) || []).map((b) => ({
        id: b.id,
        status: b.status,
        commissionThb: round2(Number(b.commission_thb) || 0),
        totalPriceThb: bookingGrossThb(b),
        createdAt: b.created_at,
      }));
      return {
        refereeId,
        name: profileDisplayName(p) || refereeId,
        email: p?.email || null,
        referredAt: rel.referred_at,
        networkDepth: rel.network_depth,
        bookings: userBookings,
        bookingsCount: userBookings.length,
        commissionThb: round2(userBookings.reduce((s, b) => s + b.commissionThb, 0)),
      };
    });

    const ledger = [...earnedRows, ...(heldRows || []), ...clawbackRows]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((row) => ({
        id: row.id,
        bookingId: row.booking_id,
        refereeId: row.referee_id,
        amountThb: round2(Number(row.amount_thb) || 0),
        type: row.type,
        status: row.status,
        referralType: row.referral_type,
        earnedAt: row.earned_at,
        unlockAt: row.unlock_at || null,
        createdAt: row.created_at,
        canceledAt: row.canceled_at,
        bookingCommissionThb: row.booking_id
          ? round2(Number(bookingMap.get(String(row.booking_id))?.commission_thb) || 0)
          : 0,
      }));

    const commissionThb = round2(
      [...new Set(earnedRows.filter((r) => r.booking_id).map((r) => String(r.booking_id)))].reduce(
        (s, bid) => s + (Number(bookingMap.get(bid)?.commission_thb) || 0),
        0,
      ),
    );
    const bonusesThb = round2(
      earnedRows.reduce((s, r) => s + (Number(r.amount_thb) || 0), 0),
    );
    const clawbackThb = round2(
      clawbackRows.reduce((s, r) => s + (Number(r.amount_thb) || 0), 0),
    );
    const summary = {
      referredUsersCount: referredUsers.length,
      bookingsCount: referredUsers.reduce((s, u) => s + u.bookingsCount, 0),
      heldBonusesThb: heldOutstandingThb,
      ...computeMargins({ commissionThb, bonusesThb, clawbackThb }),
      roiIndex: computeRoi(commissionThb, bonusesThb),
    };

    const cohortSeries = this.buildReferrerCohortSeries({
      referrerId: rid,
      earnedRows,
      clawbackRows,
      relations: relations || [],
    });

    // Enrich cohort commission from bookings linked in earned rows per month
    for (const cohort of cohortSeries) {
      const monthEarned = earnedRows.filter((r) => {
        const k = utcMonthKey(r.earned_at || r.created_at);
        return k === cohort.cohortMonth && String(r.referrer_id) === rid;
      });
      const bids = [...new Set(monthEarned.map((r) => String(r.booking_id || '')).filter(Boolean))];
      cohort.commissionThb = round2(
        bids.reduce((s, bid) => s + (Number(bookingMap.get(bid)?.commission_thb) || 0), 0),
      );
      const m = computeMargins(cohort);
      Object.assign(cohort, m);
      cohort.roiIndex = computeRoi(m.commissionThb, m.bonusesThb);
    }

    const funnelBundle = await this.computeReferralFunnelBundle({
      fromIso,
      toIso,
      referrerId: rid,
      earnedRows,
    });
    const personalFunnel = funnelBundle.stages;

    return {
      period: { from: fromIso, to: toIso },
      referrer: {
        id: profile.id,
        name: profileDisplayName(profile),
        email: profile.email,
        referralCode: profile.referral_code,
        createdAt: profile.created_at,
      },
      summary,
      referredUsers,
      ledger,
      cohortSeries,
      funnel: {
        stages: personalFunnel,
        summary: funnelBundle.summary,
        chartDaily: funnelBundle.chartDaily,
      },
    };
  }

  static buildReferrerMonetaryCsv(rows) {
    const header = [
      'referrer_id',
      'referrer_name',
      'referral_code',
      'referred_users',
      'bookings',
      'commission_thb',
      'bonuses_thb',
      'held_bonuses_thb',
      'clawback_thb',
      'gross_margin_thb',
      'net_margin_thb',
      'roi',
      'first_conversion_at',
      'last_conversion_at',
      'clicks',
      'first_booking_cr_pct',
      'repeat_bookings',
    ];
    const lines = [header.join(',')];
    for (const row of rows || []) {
      lines.push(
        [
          row.referrerId,
          row.name,
          row.referralCode,
          row.referredUsersCount,
          row.bookingsCount,
          row.commissionThb,
          row.bonusesThb,
          row.heldBonusesThb ?? 0,
          row.clawbackThb,
          row.grossMarginThb,
          row.netMarginThb,
          row.roiIndex != null ? row.roiIndex : '',
          row.firstConversionAt,
          row.lastConversionAt,
          row.clicksCount ?? '',
          row.firstBookingCrPct != null ? row.firstBookingCrPct : '',
          row.repeatBookingsCount ?? '',
        ]
          .map(escapeCsvCell)
          .join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }

  /** Flat export: referrer × cohort month — for 1C / accounting workflows. */
  static buildReferrerCohortCsv(referrerRows, cohortByReferrerId = new Map()) {
    const header = [
      'referrer_id',
      'referrer_name',
      'cohort_month',
      'referred_users',
      'bookings',
      'commission_thb',
      'bonuses_thb',
      'clawback_thb',
      'gross_margin_thb',
      'net_margin_thb',
      'roi',
    ];
    const lines = [header.join(',')];
    for (const ref of referrerRows || []) {
      const cohorts = cohortByReferrerId.get(ref.referrerId) || [];
      if (!cohorts.length) {
        lines.push(
          [ref.referrerId, ref.name, '', 0, 0, 0, 0, 0, 0, 0, '']
            .map(escapeCsvCell)
            .join(','),
        );
        continue;
      }
      for (const c of cohorts) {
        lines.push(
          [
            ref.referrerId,
            ref.name,
            c.cohortMonth,
            c.referredUsersCount,
            c.bookingsCount,
            c.commissionThb,
            c.bonusesThb,
            c.clawbackThb,
            c.grossMarginThb,
            c.netMarginThb,
            c.roiIndex != null ? c.roiIndex : '',
          ]
            .map(escapeCsvCell)
            .join(','),
        );
      }
    }
    return `${lines.join('\n')}\n`;
  }

  /** Build cohort map for all referrers in export (batch). */
  static async buildCohortMapForReferrers(referrerRows, { fromIso, toIso }) {
    const map = new Map();
    for (const ref of referrerRows || []) {
      const bundle = await this.fetchReferralLedgerBundle({
        fromIso,
        toIso,
        referrerId: ref.referrerId,
      });
      const { data: relations } = await supabaseAdmin
        .from('referral_relations')
        .select('referee_id, referred_at')
        .eq('referrer_id', ref.referrerId);
      let series = this.buildReferrerCohortSeries({
        referrerId: ref.referrerId,
        earnedRows: bundle.earnedRows,
        clawbackRows: bundle.clawbackRows,
        relations: relations || [],
      });
      const bookingIds = [
        ...new Set(
          (bundle.earnedRows || [])
            .map((r) => String(r.booking_id || ''))
            .filter(Boolean),
        ),
      ];
      const bookingMap = bookingIds.length ? await fetchBookingsByIds(bookingIds) : new Map();
      series = series.map((cohort) => {
        const monthEarned = (bundle.earnedRows || []).filter((r) => {
          const k = utcMonthKey(r.earned_at || r.created_at);
          return k === cohort.cohortMonth;
        });
        const bids = [...new Set(monthEarned.map((r) => String(r.booking_id || '')).filter(Boolean))];
        const commissionThb = round2(
          bids.reduce((s, bid) => s + (Number(bookingMap.get(bid)?.commission_thb) || 0), 0),
        );
        const m = computeMargins({ ...cohort, commissionThb });
        return { ...cohort, ...m, roiIndex: computeRoi(m.commissionThb, m.bonusesThb) };
      });
      map.set(ref.referrerId, series);
    }
    return map;
  }
}

export default FinancialReportingService;
