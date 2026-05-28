/**
 * Stage 121.1 (B2) — hold period for referral earned bonuses (SSOT helpers).
 */
import { supabaseAdmin } from '@/lib/supabase';
import WalletService from '@/lib/services/finance/wallet.service.js';
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js';

export const DEFAULT_REFERRAL_HOLD_DAYS = 14;

const REFERRAL_TYPES = Object.freeze({
  REFERRER_BONUS: 'bonus',
  REFEREE_CASHBACK: 'cashback',
});

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function clampHoldDays(days) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_REFERRAL_HOLD_DAYS;
  return Math.min(90, Math.max(0, n));
}

/** @param {string} completedAtIso */
export function computeReferralUnlockAt(completedAtIso, holdDays) {
  const days = clampHoldDays(holdDays);
  if (days <= 0) return null;
  const base = completedAtIso ? new Date(completedAtIso) : new Date();
  const t = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  return new Date(t + days * 86400000).toISOString();
}

/** @param {object} row referral_ledger row */
export function beneficiaryIdForLedgerRow(row) {
  const txType =
    String(row?.type || '').toLowerCase() === REFERRAL_TYPES.REFERRER_BONUS
      ? 'referral_bonus'
      : 'referral_cashback';
  return txType === 'referral_bonus'
    ? String(row?.referrer_id || '').trim()
    : String(row?.referee_id || '').trim();
}

/** @param {string} userId @param {number} deltaThb */
export async function adjustHeldReferralBalanceThb(userId, deltaThb) {
  const uid = String(userId || '').trim();
  if (!uid) return { success: false, error: 'USER_ID_REQUIRED' };
  const delta = round2(deltaThb);
  if (delta === 0) return { success: true, skipped: true };

  const wallet = await WalletService.getOrCreateWallet(uid);
  if (!wallet.success) return wallet;

  const prev = round2(wallet.data?.held_referral_balance_thb ?? 0);
  const next = round2(Math.max(0, prev + delta));
  const { error } = await supabaseAdmin
    .from('user_wallets')
    .update({ held_referral_balance_thb: next, updated_at: new Date().toISOString() })
    .eq('user_id', uid);
  if (error) return { success: false, error: error.message || 'HELD_BALANCE_UPDATE_FAILED' };
  return { success: true, data: { heldReferralBalanceThb: next, previousThb: prev } };
}

/**
 * User-facing held summary (referrer bonus + referee cashback).
 * Amount SSOT: `user_wallets.held_referral_balance_thb`; unlock dates from ledger.
 */
export async function getUserHeldReferralSummary(userId) {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { heldReferralBalanceThb: 0, nearestUnlockAt: null, heldRowCount: 0 };
  }

  const wallet = await WalletService.getOrCreateWallet(uid);
  const heldFromWallet = wallet.success
    ? round2(wallet.data?.held_referral_balance_thb ?? 0)
    : 0;

  const [bonusRes, cashbackRes] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('unlock_at, amount_thb')
      .eq('referrer_id', uid)
      .eq('type', REFERRAL_TYPES.REFERRER_BONUS)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .order('unlock_at', { ascending: true })
      .limit(50),
    supabaseAdmin
      .from('referral_ledger')
      .select('unlock_at, amount_thb')
      .eq('referee_id', uid)
      .eq('type', REFERRAL_TYPES.REFEREE_CASHBACK)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .order('unlock_at', { ascending: true })
      .limit(50),
  ]);

  if (bonusRes.error) throw new Error(bonusRes.error.message || 'HELD_BONUS_READ_FAILED');
  if (cashbackRes.error) throw new Error(cashbackRes.error.message || 'HELD_CASHBACK_READ_FAILED');

  const rows = [...(bonusRes.data || []), ...(cashbackRes.data || [])];
  let nearestUnlockAt = null;
  for (const row of rows) {
    const iso = row?.unlock_at ? String(row.unlock_at) : '';
    if (!iso) continue;
    if (!nearestUnlockAt || Date.parse(iso) < Date.parse(nearestUnlockAt)) {
      nearestUnlockAt = iso;
    }
  }

  const heldFromLedger = round2(rows.reduce((s, r) => s + (Number(r.amount_thb) || 0), 0));
  const heldReferralBalanceThb = heldFromWallet > 0 ? heldFromWallet : heldFromLedger;

  return {
    heldReferralBalanceThb,
    nearestUnlockAt,
    heldRowCount: rows.length,
  };
}

/** Live outstanding held (referral_ledger SSOT). */
export async function sumOutstandingHeldReferralThb({ referrerId = '' } = {}) {
  let q = supabaseAdmin.from('referral_ledger').select('amount_thb').eq('status', REFERRAL_STATUSES.EARNED_HELD);
  const rid = String(referrerId || '').trim();
  if (rid) q = q.eq('referrer_id', rid);
  const { data, error } = await q.limit(10000);
  if (error) throw new Error(error.message || 'HELD_LEDGER_READ_FAILED');
  return round2((data || []).reduce((s, r) => s + (Number(r.amount_thb) || 0), 0));
}
