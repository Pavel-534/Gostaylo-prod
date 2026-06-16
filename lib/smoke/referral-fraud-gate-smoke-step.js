/**
 * Stage 131.7–131.8 — smoke: fraud gate accrual hold + admin approve resolve + fingerprint collision.
 */
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js'
import ReferralFraudResolveService from '@/lib/services/marketing/referral-fraud-resolve.service.js'
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js'
import { computePayoutFingerprint } from '@/lib/referral/payout-profile-fingerprint.js'
import { ReferralFraudGate } from '@/lib/services/marketing/referral-fraud-gate.service.js'
import TbankPayoutRegistryService from '@/lib/services/tbank-payout-registry.service.js'
import WalletService from '@/lib/services/finance/wallet.service.js'
import { STAGE72_REUSE_LISTING_ID } from '@/lib/e2e/test-listing-cleanup'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withSmokeRetry } from '@/lib/smoke/smoke-retry.js'
import { assertWalletBucketIntegrity } from '@/lib/smoke/wallet-bucket-assert.js'

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
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function cleanup(ids) {
  const {
    bookingId,
    ledgerId,
    referrerId,
    refereeId,
    attrReferrerId,
    attrRefereeId,
    profileIds = [],
    fraudQueueIds = [],
  } = ids
  if (ledgerId) await supabaseAdmin.from('referral_ledger').delete().eq('id', ledgerId)
  if (bookingId) await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
  if (attrReferrerId) await supabaseAdmin.from('referral_attributions').delete().eq('id', attrReferrerId)
  if (attrRefereeId) await supabaseAdmin.from('referral_attributions').delete().eq('id', attrRefereeId)
  for (const fq of fraudQueueIds) {
    await supabaseAdmin.from('referral_fraud_queue').delete().eq('id', fq)
  }
  for (const pid of profileIds) {
    await supabaseAdmin.from('partner_payout_profiles').delete().eq('id', pid)
  }
  for (const uid of [referrerId, refereeId].filter(Boolean)) {
    await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', uid)
    await supabaseAdmin.from('user_wallets').delete().eq('user_id', uid)
    await supabaseAdmin.from('profiles').delete().eq('id', uid)
  }
}

async function insertSmokeProfiles(referrerId, refereeId) {
  const ts = new Date().toISOString()
  const tag = `${E2E_TEST_DATA_TAG} smoke_131_7_fraud`
  const hash = bcrypt.hashSync('smoke-1317-pass', 8)
  for (const [id, email, code] of [
    [referrerId, `${referrerId}@smoke.invalid`, `SR${Date.now().toString(36).slice(-5).toUpperCase()}`],
    [refereeId, `${refereeId}@smoke.invalid`, `SE${Date.now().toString(36).slice(-5).toUpperCase()}`],
  ]) {
    const { error } = await supabaseAdmin.from('profiles').insert({
      id,
      email,
      password_hash: hash,
      role: 'RENTER',
      first_name: 'Smoke',
      last_name: id.slice(-6),
      referral_code: code,
      terms_accepted: true,
      terms_accepted_at: ts,
      language: 'ru',
      created_at: ts,
      metadata: { e2e: tag },
    })
    if (error) throw new Error(error.message || 'PROFILE_INSERT_FAILED')
  }
}

async function insertSmokeBooking({ bookingId, renterId, partnerId, listingId }) {
  const tag = `${E2E_TEST_DATA_TAG} smoke_131_7_fraud`
  const listing_id = String(listingId || STAGE72_REUSE_LISTING_ID).trim() || STAGE72_REUSE_LISTING_ID
  const checkIn = new Date()
  checkIn.setUTCDate(checkIn.getUTCDate() + 30)
  const checkOut = new Date(checkIn)
  checkOut.setUTCDate(checkOut.getUTCDate() + 2)
  const { error } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id,
    renter_id: renterId,
    partner_id: partnerId,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: 3000,
    currency: 'THB',
    price_paid: 3300,
    exchange_rate: 1,
    commission_thb: 300,
    commission_rate: 10,
    applied_commission_rate: 10,
    partner_earnings_thb: 2700,
    guest_name: 'E2E Fraud1317',
    guest_phone: '00000001317',
    guests_count: 1,
    special_requests: tag,
    pricing_snapshot: { fee_split_v2: { platform_gross_revenue_thb: 300 } },
    metadata: { e2e_fixture: 'smoke_131_7_fraud' },
  })
  if (error) throw new Error(error.message || 'BOOKING_INSERT_FAILED')
}

/**
 * @returns {Promise<{ name: string, ok: boolean, detail: string, durationMs: number }>}
 */
export async function runReferralFraudGateSmokeStep() {
  const s = step('Referral 131.8 fraud gate + resolve')
  const t0 = Date.now()
  if (!supabaseAdmin) return fail(s, 'SUPABASE not configured', t0)

  const bookingId = makeId('bk-smoke-1317')
  const ledgerId = makeId('rfl-smoke-1317')
  const referrerId = makeId('usr-smoke-ref1317')
  const refereeId = makeId('usr-smoke-ree1317')
  const sharedDevice = `dev-smoke-1317-${Date.now().toString(36)}`
  const attrReferrerId = makeId('rattr-ref')
  const attrRefereeId = makeId('rattr-ree')
  const ctx = { bookingId, ledgerId, referrerId, refereeId, attrReferrerId, attrRefereeId, profileIds: [], fraudQueueIds: [] }

  try {
    await withSmokeRetry(() => insertSmokeProfiles(referrerId, refereeId), { label: '12g profiles' })
    await withSmokeRetry(() => insertSmokeBooking({ bookingId, renterId: refereeId, partnerId: referrerId }), {
      label: '12g booking',
    })

    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
    const { error: attrErr1 } = await supabaseAdmin.from('referral_attributions').insert({
      id: attrReferrerId,
      click_id: makeId('click-ref'),
      referrer_id: referrerId,
      referral_code: 'SMOKE1317REF',
      touch_type: 'first',
      device_hash: sharedDevice,
      status: 'clicked',
      expires_at: expiresAt,
      metadata: { e2e: 'smoke_131_7' },
    })
    if (attrErr1) throw new Error(attrErr1.message || 'ATTR_REFERRER_FAILED')

    const { error: attrErr2 } = await supabaseAdmin.from('referral_attributions').insert({
      id: attrRefereeId,
      click_id: makeId('click-ree'),
      referrer_id: referrerId,
      referral_code: 'SMOKE1317REF',
      touch_type: 'last',
      device_hash: sharedDevice,
      status: 'converted',
      converted_profile_id: refereeId,
      converted_at: new Date().toISOString(),
      expires_at: expiresAt,
      metadata: { e2e: 'smoke_131_7' },
    })
    if (attrErr2) throw new Error(attrErr2.message || 'ATTR_REFEREE_FAILED')

    const { error: insErr } = await supabaseAdmin.from('referral_ledger').insert({
      id: ledgerId,
      booking_id: bookingId,
      referrer_id: referrerId,
      referee_id: refereeId,
      amount_thb: 25,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 2,
      status: REFERRAL_STATUSES.PENDING,
      metadata: { e2e: 'smoke_131_7_fraud', split_role: 'upline_l2' },
    })
    if (insErr) throw new Error(insErr.message || 'LEDGER_INSERT_FAILED')

    const marked = await withSmokeRetry(
      () => ReferralLedgerService.markPendingAsEarned(bookingId, { referralHoldDays: 0 }),
      { label: '12g markPendingAsEarned' },
    )
    if (!marked?.fraudHeldCount || marked.fraudHeldCount < 1) {
      await cleanup(ctx)
      return fail(s, `expected fraudHeldCount>=1 got=${marked?.fraudHeldCount}`, t0)
    }

    const { data: heldRow } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,status,metadata')
      .eq('id', ledgerId)
      .maybeSingle()

    if (heldRow?.status !== REFERRAL_STATUSES.EARNED_HELD) {
      await cleanup(ctx)
      return fail(s, `status=${heldRow?.status}`, t0)
    }
    if (heldRow?.metadata?.fraud_gate_hold !== true) {
      await cleanup(ctx)
      return fail(s, 'missing fraud_gate_hold metadata', t0)
    }

    const { data: creditTx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id')
      .ilike('reference_id', `referral_ledger:${ledgerId}%`)
      .maybeSingle()
    if (creditTx?.id) {
      await cleanup(ctx)
      return fail(s, 'wallet credited despite fraud hold', t0)
    }

    const registry = await TbankPayoutRegistryService.listPendingRuBankPayoutsForRegistry()
    const leaked = (registry.exportable || []).some(
      (p) => String(p.metadata?.ledger_id || '') === ledgerId || String(p.partner_id || '') === referrerId,
    )
    if (leaked) {
      await cleanup(ctx)
      return fail(s, 'fraud-held accrual leaked into T-Bank export', t0)
    }

    const { data: accrualQueue } = await supabaseAdmin
      .from('referral_fraud_queue')
      .select('id,status,metadata')
      .eq('referrer_id', referrerId)
      .eq('status', 'open')
      .eq('source', 'accrual')
      .limit(5)
    const queueRow = (accrualQueue || []).find(
      (q) => String(q?.metadata?.ledger_id || '') === ledgerId,
    )
    if (!queueRow?.id) {
      await cleanup(ctx)
      return fail(s, 'accrual fraud-queue row missing', t0)
    }
    ctx.fraudQueueIds.push(queueRow.id)

    const resolved = await ReferralFraudResolveService.resolveFraudItem({
      id: queueRow.id,
      action: 'approved',
      note: 'smoke approve',
    })
    if (!resolved?.approvedRows?.includes(ledgerId)) {
      await cleanup(ctx)
      return fail(s, `approve missing ledger in approvedRows=${(resolved?.approvedRows || []).join(',')}`, t0)
    }

    const { data: earnedRow } = await supabaseAdmin
      .from('referral_ledger')
      .select('id,status,metadata')
      .eq('id', ledgerId)
      .maybeSingle()
    if (earnedRow?.status !== REFERRAL_STATUSES.EARNED) {
      await cleanup(ctx)
      return fail(s, `post-approve status=${earnedRow?.status}`, t0)
    }
    if (earnedRow?.metadata?.fraud_gate_resolved !== 'approved') {
      await cleanup(ctx)
      return fail(s, 'missing fraud_gate_resolved=approved', t0)
    }

    const { data: creditTxAfter } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id,amount_thb')
      .ilike('reference_id', `referral_ledger:${ledgerId}%`)
      .maybeSingle()
    if (!creditTxAfter?.id) {
      await cleanup(ctx)
      return fail(s, 'wallet not credited after fraud approve', t0)
    }

    const walletSummary = await withSmokeRetry(() => WalletService.getWalletSummary(referrerId), {
      label: '12g getWalletSummary',
    })
    const securityHeld = walletSummary?.data?.balances?.securityHeldReferralBalanceThb ?? -1
    if (securityHeld !== 0) {
      await cleanup(ctx)
      return fail(s, `securityHeldReferralBalanceThb=${securityHeld} expected 0`, t0)
    }

    const { data: profAfterApprove } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', referrerId)
      .maybeSingle()
    if (profAfterApprove?.metadata?.referral_payout_blocked === true) {
      await cleanup(ctx)
      return fail(s, 'referral_payout_blocked still true after approve', t0)
    }

    // payout fingerprint collision path (profile save blocked)
    const bankPayload = {
      recipientName: 'Smoke Test',
      inn: '7707083893',
      bik: '044525974',
      accountNumber: '40817810099910004312',
    }
    const fingerprint = computePayoutFingerprint(bankPayload)
    const otherPartnerId = makeId('usr-smoke-other1317')
    ctx.profileIds = [makeId('ppp-a'), makeId('ppp-b')]
    ctx.otherPartnerId = otherPartnerId

    await withSmokeRetry(
      async () => {
        const { error } = await supabaseAdmin.from('profiles').insert({
          id: otherPartnerId,
          email: `${otherPartnerId}@smoke.invalid`,
          password_hash: bcrypt.hashSync('smoke-1317-other', 8),
          role: 'RENTER',
          first_name: 'Other',
          last_name: 'Partner',
          referral_code: `OP${Date.now().toString(36).slice(-5).toUpperCase()}`,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          language: 'ru',
          metadata: { e2e: 'smoke_131_7_fp' },
        })
        if (error) throw new Error(`fp collision profile insert: ${error.message}`)
      },
      { label: '12g-fp-other-profile' },
    )

    await withSmokeRetry(
      async () => {
        const { error } = await supabaseAdmin.from('partner_payout_profiles').insert({
          id: ctx.profileIds[0],
          partner_id: otherPartnerId,
          method_id: 'pm-bank-ru',
          data: bankPayload,
          payout_fingerprint: fingerprint,
          is_verified: true,
          is_default: true,
        })
        if (error) throw new Error(`fp collision payout-profile insert: ${error.message}`)
      },
      { label: '12g-fp-collision-profile' },
    )

    const fpGate = await ReferralFraudGate.evaluatePayoutProfileSave({
      partnerId: referrerId,
      profileData: bankPayload,
    })
    if (fpGate.ok) {
      await cleanup({ ...ctx, refereeId: otherPartnerId })
      await cleanup(ctx)
      return fail(s, 'expected PAYOUT_FINGERPRINT_COLLISION block', t0)
    }

    const { data: blockedProf } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', referrerId)
      .maybeSingle()
    if (blockedProf?.metadata?.referral_payout_blocked !== true) {
      await supabaseAdmin.from('profiles').delete().eq('id', otherPartnerId)
      await cleanup(ctx)
      return fail(s, 'referral_payout_blocked not set', t0)
    }

    await supabaseAdmin.from('partner_payout_profiles').delete().eq('id', ctx.profileIds[0])
    await supabaseAdmin.from('profiles').delete().eq('id', otherPartnerId)
    await assertWalletBucketIntegrity(referrerId, { label: '12g-referrer' })
    await cleanup(ctx)

    return pass(
      s,
      `device_hash→held→approve→earned wallet=${creditTxAfter.amount_thb} securityHeld=0 fp=collision`,
      t0,
    )
  } catch (e) {
    await cleanup(ctx)
    return fail(s, e?.message || String(e), t0)
  }
}

export default { runReferralFraudGateSmokeStep }
