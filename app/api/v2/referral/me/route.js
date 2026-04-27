import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service';

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
    .select('id,referral_code,referral_tier_id,referral_tier_name,referral_tier_payout_ratio')
    .eq('id', session.userId)
    .maybeSingle();
  if (profileError && /referral_tier_/i.test(String(profileError?.message || ''))) {
    const fallback = await supabaseAdmin
      .from('profiles')
      .select('id,referral_code')
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

  const [{ data: ledger }, { count: invitedCount }, { data: myInviteEdge }, tiers, directPartnersInvited] = await Promise.all([
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
  const referralLink = `${String(baseUrl).replace(/\/$/, '')}/?ref=${encodeURIComponent(code)}`;
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
  const shareMessage = `Присоединяйся к GoStayLo! Используй мой код ${code} и получай бонусы: ${referralLink}`;
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

  return NextResponse.json({
    success: true,
    data: {
      code,
      referralLink,
      shareMessage,
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
        payoutTooltip: `Ваш текущий уровень позволяет выводить ${Math.round(
          Number.isFinite(payoutRatioFromTier) ? payoutRatioFromTier : 60,
        )}% заработка на карту.`,
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
      },
      inviteNetwork: myInviteEdge
        ? {
            depth: Number(myInviteEdge.network_depth || 1),
            directReferrerId: myInviteEdge.referrer_id || null,
            ancestorChainLength: Array.isArray(myInviteEdge.ancestor_path)
              ? myInviteEdge.ancestor_path.length
              : 0,
          }
        : null,
    },
  });
}

