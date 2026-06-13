/**
 * Stage 133 — SSOT team analytics for GET /api/v2/referral/me (ADR-133).
 */
import { listingYmdAtStartOfDayIso } from '@/lib/listing-date';
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone';
import {
  referralStatsCurrentMonthBoundsUtc,
} from '@/lib/referral/referral-stats-month-bounds';
import { currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month';
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter';

const LIFETIME_START = '1970-01-01T00:00:00.000Z';
const LIFETIME_END = '2100-01-01T00:00:00.000Z';

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function normalizeRpcRow(row) {
  if (!row || typeof row !== 'object') {
    return {
      l1DirectThb: 0,
      l2NetworkThb: 0,
      pendingThb: 0,
      heldThb: 0,
      guestBookingThb: 0,
      hostActivationThb: 0,
      lifetimeEarnedOnlyThb: 0,
    };
  }
  return {
    l1DirectThb: round2(row.l1_direct_thb ?? row.l1DirectThb),
    l2NetworkThb: round2(row.l2_network_thb ?? row.l2NetworkThb),
    pendingThb: round2(row.pending_thb ?? row.pendingThb),
    heldThb: round2(row.held_thb ?? row.heldThb),
    guestBookingThb: round2(row.guest_booking_thb ?? row.guestBookingThb),
    hostActivationThb: round2(row.host_activation_thb ?? row.hostActivationThb),
    lifetimeEarnedOnlyThb: round2(row.lifetime_earned_only_thb ?? row.lifetimeEarnedOnlyThb),
  };
}

/**
 * @param {string} statsTz
 * @param {'month' | 'year' | 'lifetime'} kind
 * @returns {{ kind: string, yearMonth: string | null, startIso: string, endExclusiveIso: string }}
 */
export function resolveReferralAnalyticsPeriodBounds(statsTz, kind = 'month') {
  const tz = String(statsTz || 'UTC').trim() || 'UTC';
  const periodKind = kind === 'year' || kind === 'lifetime' ? kind : 'month';

  if (periodKind === 'lifetime') {
    return {
      kind: 'lifetime',
      yearMonth: null,
      startIso: LIFETIME_START,
      endExclusiveIso: LIFETIME_END,
    };
  }

  if (periodKind === 'year') {
    const ymKey = currentYearMonthKeyInTimeZone(tz) || '';
    const yStr = ymKey.slice(0, 4) || String(new Date().getFullYear());
    const y = Number.parseInt(yStr, 10);
    const startIso =
      listingYmdAtStartOfDayIso(`${y}-01-01`, tz) ||
      new Date(Date.UTC(y, 0, 1)).toISOString();
    const endExclusiveIso =
      listingYmdAtStartOfDayIso(`${y + 1}-01-01`, tz) ||
      new Date(Date.UTC(y + 1, 0, 1)).toISOString();
    return { kind: 'year', yearMonth: `${yStr}`, startIso, endExclusiveIso: endExclusiveIso };
  }

  const monthBounds = referralStatsCurrentMonthBoundsUtc(tz);
  return {
    kind: 'month',
    yearMonth: monthBounds.ymKey,
    startIso: monthBounds.monthStartUtcIso,
    endExclusiveIso: monthBounds.monthEndExclusiveUtcIso,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @param {string} startIso
 * @param {string} endExclusiveIso
 */
async function callTeamAnalyticsRpc(supabaseAdmin, referrerId, startIso, endExclusiveIso) {
  const { data, error } = await supabaseAdmin.rpc('referral_team_analytics_for_referrer', {
    p_referrer_id: String(referrerId),
    p_period_start: startIso,
    p_period_end_exclusive: endExclusiveIso,
  });

  if (error) {
    console.warn('[referral_team_analytics_for_referrer]', error.message);
    return normalizeRpcRow(null);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return normalizeRpcRow(row);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
async function computeHostRetention(supabaseAdmin, referrerId) {
  const uid = String(referrerId || '').trim();
  if (!uid) {
    return { ratePercent: 0, numerator: 0, denominator: 0, definition: 'direct_partners_with_completed_host_booking' };
  }

  const { data: relations, error: relErr } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id')
    .eq('referrer_id', uid);

  if (relErr || !relations?.length) {
    return { ratePercent: 0, numerator: 0, denominator: 0, definition: 'direct_partners_with_completed_host_booking' };
  }

  const refereeIds = [...new Set(relations.map((r) => String(r.referee_id || '').trim()).filter(Boolean))];
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .in('id', refereeIds);

  const partnerIds = (profiles || [])
    .filter((p) => String(p?.role || '').toUpperCase() === 'PARTNER')
    .map((p) => String(p.id));

  const denominator = partnerIds.length;
  if (!denominator) {
    return { ratePercent: 0, numerator: 0, denominator: 0, definition: 'direct_partners_with_completed_host_booking' };
  }

  const { data: hostBookings } = await supabaseAdmin
    .from('bookings')
    .select('partner_id')
    .eq('status', 'COMPLETED')
    .in('partner_id', partnerIds);

  const activeHostIds = new Set((hostBookings || []).map((b) => String(b.partner_id)));
  const numerator = partnerIds.filter((id) => activeHostIds.has(id)).length;
  const ratePercent = Math.round((numerator / Math.max(denominator, 1)) * 1000) / 10;

  return {
    ratePercent,
    numerator,
    denominator,
    definition: 'direct_partners_with_completed_host_booking',
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @param {number} [limit]
 */
async function fetchTopContributors(supabaseAdmin, referrerId, limit = 10) {
  const { data, error } = await supabaseAdmin.rpc('referral_team_top_contributors_for_referrer', {
    p_referrer_id: String(referrerId),
    p_limit: Math.min(50, Math.max(1, Math.floor(Number(limit) || 10))),
  });

  if (error || !Array.isArray(data) || !data.length) return [];

  const refereeIds = data.map((r) => String(r.referee_id || '').trim()).filter(Boolean);
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role')
    .in('id', refereeIds);

  const profileById = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]));

  return data.map((row) => {
    const rid = String(row.referee_id || '').trim();
    const p = profileById[rid];
    const earned = round2(row.earned_thb);
    return {
      refereeId: rid,
      displayName: formatPrivacyDisplayNameForParticipant(
        p?.first_name,
        p?.last_name,
        p?.email,
        'Guest',
      ),
      role: String(p?.role || 'RENTER').toUpperCase(),
      earnedForReferrerThb: earned,
      l1ShareThb: earned,
    };
  });
}

/**
 * Shadow L2 for current UTC month when live L2 disabled.
 */
async function fetchShadowL2Notice(supabaseAdmin, referrerId, guestL2Enabled) {
  if (guestL2Enabled === true) {
    return { applicable: false, messageKey: null, shadowMonthlyThb: null };
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('referral_shadow_l2_monthly')
    .select('shadow_l2_thb_sum')
    .eq('l2_referrer_id', String(referrerId))
    .eq('month_utc', monthStart)
    .maybeSingle();

  if (error) {
    return { applicable: true, messageKey: 'stage133_shadowL2Excluded', shadowMonthlyThb: null };
  }

  const sum = round2(data?.shadow_l2_thb_sum);
  if (!sum || sum <= 0) {
    return { applicable: false, messageKey: null, shadowMonthlyThb: null };
  }

  return {
    applicable: true,
    messageKey: 'stage133_shadowL2Excluded',
    shadowMonthlyThb: sum,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {object} profile
 * @param {{
 *   analyticsPeriod?: 'month' | 'year' | 'lifetime',
 *   ambassador?: object,
 *   friendsInvited?: number,
 *   directPartnersInvited?: number,
 *   guestL2Enabled?: boolean,
 * }} [opts]
 */
export async function buildReferralTeamAnalytics(supabaseAdmin, profile, opts = {}) {
  const referrerId = String(profile?.id || '').trim();
  const empty = {
    period: {
      kind: 'month',
      yearMonth: null,
      ianaTimezone: 'UTC',
      computedAt: new Date().toISOString(),
    },
    earnings: {
      ledgerBaseCurrency: 'THB',
      totalTeamEarningsThb: 0,
      lifetimeTeamEarningsThb: 0,
      breakdown: {
        l1DirectThb: 0,
        l2NetworkThb: 0,
        byReferralType: { guest_booking: 0, host_activation: 0 },
      },
      pendingThb: 0,
      heldThb: 0,
    },
    network: {
      directInvitesTotal: 0,
      directPartnersTotal: 0,
      retention: {
        ratePercent: 0,
        numerator: 0,
        denominator: 0,
        definition: 'direct_partners_with_completed_host_booking',
      },
    },
    progress: {
      currentTierId: null,
      nextTierId: null,
      directPartnersInvited: 0,
      remainingToNextTier: 0,
      tierProgressPercent: 0,
    },
    topContributors: [],
    shadowL2Notice: { applicable: false, messageKey: null, shadowMonthlyThb: null },
    /** Internal — for stats/gamification dedupe */
    _monthRpc: null,
    _lifetimeRpc: null,
  };

  if (!supabaseAdmin || !referrerId) return empty;

  const statsTz = resolveReferralStatsTimeZone(profile);
  const periodKind = opts.analyticsPeriod === 'year' || opts.analyticsPeriod === 'lifetime'
    ? opts.analyticsPeriod
    : 'month';
  const periodBounds = resolveReferralAnalyticsPeriodBounds(statsTz, periodKind);

  const monthBounds = resolveReferralAnalyticsPeriodBounds(statsTz, 'month');
  const yearBounds = resolveReferralAnalyticsPeriodBounds(statsTz, 'year');

  const [periodRpc, monthRpc, yearRpc, lifetimeRpc, retention, topContributors, shadowL2Notice] =
    await Promise.all([
      callTeamAnalyticsRpc(supabaseAdmin, referrerId, periodBounds.startIso, periodBounds.endExclusiveIso),
      callTeamAnalyticsRpc(supabaseAdmin, referrerId, monthBounds.startIso, monthBounds.endExclusiveIso),
      callTeamAnalyticsRpc(supabaseAdmin, referrerId, yearBounds.startIso, yearBounds.endExclusiveIso),
      callTeamAnalyticsRpc(supabaseAdmin, referrerId, LIFETIME_START, LIFETIME_END),
      computeHostRetention(supabaseAdmin, referrerId),
      fetchTopContributors(supabaseAdmin, referrerId, 10),
      fetchShadowL2Notice(supabaseAdmin, referrerId, opts.guestL2Enabled),
    ]);

  const ambassador = opts.ambassador || {};
  const friendsInvited = Math.max(0, Number(opts.friendsInvited) || 0);
  const directPartnersInvited = Math.max(
    0,
    Number(opts.directPartnersInvited ?? ambassador.directPartnersInvited) || 0,
  );

  const totalPeriod = round2(periodRpc.l1DirectThb + periodRpc.l2NetworkThb);
  const lifetimeTotal = round2(lifetimeRpc.l1DirectThb + lifetimeRpc.l2NetworkThb);

  return {
    period: {
      kind: periodBounds.kind,
      yearMonth: periodBounds.yearMonth,
      ianaTimezone: statsTz,
      computedAt: new Date().toISOString(),
    },
    earnings: {
      ledgerBaseCurrency: 'THB',
      totalTeamEarningsThb: totalPeriod,
      lifetimeTeamEarningsThb: lifetimeTotal,
      breakdown: {
        l1DirectThb: periodRpc.l1DirectThb,
        l2NetworkThb: periodRpc.l2NetworkThb,
        byReferralType: {
          guest_booking: periodRpc.guestBookingThb,
          host_activation: periodRpc.hostActivationThb,
        },
      },
      pendingThb: periodRpc.pendingThb,
      heldThb: periodRpc.heldThb,
    },
    network: {
      directInvitesTotal: friendsInvited,
      directPartnersTotal: directPartnersInvited,
      retention,
    },
    progress: {
      currentTierId: ambassador.currentTier?.id ?? null,
      nextTierId: ambassador.nextTier?.id ?? null,
      directPartnersInvited,
      remainingToNextTier: Number(ambassador.remainingToNextTier) || 0,
      tierProgressPercent: Number(ambassador.tierProgressPercent) || 0,
    },
    topContributors,
    shadowL2Notice,
    _monthRpc: monthRpc,
    _yearRpc: yearRpc,
    _lifetimeRpc: lifetimeRpc,
  };
}

export default { buildReferralTeamAnalytics, resolveReferralAnalyticsPeriodBounds };
