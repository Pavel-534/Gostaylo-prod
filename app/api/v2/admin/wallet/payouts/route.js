import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PricingService } from '@/lib/services/pricing.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

async function requireAdmin() {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { ok: true };
}

async function getMinPayoutThb() {
  const general = await PricingService.getGeneralPricingSettings();
  const raw = Number(general?.wallet_min_payout_thb ?? general?.walletMinPayoutThb ?? 1000);
  if (!Number.isFinite(raw) || raw < 0) return 1000;
  return round2(raw);
}

function toPayoutCandidateRow(wallet, profile, minPayoutThb) {
  const balanceThb = round2(wallet?.balance_thb);
  const withdrawableBalanceThb = round2(wallet?.withdrawable_balance_thb);
  const internalCreditsThb = round2(wallet?.internal_credits_thb);
  const verifiedForPayout = wallet?.verified_for_payout !== false;
  const profileVerified = profile?.is_verified === true;
  const readyForPayout =
    withdrawableBalanceThb >= minPayoutThb &&
    profileVerified &&
    verifiedForPayout &&
    withdrawableBalanceThb > 0;
  const blockers = [];
  if (!(withdrawableBalanceThb >= minPayoutThb)) blockers.push('BELOW_MIN_PAYOUT');
  if (!profileVerified) blockers.push('PROFILE_NOT_VERIFIED');
  if (!verifiedForPayout) blockers.push('WALLET_NOT_CLEARED_FOR_PAYOUT');
  const referralWithdrawalStatus = wallet?.referral_withdrawal_status || null;
  const referralWithdrawalRequestedAt = wallet?.referral_withdrawal_requested_at || null;
  const referralWithdrawalAmountThb = round2(wallet?.referral_withdrawal_amount_thb ?? 0) || null;
  return {
    walletId: wallet?.id,
    userId: wallet?.user_id,
    balanceThb,
    withdrawableBalanceThb,
    internalCreditsThb,
    verifiedForPayout,
    profileVerified,
    readyForPayout,
    referralWithdrawalStatus,
    referralWithdrawalRequestedAt,
    referralWithdrawalAmountThb,
    blockers,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email || null,
          firstName: profile.first_name || null,
          lastName: profile.last_name || null,
          role: profile.role || null,
        }
      : null,
    updatedAt: wallet?.updated_at || null,
    createdAt: wallet?.created_at || null,
  };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }
  const { searchParams } = new URL(request.url);
  const readyOnly = searchParams.get('readyOnly') === '1' || searchParams.get('readyOnly') === 'true';
  const referralOnly =
    searchParams.get('referralOnly') === '1' || searchParams.get('referralOnly') === 'true';
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 200;
  const query = String(searchParams.get('query') || '').trim().toLowerCase();

  const minPayoutThb = await getMinPayoutThb();
  let walletQuery = supabaseAdmin
    .from('user_wallets')
    .select(
      'id,user_id,balance_thb,internal_credits_thb,withdrawable_balance_thb,verified_for_payout,referral_withdrawal_status,referral_withdrawal_requested_at,referral_withdrawal_amount_thb,updated_at,created_at',
    )
    .order('balance_thb', { ascending: false })
    .limit(limit);
  if (referralOnly) {
    walletQuery = walletQuery.eq('referral_withdrawal_status', 'withdrawable_referral');
  } else {
    walletQuery = walletQuery.gt('balance_thb', 0);
  }
  const { data: wallets, error: walletsErr } = await walletQuery;
  if (walletsErr) {
    return NextResponse.json(
      { success: false, error: walletsErr.message || 'WALLET_PAYOUT_LIST_FAILED' },
      { status: 500 },
    );
  }
  const userIds = [...new Set((wallets || []).map((w) => String(w?.user_id || '')).filter(Boolean))];
  let profileMap = {};
  if (userIds.length > 0) {
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name,is_verified,role')
      .in('id', userIds);
    if (profilesErr) {
      return NextResponse.json(
        { success: false, error: profilesErr.message || 'PAYOUT_PROFILE_READ_FAILED' },
        { status: 500 },
      );
    }
    profileMap = Object.fromEntries((profiles || []).map((profile) => [String(profile.id), profile]));
  }

  const rows = (wallets || [])
    .map((wallet) => toPayoutCandidateRow(wallet, profileMap[String(wallet.user_id)] || null, minPayoutThb))
    .filter((row) => {
      if (referralOnly && row.referralWithdrawalStatus !== 'withdrawable_referral') return false;
      if (readyOnly && !row.readyForPayout) return false;
      if (!query) return true;
      const haystack = [
        row.userId,
        row.profile?.email || '',
        row.profile?.firstName || '',
        row.profile?.lastName || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

  const readyCount = rows.filter((row) => row.readyForPayout).length;
  const readyBalanceTotalThb = round2(
    rows
      .filter((row) => row.readyForPayout)
      .reduce((acc, row) => acc + Number(row.withdrawableBalanceThb || 0), 0),
  );

  return NextResponse.json({
    success: true,
    data: {
      minPayoutThb,
      readyCount,
      readyBalanceTotalThb,
      rows,
    },
  });
}

export async function PATCH(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  const userId = String(body?.userId || body?.user_id || '').trim();
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }
  const clearReferralWithdrawal =
    body?.clearReferralWithdrawal === true || body?.clear_referral_withdrawal === true;
  if (clearReferralWithdrawal) {
    const { data: cleared, error: clearErr } = await supabaseAdmin
      .from('user_wallets')
      .update({
        referral_withdrawal_status: null,
        referral_withdrawal_requested_at: null,
        referral_withdrawal_amount_thb: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select(
        'id,user_id,balance_thb,internal_credits_thb,withdrawable_balance_thb,verified_for_payout,referral_withdrawal_status,referral_withdrawal_requested_at,referral_withdrawal_amount_thb,updated_at,created_at',
      )
      .maybeSingle();
    if (clearErr) {
      return NextResponse.json(
        { success: false, error: clearErr.message || 'REFERRAL_WITHDRAWAL_CLEAR_FAILED' },
        { status: 500 },
      );
    }
    if (!cleared) {
      return NextResponse.json({ success: false, error: 'WALLET_NOT_FOUND' }, { status: 404 });
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name,is_verified,role')
      .eq('id', userId)
      .maybeSingle();
    const minPayoutThb = await getMinPayoutThb();
    return NextResponse.json({
      success: true,
      data: toPayoutCandidateRow(cleared, profile || null, minPayoutThb),
    });
  }
  let targetFlag = body?.verifiedForPayout;
  if (targetFlag == null) targetFlag = body?.verified_for_payout;
  if (targetFlag == null) {
    const { data: current, error: currentErr } = await supabaseAdmin
      .from('user_wallets')
      .select('verified_for_payout')
      .eq('user_id', userId)
      .maybeSingle();
    if (currentErr) {
      return NextResponse.json(
        { success: false, error: currentErr.message || 'WALLET_READ_FAILED' },
        { status: 500 },
      );
    }
    targetFlag = !(current?.verified_for_payout !== false);
  }
  const normalizedFlag = targetFlag === true;
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('user_wallets')
    .update({ verified_for_payout: normalizedFlag, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select(
      'id,user_id,balance_thb,internal_credits_thb,withdrawable_balance_thb,verified_for_payout,updated_at,created_at',
    )
    .maybeSingle();
  if (updateErr) {
    return NextResponse.json(
      { success: false, error: updateErr.message || 'WALLET_PAYOUT_FLAG_UPDATE_FAILED' },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json({ success: false, error: 'WALLET_NOT_FOUND' }, { status: 404 });
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name,is_verified,role')
    .eq('id', userId)
    .maybeSingle();
  const minPayoutThb = await getMinPayoutThb();
  return NextResponse.json({
    success: true,
    data: toPayoutCandidateRow(updated, profile || null, minPayoutThb),
  });
}

