import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';

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

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id,referral_code')
    .eq('id', session.userId)
    .maybeSingle();
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

  const [{ data: ledger }, { count: invitedCount }] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('status,amount_thb,referee_id')
      .eq('referrer_id', profile.id),
    supabaseAdmin
      .from('referral_relations')
      .select('id', { head: true, count: 'exact' })
      .eq('referrer_id', profile.id),
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
  const ambassadorTargetInvites = 10;
  const friendsInvited = Number(invitedCount || 0);
  const ambassadorProgressPercent = Math.min(
    100,
    Math.round((friendsInvited / Math.max(1, ambassadorTargetInvites)) * 100),
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
        targetInvites: ambassadorTargetInvites,
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
    },
  });
}

