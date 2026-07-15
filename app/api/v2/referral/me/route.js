import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { buildReferralTeamMembers } from '@/lib/referral/build-referral-team';
import { buildReferralTeamAnalytics, resolveReferralAnalyticsPeriodBounds } from '@/lib/referral/build-referral-team-analytics';
import { yearMonthKeyInTimeZone, currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month';
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone';
import { buildReferralEarningsSparklineThb } from '@/lib/referral/sparkline-earnings';
import { getSiteDisplayName, getPublicSiteUrl } from '@/lib/site-url';
import { ambassadorLandingShortLabel, buildAmbassadorLandingUrl, buildVanityGoUrl } from '@/lib/referral/public-landing-url';
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter';
import { buildReferralGamificationForUser } from '@/lib/referral/build-referral-gamification-for-user';
import {
  badgeLabelForLang,
  buildStoriesCopy,
  normalizeStoriesLang,
} from '@/lib/referral/referral-stories-copy';
import { normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency';
import { AuthErrorCode, authErrorJson } from '@/lib/auth/auth-error-codes';
import { getUserHeldReferralSummary } from '@/lib/services/marketing/referral-hold.service.js';
import { resolveDirectReferrerForUser } from '@/lib/referral/resolve-direct-referrer';
import { buildReferralSharePitchFx } from '@/lib/finance/referral-share-pitch-fx.js';
import { formatAmbassadorAmountFromThb } from '@/lib/pricing/ambassador-display-amount.js';
import { getMidMarketDisplayRateMap } from '@/lib/pricing/fx-display.js';

export const dynamic = 'force-dynamic';

function formatReferralCodeForUser(userId) {
  const clean = String(userId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  const suffix = clean || Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AIR-${suffix}`;
}

async function getOrCreateReferralCode(userId, fallbackLegacyCode = null, ownerIp = '') {
  const { data: existing } = await supabaseAdmin
    .from('referral_codes')
    .select('id,code,metadata')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.code) return existing.code;

  const candidate = String(fallbackLegacyCode || '').trim().toUpperCase() || formatReferralCodeForUser(userId);
  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    code: candidate,
    is_active: true,
    metadata: {
      owner_ip: ownerIp || null,
      source: 'api_v2_referral_me',
    },
  };
  const { error: createError } = await supabaseAdmin.from('referral_codes').insert(row);
  if (createError) {
    // If collision happened, fallback to random suffix.
    const fallback = `${formatReferralCodeForUser(userId)}-${Math.floor(100 + Math.random() * 900)}`;
    const { error: fallbackError } = await supabaseAdmin.from('referral_codes').insert({
      ...row,
      id: crypto.randomUUID(),
      code: fallback,
    });
    if (fallbackError) throw new Error(fallbackError.message || 'REFERRAL_CODE_CREATE_FAILED');
    return fallback;
  }
  return candidate;
}

export async function GET(request) {
  const session = await getSessionPayload();
  if (!session?.userId) {
    return authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED, 401);
  }

  let { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(
      'id,referral_code,referral_tier_id,referral_tier_name,referral_tier_payout_ratio,iana_timezone,referral_monthly_goal_thb,referral_display_currency,first_name,last_name,email,created_at,language,preferred_language',
    )
    .eq('id', session.userId)
    .maybeSingle();
  if (profileError && /referral_tier_/i.test(String(profileError?.message || ''))) {
    const fallback = await supabaseAdmin
      .from('profiles')
      .select(
        'id,referral_code,iana_timezone,referral_monthly_goal_thb,referral_display_currency,first_name,last_name,email,created_at,language,preferred_language',
      )
      .eq('id', session.userId)
      .maybeSingle();
    profile = fallback.data;
    profileError = fallback.error;
  }
  if (profileError && /referral_display_currency/i.test(String(profileError?.message || ''))) {
    const fb2 = await supabaseAdmin
      .from('profiles')
      .select(
        'id,referral_code,referral_tier_id,referral_tier_name,referral_tier_payout_ratio,iana_timezone,referral_monthly_goal_thb,first_name,last_name,email,created_at,language,preferred_language',
      )
      .eq('id', session.userId)
      .maybeSingle();
    profile = fb2.data ? { ...fb2.data, referral_display_currency: 'THB' } : profile;
    profileError = fb2.error;
  }
  if (profileError || !profile?.id) {
    return authErrorJson(AuthErrorCode.AUTH_PROFILE_NOT_FOUND, 404);
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ownerIp = String(forwarded || realIp || '')
    .split(',')[0]
    .trim();
  const code = await getOrCreateReferralCode(profile.id, profile.referral_code, ownerIp);

  const { data: vanityRow } = await supabaseAdmin
    .from('referral_codes')
    .select('custom_vanity_code')
    .eq('user_id', profile.id)
    .maybeSingle();
  const vanityCode =
    vanityRow?.custom_vanity_code != null && String(vanityRow.custom_vanity_code).trim()
      ? String(vanityRow.custom_vanity_code).trim().toLowerCase()
      : null;
  const vanityUrl = vanityCode ? buildVanityGoUrl(vanityCode) : null;

  const { searchParams } = new URL(request.url)
  const includeTeam = searchParams.get('includeTeam') !== '0'
  const includeTeamAnalytics = searchParams.get('includeTeamAnalytics') !== '0'
  const analyticsPeriodRaw = String(searchParams.get('analyticsPeriod') || 'month').toLowerCase()
  const analyticsPeriod =
    analyticsPeriodRaw === 'year' || analyticsPeriodRaw === 'lifetime' ? analyticsPeriodRaw : 'month'
  const teamLimit = Math.min(200, Math.max(1, Number(searchParams.get('teamLimit')) || 80))
  const teamOffset = Math.max(0, Number(searchParams.get('teamOffset')) || 0)

  const [
    { count: invitedCount },
    { data: myInviteEdge },
    tiers,
    directPartnersInvited,
    teamMembers,
  ] = await Promise.all([
    supabaseAdmin
      .from('referral_relations')
      .select('id', { head: true, count: 'exact' })
      .eq('referrer_id', profile.id),
    supabaseAdmin
      .from('referral_relations')
      .select('network_depth,ancestor_path,referrer_id')
      .eq('referee_id', profile.id)
      .maybeSingle(),
    ReferralPnlService.getReferralTiers(),
    ReferralPnlService.countDirectPartnersInvited(profile.id),
    includeTeam
      ? buildReferralTeamMembers(supabaseAdmin, profile.id, { limit: teamLimit, offset: teamOffset })
      : Promise.resolve([]),
  ]);
  const general = await PricingService.getGeneralPricingSettings();
  const fintechCfgEarly = await SystemConfigService.getFintechConfig();

  const heldSummary = await getUserHeldReferralSummary(profile.id);
  const heldThb = Number(heldSummary.heldReferralBalanceThb) || 0;
  const nearestUnlockAt = heldSummary.nearestUnlockAt || null;
  const referralHoldDays = Math.max(
    0,
    Math.floor(
      Number(general?.referral_hold_days ?? general?.referralHoldDays ?? 14) || 14,
    ),
  );

  const statsTz = resolveReferralStatsTimeZone(profile);
  const currentYm = currentYearMonthKeyInTimeZone(statsTz);
  const calendarYearPrefix = `${currentYm.slice(0, 4)}-`;

  let monthlyEarnedThb = 0;
  /** Stage 133 — L1/L2 «от меня» (ADR-133), не ledger_depth. */
  let monthlyL1EarnedThb = 0;
  let monthlyNetworkEarnedThb = 0;
  let yearlyEarnedThb = 0;
  let pendingThb = 0;
  let earnedThb = 0;
  let sparklineEarningsThb = [];
  let sparkMonthlyYtdThb = [];
  let teamAnalytics = null;

  const friendsInvitedEarly = Number(invitedCount || 0);
  const directPartnersCountEarly = Number(directPartnersInvited || 0);
  const tierStateEarly = ReferralPnlService.resolveTierForPartnerCount(tiers, directPartnersCountEarly);
  const currentTierEarly = tierStateEarly.currentTier;
  const nextTierEarly = tierStateEarly.nextTier;
  const remainingToNextTierEarly = Math.max(
    0,
    Number(nextTierEarly?.minPartnersInvited || 0) - Number(directPartnersCountEarly || 0),
  );
  const currentTierFloorEarly = Number(currentTierEarly?.minPartnersInvited || 0);
  const tierSpanEarly = Math.max(
    1,
    Number(nextTierEarly?.minPartnersInvited || currentTierFloorEarly + 1) - currentTierFloorEarly,
  );
  const tierProgressPercentEarly = Math.min(
    100,
    Math.max(
      0,
      Math.round(((directPartnersCountEarly - currentTierFloorEarly) / tierSpanEarly) * 100),
    ),
  );

  if (supabaseAdmin && includeTeamAnalytics) {
    const analyticsRaw = await buildReferralTeamAnalytics(supabaseAdmin, profile, {
      analyticsPeriod,
      friendsInvited: friendsInvitedEarly,
      directPartnersInvited: directPartnersCountEarly,
      guestL2Enabled: fintechCfgEarly?.ambassadorGuestL2Enabled === true,
      ambassador: {
        currentTier: {
          id: profile?.referral_tier_id || currentTierEarly?.id || null,
          name: profile?.referral_tier_name || currentTierEarly?.name || 'Beginner',
        },
        nextTier: nextTierEarly,
        directPartnersInvited: directPartnersCountEarly,
        remainingToNextTier: remainingToNextTierEarly,
        tierProgressPercent: tierProgressPercentEarly,
      },
    });
    const { _monthRpc, _yearRpc, _lifetimeRpc, ...publicAnalytics } = analyticsRaw;
    teamAnalytics = publicAnalytics;

    if (_monthRpc) {
      monthlyL1EarnedThb = _monthRpc.l1DirectThb;
      monthlyNetworkEarnedThb = _monthRpc.l2NetworkThb;
      monthlyEarnedThb = Math.round((monthlyL1EarnedThb + monthlyNetworkEarnedThb) * 100) / 100;
      pendingThb = _monthRpc.pendingThb;
    }
    if (_yearRpc) {
      yearlyEarnedThb = Math.round((_yearRpc.l1DirectThb + _yearRpc.l2NetworkThb) * 100) / 100;
    }
    if (_lifetimeRpc) {
      earnedThb = _lifetimeRpc.lifetimeEarnedOnlyThb;
      if (!pendingThb) pendingThb = _lifetimeRpc.pendingThb;
    }
  }

  if (supabaseAdmin) {
    const sparkFromIso = new Date(Date.now() - 20 * 86400000).toISOString();
    const { data: earnedRows } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, earned_at, updated_at')
      .eq('referrer_id', profile.id)
      .eq('status', 'earned')
      .gte('earned_at', sparkFromIso);

    if (!includeTeamAnalytics || !teamAnalytics) {
      const monthBounds = resolveReferralAnalyticsPeriodBounds(statsTz, 'month');
      const yearBounds = resolveReferralAnalyticsPeriodBounds(statsTz, 'year');
      const [{ data: monthRpcRows }, { data: yearRpcRows }, { data: lifeRpcRows }] = await Promise.all([
        supabaseAdmin.rpc('referral_team_analytics_for_referrer', {
          p_referrer_id: profile.id,
          p_period_start: monthBounds.startIso,
          p_period_end_exclusive: monthBounds.endExclusiveIso,
        }),
        supabaseAdmin.rpc('referral_team_analytics_for_referrer', {
          p_referrer_id: profile.id,
          p_period_start: yearBounds.startIso,
          p_period_end_exclusive: yearBounds.endExclusiveIso,
        }),
        supabaseAdmin.rpc('referral_team_analytics_for_referrer', {
          p_referrer_id: profile.id,
          p_period_start: '1970-01-01T00:00:00.000Z',
          p_period_end_exclusive: '2100-01-01T00:00:00.000Z',
        }),
      ]);
      const mRow = Array.isArray(monthRpcRows) ? monthRpcRows[0] : monthRpcRows;
      const yRow = Array.isArray(yearRpcRows) ? yearRpcRows[0] : yearRpcRows;
      const lRow = Array.isArray(lifeRpcRows) ? lifeRpcRows[0] : lifeRpcRows;
      monthlyL1EarnedThb = Math.round(Number(mRow?.l1_direct_thb || 0) * 100) / 100;
      monthlyNetworkEarnedThb = Math.round(Number(mRow?.l2_network_thb || 0) * 100) / 100;
      monthlyEarnedThb = Math.round((monthlyL1EarnedThb + monthlyNetworkEarnedThb) * 100) / 100;
      yearlyEarnedThb =
        Math.round((Number(yRow?.l1_direct_thb || 0) + Number(yRow?.l2_network_thb || 0)) * 100) / 100;
      pendingThb = Math.round(Number(lRow?.pending_thb || 0) * 100) / 100;
      earnedThb = Math.round(Number(lRow?.lifetime_earned_only_thb || 0) * 100) / 100;
    }

    const monthlyBuckets = {};
    for (const row of earnedRows || []) {
      const iso = row?.earned_at || row?.updated_at;
      if (!iso) continue;
      const amt = Number(row?.amount_thb) || 0;
      const ymKey = yearMonthKeyInTimeZone(iso, statsTz);
      if (!ymKey) continue;
      if (ymKey.startsWith(calendarYearPrefix)) {
        monthlyBuckets[ymKey] = (monthlyBuckets[ymKey] || 0) + amt;
      }
    }

    const monthNow = Number.parseInt(currentYm.slice(5, 7), 10);
    const yStr = currentYm.slice(0, 4);
    for (let m = 1; m <= monthNow; m += 1) {
      const key = `${yStr}-${String(m).padStart(2, '0')}`;
      sparkMonthlyYtdThb.push(Math.round((monthlyBuckets[key] || 0) * 100) / 100);
    }

    sparklineEarningsThb = buildReferralEarningsSparklineThb(earnedRows || [], statsTz, 14);
  }

  const profileGoalRaw = profile?.referral_monthly_goal_thb;
  let profileGoalNum = null;
  if (profileGoalRaw != null && profileGoalRaw !== '') {
    const n = Number(profileGoalRaw);
    if (Number.isFinite(n) && n > 0) profileGoalNum = Math.round(n * 100) / 100;
  }
  const generalGoalRaw = Number(
    general?.referralMonthlyGoalThb ?? general?.referral_monthly_goal_thb ?? 10000,
  );
  const monthlyGoalThb =
    profileGoalNum != null
      ? profileGoalNum
      : Number.isFinite(generalGoalRaw) && generalGoalRaw > 0
        ? Math.round(generalGoalRaw * 100) / 100
        : 10000;
  const monthlyGoalProgressPercent = Math.min(
    100,
    Math.round((monthlyEarnedThb / Math.max(monthlyGoalThb, 1)) * 1000) / 10,
  );

  const baseUrl = getPublicSiteUrl();
  const referralLink = `${String(baseUrl).replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;
  /** Короткая визитка `/u/[id]` — QR/PDF/Stories (Stage 74.3). */
  const referralLandingUrl = buildAmbassadorLandingUrl(profile.id);
  const referralLandingShortDisplay = ambassadorLandingShortLabel(profile.id);
  const friendsInvited = friendsInvitedEarly;
  const directPartnersCount = directPartnersCountEarly;
  const tierState = tierStateEarly;
  const currentTier = currentTierEarly;
  const nextTier = nextTierEarly;
  const remainingToNextTier = remainingToNextTierEarly;
  const tierProgressPercent = tierProgressPercentEarly;
  const referralDisplayCurrency = normalizeReferralDisplayCurrency(profile?.referral_display_currency);

  const payoutRatioFromTier = Number(
    profile?.referral_tier_payout_ratio ?? currentTier?.payoutRatio ?? 0,
  );
  const brandName = getSiteDisplayName();
  const marketingDisplayName = formatPrivacyDisplayNameForParticipant(
    profile?.first_name,
    profile?.last_name,
    profile?.email,
    'Ambassador',
  );
  const tiersAsc = Array.isArray(tiers)
    ? [...tiers].sort((a, b) => Number(a?.minPartnersInvited || 0) - Number(b?.minPartnersInvited || 0))
    : [];
  const topTier = tiersAsc.length ? tiersAsc[tiersAsc.length - 1] : null;
  const currentTierForBadge = profile?.referral_tier_id || currentTier?.id;
  const ambassadorBadge =
    topTier?.id && currentTierForBadge && String(topTier.id) === String(currentTierForBadge)
      ? 'gold'
      : 'silver';
  const shareMessage = `Travel and earn with ${brandName}! Your bonus link: ${referralLink}`;
  const referralSplitRatioRaw = Number(
    general?.referral_split_ratio ?? general?.referralSplitRatio ?? 0.5,
  );
  const referralSplitRatio = Number.isFinite(referralSplitRatioRaw)
    ? Math.min(1, Math.max(0, referralSplitRatioRaw))
    : 0.5;
  const promoTurboModeEnabled =
    general?.promo_turbo_mode_enabled === true || general?.promoTurboModeEnabled === true;
  const promoBoostPerBookingRaw = Number(
    general?.promo_boost_per_booking ?? general?.promoBoostPerBooking ?? 0,
  );
  const promoBoostPerBookingThb =
    Number.isFinite(promoBoostPerBookingRaw) && promoBoostPerBookingRaw > 0
      ? Math.round(promoBoostPerBookingRaw * 100) / 100
      : 0;
  const oldReferrerBonusWithBoostThb = 0;
  const newReferrerBonusWithBoostThb = Math.round(promoBoostPerBookingThb * referralSplitRatio * 100) / 100;

  const langNormStories = normalizeStoriesLang(profile?.preferred_language || profile?.language);
  let midRateMapForStories = { THB: 1 };
  try {
    midRateMapForStories = await getMidMarketDisplayRateMap();
  } catch {
    /* fallback */
  }
  const storiesTeamAmountLine = formatAmbassadorAmountFromThb(
    monthlyNetworkEarnedThb,
    referralDisplayCurrency,
    midRateMapForStories,
    langNormStories,
  );

  let referralGamification = {
    badgesEarned: [],
    primaryBadge: null,
    leaderboardRankMonthly: null,
    fastStartEligible: false,
    badgeSnapshot: null,
  };
  let referralStoriesCopy = buildStoriesCopy(langNormStories, {
    brandName,
    tierName: String(profile?.referral_tier_name || currentTier?.name || ''),
    badgeLabel: '',
    teamAmountLine: storiesTeamAmountLine,
  });

  if (supabaseAdmin) {
    const gam = await buildReferralGamificationForUser(supabaseAdmin, profile, {
      monthlyNetworkEarnedThb,
      friendsInvited,
      totalLifetimeEarnedThb: earnedThb,
      directPartnersInvited: directPartnersCount,
    });
    const langNorm = normalizeStoriesLang(profile?.preferred_language || profile?.language);
    const primaryLabel = gam.primaryBadge ? badgeLabelForLang(gam.primaryBadge, langNorm) : '';
    referralGamification = {
      badgesEarned: gam.badgesEarned,
      primaryBadge: gam.primaryBadge,
      leaderboardRankMonthly: gam.leaderboardRankMonthly,
      fastStartEligible: gam.fastStartEligible,
      badgeSnapshot: gam.badgeSnapshot,
    };
    referralStoriesCopy = buildStoriesCopy(langNorm, {
      brandName,
      tierName: String(profile?.referral_tier_name || currentTier?.name || ''),
      badgeLabel: primaryLabel,
      teamAmountLine: storiesTeamAmountLine,
    });
  }

  /** Последнее событие «партнёр присоединился» — для toast без эвристики по счётчику (Stage 74.4). */
  let referralLastTeammateJoinEventId = null;
  if (supabaseAdmin) {
    const { data: lastJoinEv } = await supabaseAdmin
      .from('referral_team_events')
      .select('id')
      .eq('referrer_id', profile.id)
      .eq('event_type', 'teammate_joined')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastJoinEv?.id) referralLastTeammateJoinEventId = String(lastJoinEv.id);
  }

  const welcomeBonusFromGeneral =
    Math.round(
      Math.min(
        1_000_000,
        Math.max(0, Number(general?.welcome_bonus_amount ?? general?.welcomeBonusAmount ?? 500)),
      ) * 100,
    ) / 100;
  const fintechCfg = fintechCfgEarly;
  const referralReinvestmentPercentForEstimator = Math.min(
    95,
    Math.max(0, Number(fintechCfg?.referralReinvestmentPercent ?? 45)),
  );
  const ambassadorGuestPoolL1Percent = Math.min(
    100,
    Math.max(0, Number(fintechCfg?.ambassadorGuestPoolL1Percent ?? 45)),
  );

  const { directReferrerId, referredBy } = await resolveDirectReferrerForUser(profile.id);

  const { welcomeBonusRub, midRateRubToThb } = await buildReferralSharePitchFx(welcomeBonusFromGeneral);

  return NextResponse.json({
    success: true,
    data: {
      code,
      referralLink,
      referralLandingUrl,
      vanityCode,
      vanityUrl,
      referralLandingShortDisplay,
      shareMessage,
      brandName,
      referralLastTeammateJoinEventId,
      marketingCard: {
        displayName: marketingDisplayName,
        ambassadorBadge,
      },
      ambassador: {
        currentTier: {
          id: profile?.referral_tier_id || currentTier?.id || null,
          name: profile?.referral_tier_name || currentTier?.name || 'Beginner',
          payoutRatio: Math.round((Number.isFinite(payoutRatioFromTier) ? payoutRatioFromTier : 60) * 100) / 100,
          minPartnersInvited: Number(currentTier?.minPartnersInvited || 0),
        },
        nextTier: nextTier
          ? {
              id: nextTier.id,
              name: nextTier.name,
              payoutRatio: nextTier.payoutRatio,
              minPartnersInvited: nextTier.minPartnersInvited,
            }
          : null,
        tiers,
        directPartnersInvited: directPartnersCount,
        remainingToNextTier,
        tierProgressPercent,
        payoutTooltip: `Your tier allows up to ${Math.round(
          Number.isFinite(payoutRatioFromTier) ? payoutRatioFromTier : 60,
        )}% of credited bonuses toward card payout (when eligible).`,
        targetInvites: Number(nextTier?.minPartnersInvited || 10),
        /** Активированные партнёры (SSOT с tier и Stories unlock). */
        currentInvites: directPartnersCount,
      },
      turbo: {
        enabled: promoTurboModeEnabled,
        promoBoostPerBookingThb,
        referralSplitRatio,
        oldReferrerBonusWithBoostThb,
        newReferrerBonusWithBoostThb,
      },
      stats: {
        /** Ledger / бухгалтерия — всегда THB (SSOT сумм начислений). */
        ledgerBaseCurrency: 'THB',
        /** Выбранная валюта отображения в кабинете амбаcсадора. */
        referralDisplayCurrency,
        pendingThb: Math.round(pendingThb * 100) / 100,
        earnedThb: Math.round(earnedThb * 100) / 100,
        heldReferralBalanceThb: Math.round(heldThb * 100) / 100,
        nearestUnlockAt,
        heldRowCount: heldSummary.heldRowCount || 0,
        referralHoldDays,
        friendsInvited,
        /** Партнёры с активацией (та же метрика, что tier / Stories unlock). */
        directPartnersInvited: directPartnersCount,
        /** referral_ledger earned в текущем календарном месяце (границы месяца в TZ профиля → fallback UTC). */
        monthlyEarnedThb,
        /** referral_ledger earned с 1 янв. текущего года по календарю TZ статистики */
        yearlyEarnedThb,
        monthlyGoalThb,
        monthlyGoalProgressPercent,
        /** Последние 14 дней, суммы по дням в TZ статистики */
        sparklineEarningsThb,
        /** Янв. … текущий месяц: суммы earned по месяцам (TZ статистики), для sparkline тренда года */
        sparkMonthlyYtdThb,
        /** Ожидаемый доход = сумма pending по реферальному ledger (как stats.pendingThb) */
        expectedPendingThb: Math.round(pendingThb * 100) / 100,
        /** Stage 133 — прямые приглашённые (L1 direct), ADR-133. */
        monthlyL1EarnedThb,
        /** Stage 133 — сеть (L2+ от меня), ADR-133. */
        monthlyNetworkEarnedThb,
      },
      /** Stage 133 — team analytics (tab «Команда»). */
      teamAnalytics,
      referralReport: {
        /** Значение из профиля (может быть пустым — клиент трактует как UTC). */
        ianaTimezone: String(profile?.iana_timezone || '').trim(),
        statsCalendarIana: statsTz,
        referralMonthlyGoalThbProfile: profileGoalNum,
      },
      /** Stage 74.2 — earned-бейджи + snapshot для UI/Stories. */
      referralGamification,
      /** Тексты Stories PNG по языку профиля (RU/EN/ZH/TH). */
      referralStoriesCopy,
      inviteNetwork: myInviteEdge
        ? {
            depth: Number(myInviteEdge.network_depth || 1),
            directReferrerId: directReferrerId || myInviteEdge.referrer_id || null,
            ancestorChainLength: Array.isArray(myInviteEdge.ancestor_path)
              ? myInviteEdge.ancestor_path.length
              : 0,
            referredBy,
          }
        : referredBy
          ? {
              depth: 1,
              directReferrerId,
              ancestorChainLength: 0,
              referredBy,
            }
          : null,
      /** Stage 132.2 — RUB teaser for RU share pitches (@ mid, 0% spread). */
      sharePitchFx: {
        welcomeBonusRub,
        midRateRubToThb,
      },
      /** Stage 72.6 / 114.5 — прямые приглашённые (пагинация: teamLimit, teamOffset, includeTeam=0) */
      teamMembers,
      teamPaging: includeTeam
        ? { limit: teamLimit, offset: teamOffset, hasMore: (teamMembers || []).length >= teamLimit }
        : { limit: 0, offset: 0, hasMore: false },
      /** Stage 91.3 — параметры для индикативного калькулятора (клиент: `estimateReferrerIllustrationThb`). */
      referralEstimator: {
        welcomeBonusThb: welcomeBonusFromGeneral,
        referralReinvestmentPercent: referralReinvestmentPercentForEstimator,
        referralSplitRatio: ambassadorGuestPoolL1Percent / 100,
        ambassadorGuestPoolL1Percent,
        ambassadorGuestPoolL2Percent: Number(fintechCfg?.ambassadorGuestPoolL2Percent ?? 12),
        ambassadorGuestPoolRefereePercent: Number(fintechCfg?.ambassadorGuestPoolRefereePercent ?? 43),
      },
    },
  });
}

