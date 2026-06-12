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

function parseCampaignConfig(codeRow) {
  const metadata = codeRow?.metadata && typeof codeRow.metadata === 'object' ? codeRow.metadata : {};
  const campaignSlug =
    String(codeRow?.campaign_slug || metadata.campaign_slug || '').trim() || null;
  const maxBudgetThb = Number(metadata.max_budget_thb);
  const currentSpentThb = Number(metadata.current_spent_thb);
  const overrideHoldDays = Number(metadata.override_hold_days);
  const campaignIsActive = metadata.campaign_is_active !== false;
  const expiresAtRaw = String(metadata.campaign_expires_at || '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const expiresAtMs = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null;
  return {
    codeId: String(codeRow?.id || '').trim() || null,
    campaignSlug,
    maxBudgetThb: Number.isFinite(maxBudgetThb) && maxBudgetThb > 0 ? round2(maxBudgetThb) : null,
    currentSpentThb:
      Number.isFinite(currentSpentThb) && currentSpentThb > 0 ? round2(currentSpentThb) : 0,
    overrideHoldDays:
      Number.isFinite(overrideHoldDays) && overrideHoldDays >= 0
        ? Math.min(90, Math.floor(overrideHoldDays))
        : null,
    expiresAtIso: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
    expiresAtMs,
    isActive: campaignIsActive,
  };
}

/**
 * Stage 122.0 — campaign guard for hold override.
 * Active campaign means:
 * - slug exists
 * - campaign not expired
 * - budget not exhausted (current_spent_thb < max_budget_thb when max budget is configured)
 */
export async function resolveReferralCampaignForRelation(relation) {
  const codeId = String(relation?.referral_code_id || '').trim();
  if (!codeId) {
    return { active: false, reason: 'NO_REFERRAL_CODE_ID', campaign: null };
  }
  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .select('id,campaign_slug,metadata')
    .eq('id', codeId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message || 'REFERRAL_CAMPAIGN_CODE_READ_FAILED');
  if (!data) return { active: false, reason: 'REFERRAL_CODE_NOT_FOUND', campaign: null };

  const campaign = parseCampaignConfig(data);
  if (!campaign.campaignSlug) {
    return { active: false, reason: 'NO_CAMPAIGN_SLUG', campaign };
  }
  if (campaign.isActive === false) {
    return { active: false, reason: 'CAMPAIGN_PAUSED', campaign };
  }

  const nowMs = Date.now();
  if (campaign.expiresAtMs != null && campaign.expiresAtMs <= nowMs) {
    return { active: false, reason: 'CAMPAIGN_EXPIRED', campaign };
  }
  if (campaign.maxBudgetThb != null && campaign.currentSpentThb >= campaign.maxBudgetThb) {
    return { active: false, reason: 'CAMPAIGN_BUDGET_EXHAUSTED', campaign };
  }

  return { active: true, reason: null, campaign };
}

/** Stage 122.0 — increment campaign spend when campaign-specific logic was used. */
export async function bumpReferralCampaignSpent({ referralCodeId, deltaThb }) {
  const codeId = String(referralCodeId || '').trim();
  const delta = round2(deltaThb);
  if (!codeId || !(delta > 0)) return { success: true, skipped: true };
  const { data, error } = await supabaseAdmin
    .from('referral_codes')
    .select('id,campaign_slug,metadata')
    .eq('id', codeId)
    .maybeSingle();
  if (error) return { success: false, error: error.message || 'REFERRAL_CAMPAIGN_READ_FAILED' };
  if (!data) return { success: false, error: 'REFERRAL_CODE_NOT_FOUND' };
  const metadata = data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {};
  const current = round2(Number(metadata.current_spent_thb) || 0);
  const next = round2(current + delta);
  metadata.current_spent_thb = next;
  if (!metadata.campaign_slug && data?.campaign_slug) {
    metadata.campaign_slug = String(data.campaign_slug).trim();
  }
  const { error: upErr } = await supabaseAdmin
    .from('referral_codes')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', codeId);
  if (upErr) return { success: false, error: upErr.message || 'REFERRAL_CAMPAIGN_SPEND_UPDATE_FAILED' };
  const campaignSlug = String(data?.campaign_slug || metadata.campaign_slug || '').trim();
  if (campaignSlug) {
    try {
      const { evaluateCampaignBudgetAfterSpend } = await import(
        '@/lib/services/marketing/referral-campaigns.service.js'
      );
      await evaluateCampaignBudgetAfterSpend(campaignSlug);
    } catch (e) {
      console.warn('[referral-campaign] budget evaluate failed', e?.message || e);
    }
  }
  return { success: true, data: { previousSpentThb: current, currentSpentThb: next } };
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
      .select('unlock_at, amount_thb, metadata')
      .eq('referrer_id', uid)
      .eq('type', REFERRAL_TYPES.REFERRER_BONUS)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .order('unlock_at', { ascending: true })
      .limit(50),
    supabaseAdmin
      .from('referral_ledger')
      .select('unlock_at, amount_thb, metadata')
      .eq('referee_id', uid)
      .eq('type', REFERRAL_TYPES.REFEREE_CASHBACK)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .order('unlock_at', { ascending: true })
      .limit(50),
  ]);

  if (bonusRes.error) throw new Error(bonusRes.error.message || 'HELD_BONUS_READ_FAILED');
  if (cashbackRes.error) throw new Error(cashbackRes.error.message || 'HELD_CASHBACK_READ_FAILED');

  const isPeriodHoldRow = (row) => {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return meta.fraud_gate_hold !== true;
  };

  const rows = [...(bonusRes.data || []), ...(cashbackRes.data || [])].filter(isPeriodHoldRow);
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

/** Stage 131.8 — security fraud-gate held (invisible in period-hold UX). */
export async function sumSecurityHeldReferralThbForUser(userId) {
  const uid = String(userId || '').trim();
  if (!uid) return 0;

  const isSecurityHeldRow = (row) => {
    const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return meta.fraud_gate_hold === true;
  };

  const [bonusRes, cashbackRes] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, metadata')
      .eq('referrer_id', uid)
      .eq('type', REFERRAL_TYPES.REFERRER_BONUS)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .limit(200),
    supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb, metadata')
      .eq('referee_id', uid)
      .eq('type', REFERRAL_TYPES.REFEREE_CASHBACK)
      .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      .limit(200),
  ]);

  if (bonusRes.error) throw new Error(bonusRes.error.message || 'SECURITY_HELD_BONUS_READ_FAILED');
  if (cashbackRes.error) throw new Error(cashbackRes.error.message || 'SECURITY_HELD_CASHBACK_READ_FAILED');

  const rows = [...(bonusRes.data || []), ...(cashbackRes.data || [])].filter(isSecurityHeldRow);
  return round2(rows.reduce((s, r) => s + (Number(r.amount_thb) || 0), 0));
}
