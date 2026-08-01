/**
 * ADR-203 Phase 1 — financial dry run: status vs ledger shadow on FannRent.
 *
 * Path:
 *   PENDING → CONFIRMED → PAID_ESCROW (capture) → shadow compare
 *   → force THAWED/READY_FOR_PAYOUT → payout PENDING → admin PAID → shadow compare
 *   → COMPLETED (optional) → shadow compare
 *
 * Usage:
 *   npm run smoke:ledger-shadow-dry-run
 *   npm run smoke:ledger-shadow-dry-run -- --skip-payout
 *
 * Does not mutate balance.service.js. Leaves [E2E_TEST_DATA] rows (no hard cleanup of money bookings).
 */

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import EscrowService from '@/lib/services/escrow.service.js'
import { ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import { comparePartnerLedgerShadow } from '@/lib/ops/ledger-shadow-reconcile.js'
import LedgerService from '@/lib/services/ledger.service.js'
import {
  smokePromoteEscrowToReadyForPayout,
  smokeTransitionBookingStatus,
} from '@/lib/smoke/smoke-booking-status.js'

const TAG = `${E2E_TEST_DATA_TAG} ledger-shadow-dry-run`
const LISTING_ID = 'lst-ledger-shadow-dry'

function step(name) {
  return { name, ok: false, detail: '', durationMs: 0, payload: null }
}
function markDuration(s, t0) {
  s.durationMs = Math.max(0, Date.now() - t0)
}
function pass(s, detail = 'OK', t0, payload = null) {
  s.ok = true
  s.detail = detail
  s.payload = payload
  if (t0 != null) markDuration(s, t0)
  return s
}
function fail(s, detail, t0, payload = null) {
  s.ok = false
  s.detail = String(detail || 'failed').slice(0, 1200)
  s.payload = payload
  if (t0 != null) markDuration(s, t0)
  return s
}
function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100
}

function summarizeShadow(cmp) {
  if (!cmp?.success) return { error: cmp?.error || 'shadow_failed' }
  return {
    withinTolerance: cmp.withinTolerance,
    absMaxDeltaThb: cmp.absMaxDeltaThb,
    statusDerived: {
      availableThb: cmp.statusDerived.availableThb,
      frozenThb: cmp.statusDerived.frozenThb,
      totalThb: cmp.statusDerived.totalThb,
      pendingPayoutReserveThb: cmp.statusDerived.pendingPayoutReserveThb,
      thawHoldBalanceThb: cmp.statusDerived.thawHoldBalanceThb,
      disputeHoldBalanceThb: cmp.statusDerived.disputeHoldBalanceThb,
    },
    ledgerDerived: {
      availableThb: cmp.ledgerDerived.availableThb,
      frozenThb: cmp.ledgerDerived.frozenThb,
      totalThb: cmp.ledgerDerived.totalThb,
      accountNetThb: cmp.ledgerDerived.accountNetThb,
      earningsThb: cmp.ledgerDerived.earningsThb,
      payoutsThb: cmp.ledgerDerived.payoutsThb,
      holdsThb: cmp.ledgerDerived.holdsThb,
    },
    delta: cmp.delta,
  }
}

/**
 * @param {{ skipPayout?: boolean, priceThb?: number, commissionThb?: number }} [opts]
 */
export async function runLedgerShadowDryRun(opts = {}) {
  process.env.SMOKE_FINANCIAL_RUN = '1'
  const runStartedAt = Date.now()
  const steps = []
  const priceThb = round2(Number(opts.priceThb) || 1000)
  const commissionThb = round2(Number(opts.commissionThb) || 150)
  const partnerEarningsThb = round2(priceThb - commissionThb)
  const guestTotalThb = round2(priceThb + commissionThb)

  const context = {
    tag: TAG,
    listingId: LISTING_ID,
    simulation: { priceThb, commissionThb, partnerEarningsThb, guestTotalThb },
    shadows: [],
  }

  let t0 = Date.now()
  const sEnv = step('1. Env')
  steps.push(sEnv)
  if (!supabaseAdmin) {
    fail(sEnv, 'SUPABASE not configured', t0)
    return { ok: false, steps, context }
  }
  pass(sEnv, 'ok', t0)

  let guestId
  let partnerId
  let bookingId
  let journalId
  let payoutId

  try {
    t0 = Date.now()
    const sProfiles = step('2. Guest + partner profiles')
    steps.push(sProfiles)
    guestId = makeId('user-smoke-shadow-guest')
    partnerId = makeId('user-smoke-shadow-partner')
    context.guestId = guestId
    context.partnerId = partnerId
    const hash = bcrypt.hashSync('smoke-shadow-pass', 8)
    const ts = new Date().toISOString()
    const { error: pErr } = await supabaseAdmin.from('profiles').upsert(
      [
        {
          id: guestId,
          email: `${guestId}@smoke.invalid`,
          password_hash: hash,
          role: 'RENTER',
          first_name: 'ShadowDryGuest',
          referral_code: `SG${Date.now().toString(36).slice(-6).toUpperCase()}`,
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
          first_name: 'ShadowDryPartner',
          referral_code: `SP${Date.now().toString(36).slice(-6).toUpperCase()}`,
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
      return { ok: false, steps, context }
    }
    await ensurePartnerLedgerAccount(partnerId)
    pass(sProfiles, `guest=${guestId} partner=${partnerId}`, t0)

    t0 = Date.now()
    const sListing = step('3. ACTIVE listing')
    steps.push(sListing)
    const { data: cat } = await supabaseAdmin.from('categories').select('id').limit(1).maybeSingle()
    if (!cat?.id) {
      fail(sListing, 'no category', t0)
      return { ok: false, steps, context }
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
        commission_rate: round2((commissionThb / priceThb) * 100),
        images: [],
        available: true,
        instant_booking: true,
        max_capacity: 2,
        metadata: withFintechTestDataMeta({
          test_data_tag: E2E_TEST_DATA_TAG,
          smoke: 'ledger-shadow-dry',
          timezone: 'Asia/Bangkok',
        }),
      },
      { onConflict: 'id' },
    )
    if (lErr) {
      fail(sListing, lErr.message, t0)
      return { ok: false, steps, context }
    }
    pass(sListing, LISTING_ID, t0)

    t0 = Date.now()
    const sBook = step('4. Booking PENDING (1000/150/850)')
    steps.push(sBook)
    bookingId = randomUUID()
    context.bookingId = bookingId
    const checkIn = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const checkOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { error: bErr } = await supabaseAdmin.from('bookings').insert({
      id: bookingId,
      listing_id: LISTING_ID,
      renter_id: guestId,
      partner_id: partnerId,
      status: 'PENDING',
      check_in: checkIn,
      check_out: checkOut,
      price_thb: priceThb,
      price_paid: guestTotalThb,
      commission_thb: commissionThb,
      partner_earnings_thb: partnerEarningsThb,
      commission_rate: round2((commissionThb / priceThb) * 100),
      applied_commission_rate: round2((commissionThb / priceThb) * 100),
      taxable_margin_amount: commissionThb,
      rounding_diff_pot: 0,
      currency: 'THB',
      listing_currency: 'THB',
      exchange_rate: 1,
      guests_count: 1,
      guest_name: 'Shadow Dry Guest',
      guest_email: `${guestId}@smoke.invalid`,
      special_requests: TAG,
      pricing_snapshot: {
        v: 2,
        final_breakdown: { total_guest_payable_rounded_thb: guestTotalThb },
        fee_split_v2: {
          guest_service_fee_thb: commissionThb,
          guest_payable_rounded_thb: guestTotalThb,
          partner_netto_thb: partnerEarningsThb,
          platform_gross_revenue_thb: commissionThb,
        },
      },
      metadata: withFintechTestDataMeta({
        test_data_tag: E2E_TEST_DATA_TAG,
        smoke: 'ledger-shadow-dry',
        payment_verification: { captureGuestTotalThb: guestTotalThb },
      }),
    })
    if (bErr) {
      fail(sBook, bErr.message, t0)
      return { ok: false, steps, context }
    }
    pass(sBook, bookingId, t0)

    t0 = Date.now()
    const sConf = step('5. PENDING → CONFIRMED')
    steps.push(sConf)
    const confRes = await smokeTransitionBookingStatus(bookingId, 'CONFIRMED', {
      scope: 'partner',
      actorId: partnerId,
      trigger: 'smoke_ledger_shadow_confirm',
    })
    if (!confRes.success) {
      fail(sConf, confRes.error || 'CONFIRMED transition failed', t0)
      return { ok: false, steps, context }
    }
    pass(sConf, 'CONFIRMED', t0)

    t0 = Date.now()
    const sEscrow = step('6. moveToEscrow → PAID_ESCROW + capture journal')
    steps.push(sEscrow)
    const escrow = await EscrowService.moveToEscrow(bookingId, {
      source: 'ledger_shadow_dry_run',
      skipNotifications: true,
    })
    if (!escrow?.success) {
      fail(sEscrow, escrow?.error || 'moveToEscrow failed', t0, escrow)
      return { ok: false, steps, context }
    }
    const { data: j } = await supabaseAdmin
      .from('ledger_journals')
      .select('id, idempotency_key, event_type')
      .eq('idempotency_key', `booking_payment_capture:${bookingId}`)
      .maybeSingle()
    if (!j?.id) {
      fail(sEscrow, 'capture journal missing', t0)
      return { ok: false, steps, context }
    }
    journalId = j.id
    context.journalId = journalId
    const { data: entries } = await supabaseAdmin
      .from('ledger_entries')
      .select('side, amount_thb, account_id')
      .eq('journal_id', journalId)
    let dr = 0
    let cr = 0
    for (const e of entries || []) {
      const amt = round2(e.amount_thb)
      if (e.side === 'DEBIT') dr += amt
      else cr += amt
    }
    dr = round2(dr)
    cr = round2(cr)
    if ((entries || []).length < 2 || Math.abs(dr - cr) > 0.02) {
      fail(sEscrow, `unbalanced entries n=${entries?.length} dr=${dr} cr=${cr}`, t0, { entries })
      return { ok: false, steps, context }
    }
    pass(
      sEscrow,
      `journal=${journalId} entries=${entries.length} dr=cr=${dr}`,
      t0,
      { journalId, entryCount: entries.length, dr, cr },
    )

    t0 = Date.now()
    const sShadow1 = step('7. Shadow after PAID_ESCROW')
    steps.push(sShadow1)
    const shadow1 = await comparePartnerLedgerShadow(partnerId)
    const sum1 = summarizeShadow(shadow1)
    context.shadows.push({ step: 'after_paid_escrow', ...sum1 })
    if (!shadow1.success) {
      fail(sShadow1, shadow1.error, t0, sum1)
      return { ok: false, steps, context }
    }
    if (!shadow1.withinTolerance) {
      fail(
        sShadow1,
        `drift absMax=฿${shadow1.absMaxDeltaThb} delta=${JSON.stringify(shadow1.delta)}`,
        t0,
        sum1,
      )
      return { ok: false, steps, context }
    }
    pass(
      sShadow1,
      `zeroDrift frozen=${shadow1.statusDerived.frozenThb} available=${shadow1.statusDerived.availableThb}`,
      t0,
      sum1,
    )

    if (opts.skipPayout) {
      context.durationMs = Date.now() - runStartedAt
      return { ok: steps.every((s) => s.ok), steps, context }
    }

    t0 = Date.now()
    const sThaw = step('8. Force READY_FOR_PAYOUT (skip thaw wait)')
    steps.push(sThaw)
    const thawedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const readyRes = await smokePromoteEscrowToReadyForPayout(bookingId, {
      thawAtIso: thawedAt,
      trigger: 'smoke_ledger_shadow_ready',
      metadata: withFintechTestDataMeta({
        test_data_tag: E2E_TEST_DATA_TAG,
        smoke: 'ledger-shadow-dry',
        payment_verification: { captureGuestTotalThb: guestTotalThb },
        escrow_thawed_at: thawedAt,
        escrow_thaw_at: thawedAt,
      }),
    })
    if (!readyRes.success) {
      fail(sThaw, readyRes.error || 'READY_FOR_PAYOUT transition failed', t0)
      return { ok: false, steps, context }
    }
    pass(sThaw, 'READY_FOR_PAYOUT', t0)

    t0 = Date.now()
    const sShadow2 = step('9. Shadow after READY_FOR_PAYOUT')
    steps.push(sShadow2)
    const shadow2 = await comparePartnerLedgerShadow(partnerId)
    const sum2 = summarizeShadow(shadow2)
    context.shadows.push({ step: 'after_ready_for_payout', ...sum2 })
    if (!shadow2.success || !shadow2.withinTolerance) {
      fail(
        sShadow2,
        shadow2.success
          ? `drift absMax=฿${shadow2.absMaxDeltaThb} delta=${JSON.stringify(shadow2.delta)}`
          : shadow2.error,
        t0,
        sum2,
      )
      // continue to payout for diagnostics unless hard fail preferred — fail closed
      return { ok: false, steps, context }
    }
    pass(
      sShadow2,
      `zeroDrift available=${shadow2.statusDerived.availableThb} frozen=${shadow2.statusDerived.frozenThb}`,
      t0,
      sum2,
    )

    t0 = Date.now()
    const sPay = step('10. Insert payout PENDING → mark PAID (ledger settle)')
    steps.push(sPay)
    payoutId = `po-shadow-dry-${Date.now().toString(36)}`
    context.payoutId = payoutId
    const amountThb = round2(shadow2.statusDerived.availableThb || partnerEarningsThb)
    const { error: poErr } = await supabaseAdmin.from('payouts').insert({
      id: payoutId,
      partner_id: partnerId,
      amount: amountThb,
      gross_amount: amountThb,
      final_amount: amountThb,
      currency: 'THB',
      payout_currency: 'THB',
      status: 'PENDING',
      metadata: withFintechTestDataMeta({
        test_data_tag: E2E_TEST_DATA_TAG,
        smoke: 'ledger-shadow-dry',
        booking_id: bookingId,
      }),
    })
    if (poErr) {
      fail(sPay, `payout insert: ${poErr.message}`, t0)
      return { ok: false, steps, context }
    }

    const shadowPending = await comparePartnerLedgerShadow(partnerId)
    context.shadows.push({ step: 'after_payout_pending', ...summarizeShadow(shadowPending) })

    const { data: payoutRow } = await supabaseAdmin.from('payouts').select('*').eq('id', payoutId).maybeSingle()
    const ledger = await LedgerService.postPartnerPayoutObligationSettled(payoutRow)
    if (!ledger?.success && !ledger?.skipped) {
      fail(sPay, `settle ledger: ${ledger?.error || 'failed'}`, t0, ledger)
      return { ok: false, steps, context }
    }
    const { error: paidErr } = await supabaseAdmin
      .from('payouts')
      .update({
        status: 'PAID',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutId)
    if (paidErr) {
      fail(sPay, `payout PAID: ${paidErr.message}`, t0)
      return { ok: false, steps, context }
    }
    pass(sPay, `payout=${payoutId} amount=฿${amountThb} journal=${ledger?.journalId || 'skipped'}`, t0, {
      payoutId,
      amountThb,
      ledger,
    })

    t0 = Date.now()
    const sShadow3 = step('11. Shadow after payout PAID (booking still READY)')
    steps.push(sShadow3)
    const shadow3 = await comparePartnerLedgerShadow(partnerId)
    const sum3 = summarizeShadow(shadow3)
    context.shadows.push({ step: 'after_payout_paid_booking_ready', ...sum3 })
    // Phase 1 bucket model: status+ledger available still show capture until COMPLETED;
    // accountNet drops — expected dual-SSOT signal, available/frozen should still match.
    if (!shadow3.success || !shadow3.withinTolerance) {
      fail(
        sShadow3,
        shadow3.success
          ? `drift absMax=฿${shadow3.absMaxDeltaThb} (expected zero on buckets; accountNet=${shadow3.ledgerDerived?.accountNetThb})`
          : shadow3.error,
        t0,
        sum3,
      )
      return { ok: false, steps, context }
    }
    pass(
      sShadow3,
      `zeroDrift buckets; accountNet=฿${shadow3.ledgerDerived.accountNetThb} payouts=฿${shadow3.ledgerDerived.payoutsThb}`,
      t0,
      sum3,
    )

    t0 = Date.now()
    const sDone = step('12. COMPLETED booking → shadow (available should fall)')
    steps.push(sDone)
    const doneRes = await smokeTransitionBookingStatus(bookingId, 'COMPLETED', {
      scope: 'system',
      trigger: 'smoke_ledger_shadow_completed',
    })
    if (!doneRes.success) {
      fail(sDone, doneRes.error || 'COMPLETED transition failed', t0)
      return { ok: false, steps, context }
    }
    const shadow4 = await comparePartnerLedgerShadow(partnerId)
    const sum4 = summarizeShadow(shadow4)
    context.shadows.push({ step: 'after_booking_completed', ...sum4 })
    if (!shadow4.success || !shadow4.withinTolerance) {
      fail(
        sDone,
        shadow4.success
          ? `drift absMax=฿${shadow4.absMaxDeltaThb} delta=${JSON.stringify(shadow4.delta)}`
          : shadow4.error,
        t0,
        sum4,
      )
      return { ok: false, steps, context }
    }
    if (round2(shadow4.statusDerived.availableThb) !== 0 || round2(shadow4.statusDerived.frozenThb) !== 0) {
      fail(sDone, `expected zero buckets after COMPLETED, got ${JSON.stringify(sum4.statusDerived)}`, t0, sum4)
      return { ok: false, steps, context }
    }
    pass(sDone, 'zeroDrift available=0 frozen=0 after COMPLETED', t0, sum4)

    context.durationMs = Date.now() - runStartedAt
    context.verdict = {
      shadowReadyForPhase1Gate: true,
      note:
        'zeroDrift on status↔ledger buckets at PAID_ESCROW, READY, PAID-payout, COMPLETED. Ledger SoT flip still blocked until 30d proof + Phase 2/3.',
    }
    return { ok: steps.every((s) => s.ok), steps, context }
  } catch (e) {
    const sCrash = step('crash')
    steps.push(sCrash)
    fail(sCrash, e?.message || String(e), Date.now())
    context.durationMs = Date.now() - runStartedAt
    return { ok: false, steps, context }
  }
}
