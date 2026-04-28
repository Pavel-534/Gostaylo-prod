import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';
import { buildReferralTeamMembers } from '@/lib/referral/build-referral-team';
import { yearMonthKeyInTimeZone, currentYearMonthKeyInTimeZone } from '@/lib/referral/tz-year-month';
import { resolveReferralStatsTimeZone } from '@/lib/referral/resolve-referral-stats-timezone';
import { buildReferralEarningsSparklineThb } from '@/lib/referral/sparkline-earnings';
import { getSiteDisplayName } from '@/lib/site-url';
import { ambassadorLandingShortLabel, buildAmbassadorLandingUrl } from '@/lib/referral/public-landing-url';
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter';
import { referralStatsCurrentMonthBoundsUtc } from '@/lib/referral/referral-stats-month-bounds';
import { aggregateReferralLeaderboardFromDb } from '@/lib/referral/referral-leaderboard-db';
import { computeReferralBadgeResult } from '@/lib/referral/referral-badges';
import {
  badgeLabelForLang,
  buildStoriesCopy,
  normalizeStoriesLang,
} from '@/lib/referral/referral-stories-copy';

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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(
      'id,referral_code,referral_tier_id,referral_tier_name,referral_tier_payout_ratio,iana_timezone,referral_monthly_goal_thb,first_name,last_name,email,created_at,language,preferred_language,metadata',
    )
    .eq('id', session.userId)
    .maybeSingle();
  if (profileError && /referral_tier_/i.test(String(profileError?.message || ''))) {
    const fallback = await supabaseAdmin
      .from('profiles')
      .select(
        'id,referral_code,iana_timezone,referral_monthly_goal_thb,first_name,last_name,email,created_at,language,preferred_language,metadata',
      )
      .eq('id', session.userId)
      .maybeSingle();
    profile = fallback.data;
    profileError = fallback.error;
  }
  if (profileError || !profile?.id) {
    return NextResponse.json(
      { success: false, error: profileError?.message || 'PROFILE_NOT_FOUND' },
      { status: 404 },
    );
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ownerIp = String(forwarded || realIp || '')
    .split(',')[0]
    .trim();
  const code = await getOrCreateReferralCode(profile.id, profile.referral_code, ownerIp);

  const [
    { data: ledger },
    { count: invitedCount },
    { data: myInviteEdge },
    tiers,
    directPartnersInvited,
    teamMembers,
  ] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('status,amount_thb,referee_id')
      .eq('referrer_id', profile.id),
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
    buildReferralTeamMembers(supabaseAdmin, profile.id),
  ]);
  const general = await PricingService.getGeneralPricingSettings();

  let pendingThb = 0;
  let earnedThb = 0;
  for (const row of ledger || []) {
    const amount = Number(row?.amount_thb) || 0;
    const status = String(row?.status || '').toLowerCase();
    if (status === 'pending') pendingThb += amount;
    if (status === 'earned') earnedThb += amount;
  }

  const statsTz = resolveReferralStatsTimeZone(profile);
  const currentYm = currentYearMonthKeyInTimeZone(statsTz);
  const calendarYearPrefix = `${currentYm.slice(0, 4)}-`;

  /** Доход за календарный месяц и год в TZ статистики реферера (по earned_at / updated_at). */
  let monthlyEarnedThb = 0;
  /** Earned в текущем месяце по ledger_depth: 1 = прямые (L1), ≥2 = сеть (L2+). */
  let monthlyL1EarnedThb = 0;
  let monthlyNetworkEarnedThb = 0;
  let yearlyEarnedThb = 0;
  let sparklineEarningsThb = [];
  let sparkMonthlyYtdThb = [];
  if (supabaseAdmin) {
    const sparkFromIso = new Date(Date.now() - 20 * 86400000).toISOString();
    const { data: earnedRows } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, earned_at, updated_at, ledger_depth')
      .eq('referrer_id', profile.id)
      .eq('status', 'earned');

    const monthlyBuckets = {};
    for (const row of earnedRows || []) {
      const iso = row?.earned_at || row?.updated_at;
      if (!iso) continue;
      const amt = Number(row?.amount_thb) || 0;
      const depth = Math.min(32, Math.max(1, Math.floor(Number(row?.ledger_depth) || 1)));
      const ymKey = yearMonthKeyInTimeZone(iso, statsTz);
      if (!ymKey) continue;
      if (ymKey === currentYm) {
        monthlyEarnedThb += amt;
        if (depth <= 1) monthlyL1EarnedThb += amt;
        else monthlyNetworkEarnedThb += amt;
      }
      if (ymKey.startsWith(calendarYearPrefix)) {
        yearlyEarnedThb += amt;
        monthlyBuckets[ymKey] = (monthlyBuckets[ymKey] || 0) + amt;
      }
    }
    monthlyEarnedThb = Math.round(monthlyEarnedThb * 100) / 100;
    monthlyL1EarnedThb = Math.round(monthlyL1EarnedThb * 100) / 100;
    monthlyNetworkEarnedThb = Math.round(monthlyNetworkEarnedThb * 100) / 100;
    yearlyEarnedThb = Math.round(yearlyEarnedThb * 100) / 100;

    const monthNow = Number.parseInt(currentYm.slice(5, 7), 10);
    const yStr = currentYm.slice(0, 4);
    for (let m = 1; m <= monthNow; m += 1) {
      const key = `${yStr}-${String(m).padStart(2, '0')}`;
      sparkMonthlyYtdThb.push(Math.round((monthlyBuckets[key] || 0) * 100) / 100);
    }

    const forSpark = (earnedRows || []).filter((row) => {
      const iso = row?.earned_at || row?.updated_at;
      if (!iso) return false;
      return Date.parse(iso) >= Date.parse(sparkFromIso);
    });
    sparklineEarningsThb = buildReferralEarningsSparklineThb(forSpark, statsTz, 14);
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const referralLink = `${String(baseUrl).replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;
  /** Короткая визитка `/u/[id]` — QR/PDF/Stories (Stage 74.3). */
  const referralLandingUrl = buildAmbassadorLandingUrl(profile.id);
  const referralLandingShortDisplay = ambassadorLandingShortLabel(profile.id);
  const friendsInvited = Number(invitedCount || 0);
  const directPartnersCount = Number(directPartnersInvited || 0);
  const tierState = ReferralPnlService.resolveTierForPartnerCount(tiers, directPartnersCount);
  const currentTier = tierState.currentTier;
  const nextTier = tierState.nextTier;
  const remainingToNextTier = Math.max(
    0,
    Number(nextTier?.minPartnersInvited || 0) - Number(directPartnersCount || 0),
  );
  const currentTierFloor = Number(currentTier?.minPartnersInvited || 0);
  const tierSpan = Math.max(1, Number(nextTier?.minPartnersInvited || currentTierFloor + 1) - currentTierFloor);
  const tierProgressPercent = Math.min(
    100,
    Math.max(0, Math.round(((directPartnersCount - currentTierFloor) / tierSpan) * 100)),
  );
  const payoutRatioFromTier = Number(
    profile?.referral_tier_payout_ratio ?? currentTier?.payoutRatio ?? 0,
  );
  const ambassadorProgressPercent = Math.min(
    100,
    Math.round((friendsInvited / Math.max(1, Number(nextTier?.minPartnersInvited || 10))) * 100),
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

  let referralGamification = {
    badgesEarned: [],
    primaryBadge: null,
    leaderboardRankMonthly: null,
    badgeSnapshot: null,
  };
  let referralStoriesCopy = buildStoriesCopy(normalizeStoriesLang(profile?.preferred_language || profile?.language), {
    brandName,
    tierName: String(profile?.referral_tier_name || currentTier?.name || ''),
    badgeLabel: '',
    monthlyNetworkEarnedThb,
  });

  if (supabaseAdmin) {
    const monthBounds = referralStatsCurrentMonthBoundsUtc(statsTz);
    const [topRows, firstEarnedRes] = await Promise.all([
      aggregateReferralLeaderboardFromDb(
        supabaseAdmin,
        monthBounds.monthStartUtcIso,
        monthBounds.monthEndExclusiveUtcIso,
        10,
      ),
      supabaseAdmin
        .from('referral_ledger')
        .select('earned_at')
        .eq('referrer_id', profile.id)
        .eq('status', 'earned')
        .order('earned_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const idx = topRows.findIndex((r) => r.referrerId === profile.id);
    const leaderboardRankForMonth = idx >= 0 ? idx + 1 : null;
    let fastStartEligible = false;
    const createdAt = profile?.created_at;
    const firstEarnIso = firstEarnedRes?.data?.earned_at;
    if (createdAt && firstEarnIso) {
      const c = Date.parse(String(createdAt));
      const e = Date.parse(String(firstEarnIso));
      if (Number.isFinite(c) && Number.isFinite(e)) {
        const days = (e - c) / 86400000;
        fastStartEligible = days >= 0 && days <= FAST_START_MAX_DAYS;
      }
    }
    const badgeResult = computeReferralBadgeResult({
      monthlyNetworkEarnedThb,
      friendsInvited,
      leaderboardRankForMonth,
      fastStartEligible,
    });
    const langNorm = normalizeStoriesLang(profile?.preferred_language || profile?.language);
    const primaryLabel = badgeResult.primary ? badgeLabelForLang(badgeResult.primary, langNorm) : '';
    referralGamification = {
      badgesEarned: badgeResult.earned,
      primaryBadge: badgeResult.primary,
      leaderboardRankMonthly: leaderboardRankForMonth,
      badgeSnapshot: {
        badges_earned: badgeResult.earned,
        primary_badge: badgeResult.primary,
        leaderboard_rank_monthly: leaderboardRankForMonth,
      },
    };
    referralStoriesCopy = buildStoriesCopy(langNorm, {
      brandName,
      tierName: String(profile?.referral_tier_name || currentTier?.name || ''),
      badgeLabel: primaryLabel,
      monthlyNetworkEarnedThb,
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      code,
      referralLink,
      referralLandingUrl,
      referralLandingShortDisplay,
      shareMessage,
      brandName,
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
        currentInvites: friendsInvited,
        progressPercent: ambassadorProgressPercent,
      },
      turbo: {
        enabled: promoTurboModeEnabled,
        promoBoostPerBookingThb,
        referralSplitRatio,
        oldReferrerBonusWithBoostThb,
        newReferrerBonusWithBoostThb,
      },
      stats: {
        pendingThb: Math.round(pendingThb * 100) / 100,
        earnedThb: Math.round(earnedThb * 100) / 100,
        friendsInvited,
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
        /** За текущий календарный месяц (TZ статистики): прямые рефералы (ledger_depth = 1). */
        monthlyL1EarnedThb,
        /** За текущий месяц: доход с глубины сети ≥2 (L2+). */
        monthlyNetworkEarnedThb,
      },
      referralReport: {
        /** Значение из профиля (может быть пустым — клиент трактует как UTC). */
        ianaTimezone: String(profile?.iana_timezone || '').trim(),
        statsCalendarIana: statsTz,
        referralMonthlyGoalThbProfile: profileGoalNum,
      },
      /** Stage 74.2 — бейджи (метаданные для Stories/UI; snapshot можно дублировать в profiles.metadata на клиенте). */
      referralGamification,
      /** Тексты Stories PNG по языку профиля (RU/EN/ZH/TH). */
      referralStoriesCopy,
      inviteNetwork: myInviteEdge
        ? {
            depth: Number(myInviteEdge.network_depth || 1),
            directReferrerId: myInviteEdge.referrer_id || null,
            ancestorChainLength: Array.isArray(myInviteEdge.ancestor_path)
              ? myInviteEdge.ancestor_path.length
              : 0,
          }
        : null,
      /** Stage 72.6 — прямые приглашённые (дерево уровнем 1); чат-поиск по таблице conversations */
      teamMembers,
    },
  });
}

