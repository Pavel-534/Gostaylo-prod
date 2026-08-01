/**
 * AUDIT_LEDGER_01 — staging smoke: first ledger posting after Stage 203.
 *
 * Path: PENDING → CONFIRMED → moveToEscrow (PAID_ESCROW + booking_payment_capture) →
 * balanced 5-leg journal → audit SQL §8.1–8.3 → dispute hold on la-sys-dispute-hold.
 *
 * Usage:
 *   npm run smoke:ledger-first-posting
 *   npm run smoke:ledger-first-posting -- --skip-cleanup
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (same as financial / audit02 smokes).
 * Does not mutate balance.service.js or escrow RPC.
 */

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import EscrowService from '@/lib/services/escrow.service.js'
import { postDisputePartnerFundsHold } from '@/lib/services/ledger/dispute-hold.js'
import { ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import { LEDGER_ACC } from '@/lib/services/ledger/ledger-shared.js'
import { smokeTransitionBookingStatus } from '@/lib/smoke/smoke-booking-status.js'

const TAG = `${E2E_TEST_DATA_TAG} ledger-first-posting-smoke`
const LISTING_ID = 'lst-ledger-first-smoke'
const DISPUTE_HOLD_ACCOUNT_ID = LEDGER_ACC.disputeHold || 'la-sys-dispute-hold'

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0 }
}
function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0)
}
function pass(s, detail = 'OK', t0) {
  s.ok = true
  s.detail = detail
  if (t0 != null) markDuration(s, t0)
  return s
}
function fail(s, detail, t0) {
  s.ok = false
  s.detail = String(detail || 'failed').slice(0, 800)
  if (t0 != null) markDuration(s, t0)
  return s
}
function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function finalize(steps, context, runStartedAt) {
  return {
    ok: steps.every((s) => s.ok),
    steps,
    context: {
      ...context,
      durationMs: Math.max(0, Date.now() - runStartedAt),
    },
  }
}

/**
 * AUDIT_LEDGER_01 §8.1 — unbalanced journals (global).
 * @returns {Promise<{ count: number, sample: object[] }>}
 */
async function queryUnbalancedJournals() {
  const { data: journals, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, idempotency_key, booking_id, event_type')
  if (jErr) throw new Error(jErr.message)

  const unbalanced = []
  for (const j of journals || []) {
    const { data: entries, error: eErr } = await supabaseAdmin
      .from('ledger_entries')
      .select('side, amount_thb')
      .eq('journal_id', j.id)
    if (eErr) throw new Error(eErr.message)
    if (!entries?.length) continue
    let dr = 0
    let cr = 0
    for (const e of entries) {
      const amt = round2(e.amount_thb)
      if (e.side === 'DEBIT') dr += amt
      else cr += amt
    }
    if (Math.abs(round2(dr - cr)) > 0.02) {
      unbalanced.push({
        id: j.id,
        idempotency_key: j.idempotency_key,
        booking_id: j.booking_id,
        dr: round2(dr),
        cr: round2(cr),
      })
    }
  }
  return { count: unbalanced.length, sample: unbalanced.slice(0, 5) }
}

/** AUDIT_LEDGER_01 §8.2 */
async function queryPaidEscrowMissingCapture() {
  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('status', 'PAID_ESCROW')
    .limit(200)
  if (error) throw new Error(error.message)

  const missing = []
  for (const b of rows || []) {
    const key = `booking_payment_capture:${b.id}`
    const { data: j } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', key)
      .maybeSingle()
    if (!j?.id) missing.push(b.id)
  }
  return { count: missing.length, sample: missing.slice(0, 5) }
}

/** AUDIT_LEDGER_01 §8.3 */
async function queryPaidPayoutsMissingObligation() {
  const { data: rows, error } = await supabaseAdmin
    .from('payouts')
    .select('id, status')
    .eq('status', 'PAID')
    .limit(200)
  if (error) {
    if (String(error.message || '').includes('does not exist')) {
      return { count: 0, sample: [], skipped: true }
    }
    throw new Error(error.message)
  }

  const missing = []
  for (const p of rows || []) {
    const key = `payout_obligation_settled:${p.id}`
    const { data: j } = await supabaseAdmin
      .from('ledger_journals')
      .select('id')
      .eq('idempotency_key', key)
      .maybeSingle()
    if (!j?.id) missing.push(p.id)
  }
  return { count: missing.length, sample: missing.slice(0, 5) }
}

/**
 * @param {{ skipCleanup?: boolean, priceThb?: number, commissionRate?: number }} [opts]
 */
export async function runLedgerFirstPostingSmoke(opts = {}) {
  process.env.SMOKE_FINANCIAL_RUN = '1'
  const runStartedAt = Date.now()
  const steps = []
  const priceThb = Math.max(500, Number(opts.priceThb) || 2500)
  const commissionRate = Math.max(0, Number(opts.commissionRate) || 10)
  const commissionThb = Math.round((priceThb * commissionRate) / 100)
  const partnerNet = Math.max(0, priceThb - commissionThb)
  const guestTotalThb = priceThb + commissionThb

  const context = {
    tag: TAG,
    listingId: LISTING_ID,
    simulation: { priceThb, commissionRate, commissionThb, partnerNet, guestTotalThb },
  }

  let t0 = Date.now()
  const sEnv = step('1. Env + dispute-hold account')
  steps.push(sEnv)
  if (!supabaseAdmin) {
    fail(sEnv, 'SUPABASE not configured', t0)
    return finalize(steps, context, runStartedAt)
  }
  const { data: holdAcc, error: holdErr } = await supabaseAdmin
    .from('ledger_accounts')
    .select('id, code')
    .eq('id', DISPUTE_HOLD_ACCOUNT_ID)
    .maybeSingle()
  if (holdErr || !holdAcc?.id) {
    fail(
      sEnv,
      `missing ${DISPUTE_HOLD_ACCOUNT_ID} — apply stage203_01_seed_dispute_hold_account.sql`,
      t0,
    )
    return finalize(steps, context, runStartedAt)
  }
  pass(sEnv, `${holdAcc.code}`, t0)

  let guestId
  let partnerId
  let bookingId
  let disputeId

  try {
    t0 = Date.now()
    const sClean = step('2. Cleanup prior smoke listing bookings')
    steps.push(sClean)
    if (!opts.skipCleanup) {
      const { data: old } = await supabaseAdmin.from('bookings').select('id').eq('listing_id', LISTING_ID)
      const ids = (old || []).map((b) => b.id).filter(Boolean)
      // Append-only: do not DELETE ledger_*; booking DELETE stamps deleted_booking_id (Stage 203.02)
      if (ids.length) {
        await supabaseAdmin.from('bookings').delete().in('id', ids)
      }
    }
    pass(sClean, opts.skipCleanup ? 'skipped' : 'prior bookings removed (journals retained)', t0)

    t0 = Date.now()
    const sProfiles = step('3. Guest + partner profiles')
    steps.push(sProfiles)
    guestId = makeId('user-smoke-ledger-guest')
    partnerId = makeId('user-smoke-ledger-partner')
    const hash = bcrypt.hashSync('smoke-ledger-pass', 8)
    const ts = new Date().toISOString()
    const { error: pErr } = await supabaseAdmin.from('profiles').upsert(
      [
        {
          id: guestId,
          email: `${guestId}@smoke.invalid`,
          password_hash: hash,
          role: 'RENTER',
          first_name: 'LedgerSmokeGuest',
          referral_code: `LG${Date.now().toString(36).slice(-6).toUpperCase()}`,
          terms_accepted: true,
          terms_accepted_at: ts,
          is_verified: true,
          language: 'ru',
        },
        {
          id: partnerId,
          email: `${partnerId}@smoke.invalid`,
          password_hash: hash,
          role: 'PARTNER',
          first_name: 'LedgerSmokePartner',
          referral_code: `LP${Date.now().toString(36).slice(-6).toUpperCase()}`,
          terms_accepted: true,
          terms_accepted_at: ts,
          partner_terms_accepted_at: ts,
          is_verified: true,
          verification_status: 'VERIFIED',
          language: 'ru',
        },
      ],
      { onConflict: 'id' },
    )
    if (pErr) {
      fail(sProfiles, pErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.guestId = guestId
    context.partnerId = partnerId
    pass(sProfiles, partnerId.slice(0, 22) + '…', t0)

    t0 = Date.now()
    const sListing = step('4. Listing')
    steps.push(sListing)
    const { data: cat } = await supabaseAdmin.from('categories').select('id').limit(1).maybeSingle()
    if (!cat?.id) {
      fail(sListing, 'no category', t0)
      return finalize(steps, context, runStartedAt)
    }
    const { error: lErr } = await supabaseAdmin.from('listings').upsert(
      {
        id: LISTING_ID,
        owner_id: partnerId,
        category_id: cat.id,
        status: 'ACTIVE',
        title: `${TAG} listing`,
        description: TAG,
        district: 'Smoke',
        base_price_thb: priceThb,
        commission_rate: commissionRate,
        images: [],
        available: true,
        instant_booking: true,
        max_capacity: 2,
        metadata: withFintechTestDataMeta({
          test_data_tag: E2E_TEST_DATA_TAG,
          timezone: 'Asia/Bangkok',
        }),
      },
      { onConflict: 'id' },
    )
    if (lErr) {
      fail(sListing, lErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sListing, LISTING_ID, t0)

    t0 = Date.now()
    const sPending = step('5. Booking PENDING')
    steps.push(sPending)
    bookingId = randomUUID()
    const checkIn = new Date()
    checkIn.setUTCDate(checkIn.getUTCDate() + 21)
    const checkOut = new Date(checkIn)
    checkOut.setUTCDate(checkOut.getUTCDate() + 2)
    const { error: bErr } = await supabaseAdmin.from('bookings').insert({
      id: bookingId,
      listing_id: LISTING_ID,
      renter_id: guestId,
      partner_id: partnerId,
      status: 'PENDING',
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      price_thb: guestTotalThb,
      currency: 'THB',
      price_paid: guestTotalThb,
      exchange_rate: 1,
      commission_thb: commissionThb,
      commission_rate: commissionRate,
      applied_commission_rate: commissionRate,
      partner_earnings_thb: partnerNet,
      taxable_margin_amount: commissionThb,
      rounding_diff_pot: 0,
      guest_name: 'Ledger Smoke Guest',
      guest_email: `${guestId}@smoke.invalid`,
      guests_count: 1,
      special_requests: TAG,
      pricing_snapshot: {
        v: 2,
        final_breakdown: { total_guest_payable_rounded_thb: guestTotalThb },
        fee_split_v2: {
          guest_service_fee_thb: commissionThb,
          guest_payable_rounded_thb: guestTotalThb,
          partner_netto_thb: partnerNet,
          platform_gross_revenue_thb: commissionThb,
        },
      },
      metadata: withFintechTestDataMeta({
        test_data_tag: E2E_TEST_DATA_TAG,
        ledger_first_posting_smoke: true,
      }),
    })
    if (bErr) {
      fail(sPending, bErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.bookingId = bookingId
    pass(sPending, bookingId.slice(0, 12) + '… PENDING', t0)

    t0 = Date.now()
    const sConfirmed = step('6. Partner confirm → CONFIRMED')
    steps.push(sConfirmed)
    const confRes = await smokeTransitionBookingStatus(bookingId, 'CONFIRMED', {
      scope: 'partner',
      actorId: partnerId,
      trigger: 'smoke_ledger_first_confirm',
    })
    if (!confRes.success) {
      fail(sConfirmed, confRes.error || 'CONFIRMED transition failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    if (String(confRes.booking?.status || confRes.newStatus || '').toUpperCase() !== 'CONFIRMED') {
      fail(sConfirmed, `expected CONFIRMED, got ${confRes.booking?.status || confRes.newStatus}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sConfirmed, 'CONFIRMED', t0)

    t0 = Date.now()
    const sEscrow = step('7. Promote → PAID_ESCROW (moveToEscrow / capture journal)')
    steps.push(sEscrow)
    const escrow = await EscrowService.moveToEscrow(bookingId, {
      source: 'ledger_first_posting_smoke',
      captureGuestTotalThb: guestTotalThb,
      txId: `smoke-ledger-${bookingId.slice(0, 8)}`,
    })
    if (!escrow?.success) {
      fail(sEscrow, escrow?.error || 'moveToEscrow failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: paidRow } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle()
    if (String(paidRow?.status || '').toUpperCase() !== 'PAID_ESCROW') {
      fail(sEscrow, `expected PAID_ESCROW, got ${paidRow?.status}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sEscrow, `PAID_ESCROW journal=${escrow.journalId || 'rpc'}`, t0)

    t0 = Date.now()
    const sJournal = step('8. Capture journal + 5 balanced entries')
    steps.push(sJournal)
    const idempotencyKey = `booking_payment_capture:${bookingId}`
    const { data: journal, error: jErr } = await supabaseAdmin
      .from('ledger_journals')
      .select('id, event_type, idempotency_key, booking_id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (jErr || !journal?.id) {
      fail(sJournal, jErr?.message || `missing journal ${idempotencyKey}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.journalId = journal.id
    const { data: entries, error: eErr } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, account_id, side, amount_thb')
      .eq('journal_id', journal.id)
    if (eErr) {
      fail(sJournal, eErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    const lines = entries || []
    if (lines.length !== 5) {
      fail(sJournal, `expected 5 entries, got ${lines.length}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    let dr = 0
    let cr = 0
    for (const e of lines) {
      const amt = round2(e.amount_thb)
      if (e.side === 'DEBIT') dr += amt
      else cr += amt
    }
    dr = round2(dr)
    cr = round2(cr)
    if (Math.abs(dr - cr) > 0.02) {
      fail(sJournal, `unbalanced dr=${dr} cr=${cr}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    if (Math.abs(dr - guestTotalThb) > 0.02) {
      fail(sJournal, `debit total ${dr} ≠ guestTotal ${guestTotalThb}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sJournal, `${journal.id} · 5 legs · dr=cr=${dr}`, t0)

    t0 = Date.now()
    const sAudit = step('9. AUDIT_LEDGER_01 §8.1–8.3 (0 rows)')
    steps.push(sAudit)
    const u = await queryUnbalancedJournals()
    const mCap = await queryPaidEscrowMissingCapture()
    const mPay = await queryPaidPayoutsMissingObligation()
    context.auditSql = {
      unbalancedJournals: u.count,
      paidEscrowMissingCapture: mCap.count,
      paidPayoutMissingObligation: mPay.count,
    }
    if (u.count > 0) {
      fail(sAudit, `§8.1 unbalanced=${u.count} sample=${JSON.stringify(u.sample)}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    if (mCap.count > 0) {
      fail(sAudit, `§8.2 PAID_ESCROW missing capture=${mCap.count} ${mCap.sample.join(',')}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    if (mPay.count > 0) {
      fail(sAudit, `§8.3 PAID payout missing obligation=${mPay.count}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sAudit, '§8.1–8.3 empty', t0)

    t0 = Date.now()
    const sDispute = step('10. Dispute hold → la-sys-dispute-hold')
    steps.push(sDispute)
    await ensurePartnerLedgerAccount(partnerId)
    disputeId = `dsp-ledger-smoke-${bookingId.slice(0, 8)}`
    const holdAmt = round2(Math.min(partnerNet, Math.max(100, partnerNet * 0.5)))
    const hold = await postDisputePartnerFundsHold({
      bookingId,
      partnerId,
      disputeId,
      amountThb: holdAmt,
    })
    if (!hold?.success) {
      fail(sDispute, hold?.error || 'postDisputePartnerFundsHold failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: holdEntries, error: heErr } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, account_id, side, amount_thb')
      .eq('journal_id', hold.journalId || `lj-dsp-hold-${disputeId}`)
    if (heErr) {
      fail(sDispute, heErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    const usedHold = (holdEntries || []).some(
      (e) => e.account_id === DISPUTE_HOLD_ACCOUNT_ID && e.side === 'CREDIT',
    )
    if (!usedHold) {
      fail(sDispute, `no CREDIT on ${DISPUTE_HOLD_ACCOUNT_ID}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.disputeId = disputeId
    context.disputeJournalId = hold.journalId
    pass(sDispute, `hold ${holdAmt} THB → ${DISPUTE_HOLD_ACCOUNT_ID}`, t0)

    if (!opts.skipCleanup) {
      t0 = Date.now()
      const sOut = step('11. Soft cleanup (booking delete; ledger append-only)')
      steps.push(sOut)
      await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
      // listing may stay for next run upsert
      pass(sOut, 'booking removed; journals kept (deleted_booking_id)', t0)
    }
  } catch (e) {
    const s = step('X. Unhandled')
    steps.push(s)
    fail(s, e?.message || String(e))
  }

  return finalize(steps, context, runStartedAt)
}
