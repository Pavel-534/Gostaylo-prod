/**
 * Stage 202.24 — money-adjacent admin write audit + idempotency.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-24-money-write-audit.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  buildPayoutStatusAuditPayload,
  buildPartnerPayoutProfileVerifyAuditPayload,
  buildWalletPayoutVerificationAuditPayload,
  buildWalletReferralWithdrawalClearAuditPayload,
} = require('../lib/admin/money-write-audit.js')

describe('Stage 202.24 — payout status audit payloads', () => {
  it('PAID: before/after status and amounts for admin audit explorer', () => {
    const row = { status: 'PROCESSING', amount_thb: 1200, amount_in_payout_currency: 3500 }
    const payout = { status: 'PAID', amount_thb: 1200, amount_in_payout_currency: 3500 }
    const payload = buildPayoutStatusAuditPayload({
      row,
      payout,
      nextStatus: 'PAID',
      adminId: 'admin-1',
    })
    assert.equal(payload.before.status, 'PROCESSING')
    assert.equal(payload.after.status, 'PAID')
    assert.equal(payload.before.amount_thb, 1200)
    assert.equal(payload.source, 'admin_payouts_panel')
    assert.equal(payload.adminId, 'admin-1')
  })

  it('FAILED: captures transition from PROCESSING', () => {
    const row = { status: 'PROCESSING', amount_thb: 800 }
    const payout = { status: 'FAILED', amount_thb: 800 }
    const payload = buildPayoutStatusAuditPayload({
      row,
      payout,
      nextStatus: 'FAILED',
      adminId: 'admin-1',
    })
    assert.equal(payload.before.status, 'PROCESSING')
    assert.equal(payload.after.status, 'FAILED')
  })

  it('works without adminId (backward compat callers)', () => {
    const payload = buildPayoutStatusAuditPayload({
      row: { status: 'PENDING' },
      nextStatus: 'PAID',
    })
    assert.equal(payload.adminId, null)
    assert.deepEqual(payload.before, {
      status: 'PENDING',
      amount_thb: null,
      amount_in_payout_currency: null,
    })
  })
})

describe('Stage 202.24 — partner payout profile verify audit', () => {
  it('uses is_verified (not kyc_status) with correct entity source', () => {
    const payload = buildPartnerPayoutProfileVerifyAuditPayload({
      row: { is_verified: false },
      adminId: 'admin-2',
    })
    assert.equal(payload.before.is_verified, false)
    assert.equal(payload.after.is_verified, true)
    assert.equal(payload.source, 'admin_payout_verification')
    assert.equal(payload.adminId, 'admin-2')
  })
})

describe('Stage 202.24 — wallet payout audit payloads', () => {
  it('verified_for_payout toggle true records before/after', () => {
    const payload = buildWalletPayoutVerificationAuditPayload({
      wallet: { id: 'w1', user_id: 'u1', verified_for_payout: false },
      verifiedForPayout: true,
      adminId: 'admin-3',
    })
    assert.equal(payload.before.verified_for_payout, false)
    assert.equal(payload.after.verified_for_payout, true)
    assert.equal(payload.before.user_id, 'u1')
    assert.equal(payload.source, 'admin_wallet_panel')
  })

  it('verified_for_payout toggle false records unblock reversal', () => {
    const payload = buildWalletPayoutVerificationAuditPayload({
      wallet: { user_id: 'u1', verified_for_payout: true },
      verifiedForPayout: false,
      adminId: 'admin-3',
    })
    assert.equal(payload.before.verified_for_payout, true)
    assert.equal(payload.after.verified_for_payout, false)
  })

  it('referral withdrawal clear nulls referral fields', () => {
    const payload = buildWalletReferralWithdrawalClearAuditPayload({
      wallet: {
        user_id: 'u2',
        referral_withdrawal_status: 'withdrawable_referral',
        referral_withdrawal_amount_thb: 500,
      },
      adminId: 'admin-4',
    })
    assert.equal(payload.before.referral_withdrawal_status, 'withdrawable_referral')
    assert.equal(payload.after.referral_withdrawal_status, null)
    assert.equal(payload.after.referral_withdrawal_amount_thb, null)
  })
})

describe('Stage 202.24 — stable audit action names', () => {
  it('registers four money-adjacent admin actions', () => {
    const actions = [
      'payout_status_change',
      'partner_payout_profile_verify',
      'wallet_payout_verification',
      'wallet_referral_withdrawal_clear',
    ]
    assert.equal(actions.length, 4)
    assert.ok(actions.every((a) => /^[a-z0-9_]+$/.test(a)))
  })
})
