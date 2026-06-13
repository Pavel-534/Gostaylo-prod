/**
 * Stage 131.5 / 134 — FinTech Bridge: referral wallet approve → unified `payouts` + T-Bank registry.
 * Value Lock stays THB in `user_wallets`; physical settlement is RUB @ locked rate from request metadata.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { buildReferralWithdrawalPreview } from '@/lib/services/marketing/referral-withdrawal-preview.service.js'
import { resolveReferralFxLock } from '@/lib/finance/referral-payout-fx-policy.js'
import {
  assertReferralRuPayoutProfileReady,
  REFERRAL_RU_PAYOUT_METHOD_ID,
} from '@/lib/referral/referral-ru-payout-profile.js'
import { PAYOUT_RAIL } from '@/lib/treasury/payout-rails.js'

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {{
 *   userId: string,
 *   grossThb: number,
 *   approvedAt?: string,
 *   walletDebitReferenceId?: string,
 *   fxLock?: object | null,
 * }} params
 */
export async function createReferralWithdrawalPayoutRow(params) {
  const userId = String(params?.userId || '').trim()
  const grossThb = round2(params.grossThb)
  const approvedAt = params.approvedAt || new Date().toISOString()
  if (!userId || grossThb <= 0) {
    return { success: false, error: 'INVALID_PAYOUT_BRIDGE_PARAMS' }
  }

  const profileGate = await assertReferralRuPayoutProfileReady(userId)
  if (!profileGate.ok) {
    return {
      success: false,
      error: profileGate.error || 'REFERRAL_RU_PAYOUT_PROFILE_REQUIRED',
    }
  }

  let fxLockMeta = params.fxLock
  if (!fxLockMeta) {
    const { data: walletRow } = await supabaseAdmin
      .from('user_wallets')
      .select('referral_withdrawal_metadata')
      .eq('user_id', userId)
      .maybeSingle()
    fxLockMeta = walletRow?.referral_withdrawal_metadata
  }

  const lock = resolveReferralFxLock(fxLockMeta, { grossThb })
  if (!lock.ok) {
    return { success: false, error: lock.error || 'REFERRAL_PAYOUT_FX_LOCK_MISSING' }
  }

  const preview = await buildReferralWithdrawalPreview(grossThb, {
    payoutCurrency: 'RUB',
    skipFxConversion: true,
  })

  const netRub = lock.requestedRubAmount
  const midRateToThb = lock.requestedFxRate
  const profile = profileGate.profile

  const metadata = {
    payout_type: 'referral_withdrawal',
    payout_rail: PAYOUT_RAIL.REFERRAL_RUB_CARD,
    user_id: userId,
    gross_thb: preview.grossThb,
    withdrawal_fee_thb: preview.withdrawalFeeThb,
    withdrawal_fee_percent: preview.withdrawalFeePercent,
    net_thb: preview.netThb,
    net_rub: netRub,
    fee_paid_by: preview.feePaidBy,
    mid_rate_to_thb: midRateToThb,
    fx_spread_pct: 0,
    approved_at: approvedAt,
    wallet_debit_reference_id: params.walletDebitReferenceId || null,
    fx_lock: {
      requested_fx_rate_at: lock.requestedFxRateAt,
      fx_lock_expires_at: lock.fxLockExpiresAt,
      locked_at_request: true,
      requested_rub_amount: netRub,
    },
    payout_fx: {
      payout_currency: 'RUB',
      amount_in_payout_currency: netRub,
      base_rate_to_thb: midRateToThb,
      effective_rate_to_thb: midRateToThb,
      spread_pct: 0,
      mid_amount_in_payout_currency: netRub,
      computed_at: lock.requestedFxRateAt || approvedAt,
      approved_at: approvedAt,
    },
  }

  const insertPayload = {
    partner_id: userId,
    amount: preview.netThb,
    gross_amount: preview.grossThb,
    payout_fee_amount: preview.withdrawalFeeThb,
    final_amount: preview.netThb,
    currency: 'RUB',
    payout_currency: 'RUB',
    amount_in_payout_currency: netRub,
    payout_method_id: REFERRAL_RU_PAYOUT_METHOD_ID,
    payout_profile_id: profile.id,
    bank_account: String(profile.data?.accountNumber || '').replace(/\s/g, '') || null,
    payout_rail: PAYOUT_RAIL.REFERRAL_RUB_CARD,
    status: 'PENDING',
    metadata,
  }

  let payout
  let error
  {
    const res = await supabaseAdmin
      .from('payouts')
      .insert(insertPayload)
      .select('id,partner_id,status,payout_currency,amount_in_payout_currency,payout_rail,metadata')
      .single()
    payout = res.data
    error = res.error
  }

  if (error && /payout_rail|schema cache/i.test(String(error.message || ''))) {
    const { payout_rail: _rail, ...legacyPayload } = insertPayload
    const res = await supabaseAdmin
      .from('payouts')
      .insert(legacyPayload)
      .select('id,partner_id,status,payout_currency,amount_in_payout_currency,metadata')
      .single()
    payout = res.data
    error = res.error
  }

  if (error) {
    return { success: false, error: error.message || 'REFERRAL_PAYOUT_INSERT_FAILED' }
  }

  return {
    success: true,
    data: {
      payoutId: payout.id,
      payout,
      preview,
      netRub,
      fxLockUsed: lock,
    },
  }
}

export default { createReferralWithdrawalPayoutRow }
