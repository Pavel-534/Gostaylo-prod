/**
 * Stage 131.6 / 134 — smoke: referral FinTech Bridge (withdrawal request → FX lock → payout + T-Bank registry).
 */
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import WalletService from '@/lib/services/finance/wallet.service.js'
import { createReferralWithdrawalPayoutRow } from '@/lib/services/marketing/referral-payout-bridge.service.js'
import TbankPayoutRegistryService from '@/lib/services/tbank-payout-registry.service.js'
import { PAYOUT_RAIL } from '@/lib/treasury/payout-rails.js'
import { REFERRAL_RU_PAYOUT_METHOD_ID } from '@/lib/referral/referral-ru-payout-profile.js'
import { thbPerRubFromRubPerThb, normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'
import { isSmokeExchangeRatesWriteBlocked } from '@/lib/finance/exchange-rates-write-guard.js'
import { withSmokeRetry } from '@/lib/smoke/smoke-retry.js'
import { assertWalletBucketIntegrity } from '@/lib/smoke/wallet-bucket-assert.js'

const GROSS_THB = 2000

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 }
}

function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0)
}

function pass(s, detail, t0) {
  s.ok = true
  s.detail = detail
  markDuration(s, t0)
  return s
}

function fail(s, detail, t0) {
  s.ok = false
  s.detail = String(detail || 'failed').slice(0, 500)
  markDuration(s, t0)
  return s
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

async function ensureFreshRubRate() {
  if (isSmokeExchangeRatesWriteBlocked()) {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate_to_thb, updated_at')
      .eq('currency_code', 'RUB')
      .maybeSingle()
    if (error) throw new Error(`exchange_rates RUB read: ${error.message}`)
    const rate = normalizeThbPerUnitRate('RUB', Number(data?.rate_to_thb))
    if (rate == null || rate <= 0 || rate >= 1) {
      throw new Error('exchange_rates RUB missing or invalid (smoke read-only on prod)')
    }
    return
  }

  const ts = new Date().toISOString()
  const rubPerThb = Number(process.env.SMOKE_MIR_RUB_PER_THB) || 2.8
  const rateToThb = thbPerRubFromRubPerThb(rubPerThb)
  if (rateToThb == null) throw new Error('SMOKE_MIR_RUB_PER_THB invalid')
  const { error } = await supabaseAdmin.from('exchange_rates').upsert(
    {
      currency_code: 'RUB',
      rate_to_thb: rateToThb,
      source: 'smoke_test',
      updated_at: ts,
    },
    { onConflict: 'currency_code' },
  )
  if (error) throw new Error(`exchange_rates RUB: ${error.message}`)
}

async function cleanup(userId, payoutId, profileId) {
  if (payoutId) {
    await supabaseAdmin.from('payouts').delete().eq('id', payoutId)
  }
  if (profileId) {
    await supabaseAdmin.from('partner_payout_profiles').delete().eq('id', profileId)
  }
  if (userId) {
    await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('user_wallets').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
  }
}

/**
 * @returns {Promise<{ name: string, ok: boolean, detail: string, durationMs: number }>}
 */
export async function runReferralFintechBridgeSmokeStep() {
  const s = step('Referral 131.6 FinTech Bridge payout rail')
  const t0 = Date.now()
  let userId = null
  let payoutId = null
  let profileId = null

  if (!supabaseAdmin) {
    return fail(s, 'SUPABASE not configured', t0)
  }

  try {
    await withSmokeRetry(() => ensureFreshRubRate(), { label: '12f ensureFreshRubRate' })

    userId = makeId('user-smoke-ref-bridge')
    profileId = makeId('ppp-smoke-ref-bridge')
    const ts = new Date().toISOString()
    const hash = bcrypt.hashSync('smoke-ref-bridge-pass', 8)

    const { error: profErr } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      email: `${userId}@smoke.invalid`,
      password_hash: hash,
      role: 'RENTER',
      first_name: 'SmokeAmbassador',
      referral_code: `SA${Date.now().toString(36).slice(-6).toUpperCase()}`,
      terms_accepted: true,
      terms_accepted_at: ts,
      is_verified: true,
      language: 'ru',
    })
    if (profErr) return fail(s, `profile: ${profErr.message}`, t0)

    const walletRes = await withSmokeRetry(() => WalletService.getOrCreateWallet(userId), {
      label: '12f getOrCreateWallet',
    })
    if (!walletRes.success) {
      await cleanup(userId, null, null)
      return fail(s, `wallet create: ${walletRes.error}`, t0)
    }
    const { error: walletErr } = await supabaseAdmin
      .from('user_wallets')
      .update({
        balance_thb: GROSS_THB,
        withdrawable_balance_thb: GROSS_THB,
        internal_credits_thb: 0,
        verified_for_payout: true,
        updated_at: ts,
      })
      .eq('user_id', userId)
    if (walletErr) {
      await cleanup(userId, null, null)
      return fail(s, `wallet: ${walletErr.message}`, t0)
    }

    const { error: profileErr } = await supabaseAdmin.from('partner_payout_profiles').insert({
      id: profileId,
      partner_id: userId,
      method_id: REFERRAL_RU_PAYOUT_METHOD_ID,
      data: {
        recipientName: 'Smoke Ambassador Test',
        accountNumber: '40817810000000001234',
        bik: '044525974',
        inn: '7707083893',
      },
      is_verified: true,
      is_default: true,
      created_at: ts,
      updated_at: ts,
    })
    if (profileErr) {
      await cleanup(userId, null, null)
      return fail(s, `ru_profile: ${profileErr.message}`, t0)
    }

    const request = await withSmokeRetry(() => WalletService.requestReferralWithdrawal(userId), {
      label: '12f requestReferralWithdrawal',
    })
    if (!request.success) {
      await cleanup(userId, null, profileId)
      return fail(s, `request: ${request.error || 'REQUEST_FAILED'}`, t0)
    }

    const fxLock = request.data?.fxLock
    if (!fxLock?.requested_fx_rate || fxLock?.requested_rub_amount == null) {
      await cleanup(userId, null, profileId)
      return fail(s, 'FX lock metadata missing after request', t0)
    }

    const nowIso = new Date().toISOString()
    const referenceId = `referral_withdrawal_payout:${userId}:${nowIso.slice(0, 10)}`

    const bridge = await createReferralWithdrawalPayoutRow({
      userId,
      grossThb: GROSS_THB,
      approvedAt: nowIso,
      walletDebitReferenceId: referenceId,
      fxLock,
    })
    if (!bridge.success) {
      await cleanup(userId, null, profileId)
      return fail(s, `bridge: ${bridge.error || 'BRIDGE_FAILED'}`, t0)
    }
    payoutId = bridge.data?.payoutId

    const preview = bridge.data.preview
    const debit = await WalletService.debitReferralWithdrawalPayout(userId, GROSS_THB, {
      gross_thb: preview.grossThb,
      withdrawal_fee_thb: preview.withdrawalFeeThb,
      withdrawal_fee_percent: preview.withdrawalFeePercent,
      net_paid_thb: preview.netThb,
      net_paid_rub: bridge.data?.netRub,
      payout_currency: 'RUB',
      fee_paid_by: preview.feePaidBy,
      approved_at: nowIso,
      referenceId,
      payout_id: payoutId,
    })
    if (!debit.success || debit.data?.applied !== true) {
      await cleanup(userId, payoutId, profileId)
      return fail(s, `debit: ${debit.error || debit.data?.reason || 'DEBIT_FAILED'}`, t0)
    }

    const { data: payoutRow, error: readErr } = await supabaseAdmin
      .from('payouts')
      .select('id,status,payout_rail,payout_currency,amount_in_payout_currency,metadata')
      .eq('id', payoutId)
      .maybeSingle()

    if (readErr || !payoutRow?.id) {
      await cleanup(userId, payoutId, profileId)
      return fail(s, readErr?.message || 'PAYOUT_ROW_MISSING', t0)
    }

    if (String(payoutRow.status).toUpperCase() !== 'PENDING') {
      await cleanup(userId, payoutId, profileId)
      return fail(s, `status=${payoutRow.status}`, t0)
    }
    if (payoutRow.metadata?.payout_type !== 'referral_withdrawal') {
      await cleanup(userId, payoutId, profileId)
      return fail(s, `payout_type=${payoutRow.metadata?.payout_type}`, t0)
    }
    const rail = payoutRow.payout_rail || payoutRow.metadata?.payout_rail
    if (rail !== PAYOUT_RAIL.REFERRAL_RUB_CARD) {
      await cleanup(userId, payoutId, profileId)
      return fail(s, `payout_rail=${rail}`, t0)
    }

    const expectedRub = round2(bridge.data?.netRub ?? fxLock.requested_rub_amount)
    const actualRub = round2(payoutRow.amount_in_payout_currency)
    if (Math.abs(actualRub - expectedRub) > 0.02) {
      await cleanup(userId, payoutId, profileId)
      return fail(s, `rub amount expected=${expectedRub} actual=${actualRub}`, t0)
    }

    const registry = await TbankPayoutRegistryService.listPendingRuBankPayoutsForRegistry()
    const inRegistry = (registry.exportable || []).some((p) => p.id === payoutId)
    if (!inRegistry) {
      await cleanup(userId, payoutId, profileId)
      return fail(s, 'not in T-Bank registry exportable set', t0)
    }

    await assertWalletBucketIntegrity(userId, { label: '12f-bridge' })
    await cleanup(userId, payoutId, profileId)
    return pass(
      s,
      `PENDING referral_withdrawal rail=${PAYOUT_RAIL.REFERRAL_RUB_CARD} rub=${actualRub} fx_lock=OK registry=OK`,
      t0,
    )
  } catch (e) {
    await cleanup(userId, payoutId, profileId)
    return fail(s, e?.message || String(e), t0)
  }
}

export default { runReferralFintechBridgeSmokeStep }
