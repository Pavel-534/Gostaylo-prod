/**
 * AUDIT_02 — critical-path regression smoke (DB + services).
 *
 * Covers: chat invoice sync → Concierge pool → partial settle → repair →
 * dispute SKIPPED → re-queue → referral unlock/credit.
 *
 * Usage:
 *   npm run smoke:audit02
 *   node scripts/smoke-audit02-regression.mjs --skip-cleanup
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, stage201_01 + stage201_02 RPCs for held/settle lock.
 */

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import { syncBookingForPayableChatInvoice } from '@/lib/chat/sync-booking-for-chat-invoice.server.js'
import { guestPayableRoundedThbFromBooking } from '@/lib/booking-price-integrity.js'
import { calculateCommissionFromGuestPayable } from '@/lib/services/pricing/pricing-fee-policy.js'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js'
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js'
import { computeReferralUnlockAt } from '@/lib/services/marketing/referral-hold.service.js'
import { TBANK_REGISTRY_METHOD_ID } from '@/lib/services/tbank-payout-registry.service.js'
import {
  smokeForceBookingStatusNegativeTest,
  smokeTransitionBookingStatus,
} from '@/lib/smoke/smoke-booking-status.js'

const TAG = `${E2E_TEST_DATA_TAG} audit02-regression`
const LISTING_ID = 'lst-audit02-smoke'

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

function finalize(steps, context, runStartedAt) {
  const ok = steps.every((s) => s.ok)
  return {
    ok,
    steps,
    context: {
      ...context,
      durationMs: Math.max(0, Date.now() - runStartedAt),
    },
  }
}

async function countSettleJournals(batchId, bookingId) {
  const key = `payout_batch_settled:${batchId}:${bookingId}`
  const { data, error } = await supabaseAdmin
    .from('ledger_journals')
    .select('id')
    .eq('idempotency_key', key)
  if (error) throw new Error(error.message)
  return (data || []).length
}

async function readHeld(userId) {
  const { data } = await supabaseAdmin
    .from('user_wallets')
    .select('held_referral_balance_thb')
    .eq('user_id', userId)
    .maybeSingle()
  return Math.round(Number(data?.held_referral_balance_thb || 0) * 100) / 100
}

async function sumEarnedHeld(userId) {
  const { data } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb, referrer_id, referee_id, type, status')
    .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    .or(`referrer_id.eq.${userId},referee_id.eq.${userId}`)
  let sum = 0
  for (const row of data || []) {
    const isBonus = String(row.type || '').toLowerCase() === 'bonus'
    const beneficiary = isBonus ? row.referrer_id : row.referee_id
    if (String(beneficiary) === String(userId)) sum += Number(row.amount_thb) || 0
  }
  return Math.round(sum * 100) / 100
}

async function insertReadyBooking({
  bookingId,
  listingId,
  guestId,
  partnerId,
  priceThb,
  commissionThb,
  partnerNet,
  guestTotalThb,
  status = 'READY_FOR_PAYOUT',
  extraMeta = {},
  pricingSnapshot = null,
}) {
  const checkIn = new Date()
  checkIn.setUTCDate(checkIn.getUTCDate() + 21)
  const checkOut = new Date(checkIn)
  checkOut.setUTCDate(checkOut.getUTCDate() + 2)
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id: listingId,
    renter_id: guestId,
    partner_id: partnerId,
    status,
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: priceThb,
    currency: 'THB',
    price_paid: guestTotalThb,
    exchange_rate: 1,
    commission_thb: commissionThb,
    commission_rate: 15,
    applied_commission_rate: 15,
    partner_earnings_thb: partnerNet,
    rounding_diff_pot: 0,
    guest_name: 'Audit02 Guest',
    guest_phone: '0000000202',
    guests_count: 1,
    special_requests: TAG,
    pricing_snapshot: pricingSnapshot || {
      v: 2,
      final_breakdown: { total_guest_payable_rounded_thb: guestTotalThb },
      fee_split_v2: {
        guest_service_fee_thb: commissionThb,
        guest_payable_rounded_thb: guestTotalThb,
        partner_netto_thb: partnerNet,
      },
    },
    metadata: withFintechTestDataMeta({
      test_data_tag: E2E_TEST_DATA_TAG,
      audit02: true,
      ready_for_payout_at: now,
      escrow_thawed_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      ...extraMeta,
    }),
  })
  if (error) throw new Error(error.message || 'BOOKING_INSERT_FAILED')
}

/**
 * @param {{ skipCleanup?: boolean }} [opts]
 */
export async function runAudit02RegressionSmoke(opts = {}) {
  process.env.SMOKE_FINANCIAL_RUN = '1'
  const runStartedAt = Date.now()
  const steps = []
  const context = { tag: TAG }

  let t0 = Date.now()
  const sEnv = step('0. Supabase + settle-lock RPC')
  steps.push(sEnv)
  if (!supabaseAdmin) {
    fail(sEnv, 'SUPABASE not configured', t0)
    return finalize(steps, context, runStartedAt)
  }
  const { error: rpcProbe } = await supabaseAdmin.rpc('try_claim_payout_batch_settle_lock', {
    p_batch_id: '__audit02_probe_missing__',
    p_owner: 'probe',
    p_ttl_seconds: 60,
  })
  if (rpcProbe && (String(rpcProbe.message || '').includes('does not exist') || rpcProbe.code === '42883')) {
    fail(sEnv, 'Apply migrations stage201_02 (+ stage201_03) settle lock + stage201_01 held balance', t0)
    return finalize(steps, context, runStartedAt)
  }
  const { error: refreshProbe } = await supabaseAdmin.rpc('refresh_payout_batch_settle_lock', {
    p_batch_id: '__audit02_probe_missing__',
    p_token: 'probe',
  })
  if (refreshProbe && (String(refreshProbe.message || '').includes('does not exist') || refreshProbe.code === '42883')) {
    fail(sEnv, 'Apply migration stage201_03 (settle lock heartbeat refresh)', t0)
    return finalize(steps, context, runStartedAt)
  }
  pass(sEnv, 'ok', t0)

  const guestId = makeId('user-smoke-a02-g')
  const partnerId = makeId('user-smoke-a02-p')
  const bookingInvoice = `bk-a02-inv-${Date.now().toString(36)}`
  const bookingOk2 = `bk-a02-ok2-${Date.now().toString(36)}`
  const bookingFail = `bk-a02-fail-${Date.now().toString(36)}`
  const bookingDispute = `bk-a02-dsp-${Date.now().toString(36)}`
  const bookingReferral = `bk-a02-ref-${Date.now().toString(36)}`
  let batchId = null
  let batchDisputeId = null

  const priceThb = 10000
  const commissionThb = 1500
  const partnerNet = 10000
  const guestTotalThb = 11500

  try {
    t0 = Date.now()
    const sClean = step('1. Cleanup prior audit02 rows')
    steps.push(sClean)
    if (!opts.skipCleanup) {
      const { data: old } = await supabaseAdmin.from('bookings').select('id').eq('listing_id', LISTING_ID)
      const ids = (old || []).map((b) => b.id)
      if (ids.length) {
        await supabaseAdmin.from('payout_batch_items').delete().in('booking_id', ids)
        await supabaseAdmin.from('referral_ledger').delete().in('booking_id', ids)
        await supabaseAdmin.from('bookings').delete().in('id', ids)
      }
      await supabaseAdmin.from('payout_batches').delete().like('id', 'pb-a02-%')
    }
    pass(sClean, 'done', t0)

    t0 = Date.now()
    const sProf = step('2. Profiles (guest + partner)')
    steps.push(sProf)
    const hash = bcrypt.hashSync('smoke-audit02-pass', 8)
    const ts = new Date().toISOString()
    const { error: pErr } = await supabaseAdmin.from('profiles').upsert(
      [
        {
          id: guestId,
          email: `${guestId}@smoke.invalid`,
          password_hash: hash,
          role: 'RENTER',
          first_name: 'A02Guest',
          referral_code: `A2G${Date.now().toString(36).slice(-5).toUpperCase()}`,
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
          first_name: 'A02Partner',
          referral_code: `A2P${Date.now().toString(36).slice(-5).toUpperCase()}`,
          terms_accepted: true,
          terms_accepted_at: ts,
          partner_terms_accepted_at: ts,
          preferred_payout_currency: 'RUB',
          is_verified: true,
          verification_status: 'VERIFIED',
          language: 'ru',
        },
      ],
      { onConflict: 'id' },
    )
    if (pErr) {
      fail(sProf, pErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    await supabaseAdmin.from('partner_payout_profiles').delete().eq('partner_id', partnerId)
    await supabaseAdmin.from('partner_payout_profiles').insert({
      id: `pp-a02-${partnerId}`.slice(0, 120),
      partner_id: partnerId,
      method_id: TBANK_REGISTRY_METHOD_ID,
      data: {
        recipientName: 'A02 Partner',
        accountNumber: '40817810000000009999',
        bik: '044525974',
        inn: '7707083893',
      },
      is_verified: true,
      is_default: true,
      created_at: ts,
      updated_at: ts,
    })
    context.guestId = guestId
    context.partnerId = partnerId
    pass(sProf, partnerId.slice(0, 18), t0)

    t0 = Date.now()
    const sList = step('3. Listing')
    steps.push(sList)
    const { data: cat } = await supabaseAdmin.from('categories').select('id').limit(1).maybeSingle()
    if (!cat?.id) {
      fail(sList, 'no category', t0)
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
        district: 'Audit02',
        base_price_thb: priceThb,
        commission_rate: 15,
        images: [],
        available: true,
        instant_booking: true,
        max_capacity: 2,
        metadata: withFintechTestDataMeta({ test_data_tag: E2E_TEST_DATA_TAG }),
      },
      { onConflict: 'id' },
    )
    if (lErr) {
      fail(sList, lErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sList, LISTING_ID, t0)

    // --- Chat invoice path ---
    t0 = Date.now()
    const sInv = step('4. Chat invoice sync + charge SSOT')
    steps.push(sInv)
    await insertReadyBooking({
      bookingId: bookingInvoice,
      listingId: LISTING_ID,
      guestId,
      partnerId,
      priceThb,
      commissionThb,
      partnerNet,
      guestTotalThb,
      status: 'INQUIRY',
      pricingSnapshot: {
        v: 2,
        final_breakdown: { total_guest_payable_rounded_thb: 99999 },
        fee_split_v2: { guest_payable_rounded_thb: 99999 },
      },
    })
    const commission = await calculateCommissionFromGuestPayable(guestTotalThb, partnerId)
    const invoiceId = `inv-a02-${Date.now().toString(36)}`
    const sync = await syncBookingForPayableChatInvoice({
      bookingId: bookingInvoice,
      invoiceId,
      amountThb: guestTotalThb,
      commission,
      hostUserId: partnerId,
      invoiceExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    if (!sync.ok) {
      fail(sInv, sync.error || 'sync_failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: invBooking } = await supabaseAdmin
      .from('bookings')
      .select('status, price_thb, commission_thb, rounding_diff_pot, pricing_snapshot, metadata, partner_earnings_thb')
      .eq('id', bookingInvoice)
      .maybeSingle()
    const charge = guestPayableRoundedThbFromBooking(invBooking)
    const metaAmt = Math.round(Number(invBooking?.metadata?.chat_invoice_amount_thb) || 0)
    const snapRounded = Math.round(
      Number(invBooking?.pricing_snapshot?.fee_split_v2?.guest_payable_rounded_thb) || 0,
    )
    const quote = Math.round(Number(invBooking?.pricing_snapshot?.chat_invoice_quote?.amount_thb) || 0)
    if (charge !== guestTotalThb || metaAmt !== guestTotalThb || snapRounded !== guestTotalThb || quote !== guestTotalThb) {
      fail(
        sInv,
        `charge mismatch charge=${charge} meta=${metaAmt} fee_split=${snapRounded} quote=${quote} expect=${guestTotalThb}`,
        t0,
      )
      return finalize(steps, context, runStartedAt)
    }
    if (invBooking?.pricing_snapshot?.final_breakdown) {
      fail(sInv, 'final_breakdown should be cleared after invoice sync', t0)
      return finalize(steps, context, runStartedAt)
    }
    if (Number(invBooking?.rounding_diff_pot) !== 0) {
      fail(sInv, `pot=${invBooking.rounding_diff_pot}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    // Host UI money: partner earnings from commission split
    if (Math.round(Number(invBooking?.partner_earnings_thb) || 0) <= 0) {
      fail(sInv, 'partner_earnings_thb missing after invoice', t0)
      return finalize(steps, context, runStartedAt)
    }
    // Jump to READY (skip money path) for Concierge — intentional fixture, not prod path
    const thawAt = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const jumpReady = await smokeForceBookingStatusNegativeTest(
      bookingInvoice,
      'READY_FOR_PAYOUT',
      'negative_test:audit02_invoice_skip_money_to_ready',
      {
        partner_earnings_thb: partnerNet,
        metadata: {
          ...(invBooking.metadata || {}),
          ready_for_payout_at: new Date().toISOString(),
          escrow_thawed_at: thawAt,
          smoke_paid: true,
        },
      },
    )
    if (!jumpReady.success) {
      fail(sInv, jumpReady.error || 'force READY failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sInv, `status=${invBooking.status}→READY charge=${charge}`, t0)

    t0 = Date.now()
    const sPay = step('5. Seed 2 more READY bookings (pool of 3)')
    steps.push(sPay)
    await insertReadyBooking({
      bookingId: bookingOk2,
      listingId: LISTING_ID,
      guestId,
      partnerId,
      priceThb,
      commissionThb,
      partnerNet,
      guestTotalThb,
    })
    await insertReadyBooking({
      bookingId: bookingFail,
      listingId: LISTING_ID,
      guestId,
      partnerId,
      priceThb,
      commissionThb,
      partnerNet,
      guestTotalThb,
    })
    pass(sPay, `${bookingOk2}, ${bookingFail}`, t0)

    t0 = Date.now()
    const sPool = step('6. Concierge draft pool + lock')
    steps.push(sPool)
    const pool = await PayoutBatchService.createDraftPoolForToday({
      rail: 'TBANK_RU',
      force: true,
      createdBy: partnerId,
    })
    if (!pool?.batchId) {
      fail(sPool, pool?.error || pool?.message || 'no pool', t0)
      return finalize(steps, context, runStartedAt)
    }
    batchId = pool.batchId
    context.batchId = batchId
    await supabaseAdmin
      .from('payout_batches')
      .update({
        metadata: withFintechTestDataMeta({ audit02: true, test_data_tag: E2E_TEST_DATA_TAG }),
      })
      .eq('id', batchId)
    // Ensure our 3 bookings are in the batch (pool may include others — attach if missing)
    const pack0 = await PayoutBatchService.getBatchWithItems(batchId)
    const inBatch = new Set((pack0?.items || []).map((i) => i.booking_id))
    for (const bid of [bookingInvoice, bookingOk2, bookingFail]) {
      if (inBatch.has(bid)) continue
      await supabaseAdmin.from('payout_batch_items').insert({
        id: `pbi-${batchId}-${bid}`.slice(0, 120),
        batch_id: batchId,
        booking_id: bid,
        partner_id: partnerId,
        amount_thb: partnerNet,
        payout_currency: 'THB',
        status: 'PENDING',
        metadata: { audit02_attach: true },
      })
    }
    const locked = await PayoutBatchService.lockBatch(batchId, partnerId)
    if (!locked?.success) {
      fail(sPool, locked?.message || locked?.error || 'lock_failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sPool, `${batchId} LOCKED`, t0)

    t0 = Date.now()
    const sPartial = step('7. Partial settle (break item #3 partner_id → ledger fail)')
    steps.push(sPartial)
    const { data: failItem } = await supabaseAdmin
      .from('payout_batch_items')
      .select('id, partner_id')
      .eq('batch_id', batchId)
      .eq('booking_id', bookingFail)
      .maybeSingle()
    if (!failItem?.id) {
      fail(sPartial, 'fail item not in batch', t0)
      return finalize(steps, context, runStartedAt)
    }
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ partner_id: '', updated_at: new Date().toISOString() })
      .eq('id', failItem.id)

    const partial = await PayoutBatchService.markBatchSettled(batchId, partnerId)
    if (partial?.success !== false || partial?.error !== 'ledger_errors') {
      fail(sPartial, `expected ledger_errors, got ${partial?.error} success=${partial?.success}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: batchAfter } = await supabaseAdmin
      .from('payout_batches')
      .select('status')
      .eq('id', batchId)
      .maybeSingle()
    const stBatch = String(batchAfter?.status || '').toUpperCase()
    if (!['LOCKED', 'EXPORTED'].includes(stBatch)) {
      fail(sPartial, `batch should stay LOCKED/EXPORTED, got ${stBatch}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: itemsAfter } = await supabaseAdmin
      .from('payout_batch_items')
      .select('booking_id, status')
      .eq('batch_id', batchId)
      .in('booking_id', [bookingInvoice, bookingOk2, bookingFail])
    const byBid = Object.fromEntries((itemsAfter || []).map((i) => [i.booking_id, String(i.status).toUpperCase()]))
    if (byBid[bookingInvoice] !== 'SETTLED' || byBid[bookingOk2] !== 'SETTLED') {
      fail(sPartial, `expected 2 SETTLED, got ${JSON.stringify(byBid)}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    if (byBid[bookingFail] === 'SETTLED') {
      fail(sPartial, 'fail booking must not be SETTLED', t0)
      return finalize(steps, context, runStartedAt)
    }
    const j1 = await countSettleJournals(batchId, bookingInvoice)
    const j2 = await countSettleJournals(batchId, bookingOk2)
    const j3 = await countSettleJournals(batchId, bookingFail)
    if (j1 !== 1 || j2 !== 1 || j3 !== 0) {
      fail(sPartial, `journal counts inv=${j1} ok2=${j2} fail=${j3}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sPartial, `batch=${stBatch} items=${JSON.stringify(byBid)}`, t0)

    t0 = Date.now()
    const sRepair = step('8. Repair settle (restore partner_id; idempotent journals)')
    steps.push(sRepair)
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ partner_id: partnerId, updated_at: new Date().toISOString() })
      .eq('id', failItem.id)
    const repaired = await PayoutBatchService.markBatchSettled(batchId, partnerId)
    if (!repaired?.success) {
      fail(sRepair, repaired?.message || repaired?.error || 'repair_failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const j1b = await countSettleJournals(batchId, bookingInvoice)
    const j2b = await countSettleJournals(batchId, bookingOk2)
    const j3b = await countSettleJournals(batchId, bookingFail)
    if (j1b !== 1 || j2b !== 1 || j3b !== 1) {
      fail(sRepair, `after repair journals inv=${j1b} ok2=${j2b} fail=${j3b}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: batchDone } = await supabaseAdmin
      .from('payout_batches')
      .select('status')
      .eq('id', batchId)
      .maybeSingle()
    if (String(batchDone?.status || '').toUpperCase() !== 'SETTLED') {
      fail(sRepair, `batch status=${batchDone?.status}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sRepair, 'SETTLED · journals still 1 each', t0)

    // --- Dispute SKIPPED + re-queue ---
    t0 = Date.now()
    const sDisp = step('9. Dispute SKIPPED → unfreeze → re-queue new pool')
    steps.push(sDisp)
    await insertReadyBooking({
      bookingId: bookingDispute,
      listingId: LISTING_ID,
      guestId,
      partnerId,
      priceThb: 8000,
      commissionThb: 1200,
      partnerNet: 8000,
      guestTotalThb: 9200,
      extraMeta: { payout_blocked_by_dispute: true },
    })
    const pool2 = await PayoutBatchService.createDraftPoolForToday({
      rail: 'TBANK_RU',
      force: true,
      createdBy: partnerId,
    })
    if (!pool2?.batchId) {
      fail(sDisp, pool2?.error || 'no dispute pool', t0)
      return finalize(steps, context, runStartedAt)
    }
    batchDisputeId = pool2.batchId
    context.batchDisputeId = batchDisputeId
    let packD = await PayoutBatchService.getBatchWithItems(batchDisputeId)
    if (!(packD?.items || []).some((i) => i.booking_id === bookingDispute)) {
      await supabaseAdmin.from('payout_batch_items').insert({
        id: `pbi-${batchDisputeId}-${bookingDispute}`.slice(0, 120),
        batch_id: batchDisputeId,
        booking_id: bookingDispute,
        partner_id: partnerId,
        amount_thb: 8000,
        payout_currency: 'THB',
        status: 'PENDING',
        metadata: { audit02_dispute: true },
      })
    }
    const lock2 = await PayoutBatchService.lockBatch(batchDisputeId, partnerId)
    if (!lock2?.success) {
      fail(sDisp, lock2?.message || 'lock2_failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const settleDisp = await PayoutBatchService.markBatchSettled(batchDisputeId, partnerId)
    // May succeed overall if only SKIPPED items (no ledger_errors) — item must be SKIPPED
    const { data: dispItem } = await supabaseAdmin
      .from('payout_batch_items')
      .select('status')
      .eq('batch_id', batchDisputeId)
      .eq('booking_id', bookingDispute)
      .maybeSingle()
    if (String(dispItem?.status || '').toUpperCase() !== 'SKIPPED') {
      fail(
        sDisp,
        `expected SKIPPED, got ${dispItem?.status}; settle=${settleDisp?.error || settleDisp?.success}`,
        t0,
      )
      return finalize(steps, context, runStartedAt)
    }

    // Unfreeze + re-queue
    const { data: dispBooking } = await supabaseAdmin
      .from('bookings')
      .select('metadata, status')
      .eq('id', bookingDispute)
      .maybeSingle()
    const meta = { ...(dispBooking?.metadata || {}) }
    delete meta.payout_blocked_by_dispute
    const dispSt = String(dispBooking?.status || '').toUpperCase()
    if (dispSt === 'READY_FOR_PAYOUT') {
      const { error: metaErr } = await supabaseAdmin
        .from('bookings')
        .update({ metadata: meta, updated_at: new Date().toISOString() })
        .eq('id', bookingDispute)
      if (metaErr) {
        fail(sDisp, metaErr.message, t0)
        return finalize(steps, context, runStartedAt)
      }
    } else if (dispSt === 'THAWED') {
      const readyAgain = await smokeTransitionBookingStatus(bookingDispute, 'READY_FOR_PAYOUT', {
        scope: 'system',
        trigger: 'smoke_audit02_dispute_requeue',
        extraPatch: { metadata: meta },
      })
      if (!readyAgain.success) {
        fail(sDisp, readyAgain.error || 'READY requeue failed', t0)
        return finalize(steps, context, runStartedAt)
      }
    } else {
      const forceReady = await smokeForceBookingStatusNegativeTest(
        bookingDispute,
        'READY_FOR_PAYOUT',
        'negative_test:audit02_dispute_requeue',
        { metadata: meta },
      )
      if (!forceReady.success) {
        fail(sDisp, forceReady.error || 'force READY requeue failed', t0)
        return finalize(steps, context, runStartedAt)
      }
    }

    const pool3 = await PayoutBatchService.createDraftPoolForToday({
      rail: 'TBANK_RU',
      force: true,
      createdBy: partnerId,
    })
    if (!pool3?.batchId) {
      fail(sDisp, pool3?.error || 'requeue pool missing', t0)
      return finalize(steps, context, runStartedAt)
    }
    let requeued = (await PayoutBatchService.getBatchWithItems(pool3.batchId))?.items || []
    if (!requeued.some((i) => i.booking_id === bookingDispute)) {
      // Attach if pool filtered by schedule — still prove SKIPPED does not block
      await supabaseAdmin.from('payout_batch_items').insert({
        id: `pbi-${pool3.batchId}-${bookingDispute}`.slice(0, 120),
        batch_id: pool3.batchId,
        booking_id: bookingDispute,
        partner_id: partnerId,
        amount_thb: 8000,
        payout_currency: 'THB',
        status: 'PENDING',
        metadata: { audit02_requeue: true },
      })
      requeued = (await PayoutBatchService.getBatchWithItems(pool3.batchId))?.items || []
    }
    if (!requeued.some((i) => i.booking_id === bookingDispute && String(i.status).toUpperCase() !== 'SKIPPED')) {
      fail(sDisp, 'dispute booking not re-queued as non-SKIPPED', t0)
      return finalize(steps, context, runStartedAt)
    }
    context.batchRequeueId = pool3.batchId
    pass(sDisp, `SKIPPED → requeue ${pool3.batchId}`, t0)

    // --- Referral unlock / held ---
    t0 = Date.now()
    const sRef = step('10. Referral held → unlock → credit (held = Σ earned_held)')
    steps.push(sRef)
    await insertReadyBooking({
      bookingId: bookingReferral,
      listingId: LISTING_ID,
      guestId,
      partnerId,
      priceThb: 5000,
      commissionThb: 750,
      partnerNet: 5000,
      guestTotalThb: 5750,
    })
    const completedAt = new Date(Date.now() - 10 * 86400000).toISOString()
    const refDone = await smokeTransitionBookingStatus(bookingReferral, 'COMPLETED', {
      scope: 'system',
      trigger: 'smoke_audit02_referral_completed',
      metadata: { updatedAt: completedAt },
      extraPatch: { completed_at: completedAt },
    })
    if (!refDone.success) {
      fail(sRef, refDone.error || 'COMPLETED transition failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    const unlockAt = computeReferralUnlockAt(completedAt, 7)
    const ledgerId = makeId('rfl-a02')
    const holdAmt = 42.5
    await supabaseAdmin.from('referral_ledger').insert({
      id: ledgerId,
      booking_id: bookingReferral,
      referrer_id: partnerId,
      referee_id: guestId,
      amount_thb: holdAmt,
      type: 'bonus',
      referral_type: 'guest_booking',
      ledger_depth: 1,
      status: REFERRAL_STATUSES.PENDING,
      metadata: { e2e: 'audit02_referral', split_role: 'referrer' },
    })
    const marked = await ReferralLedgerService.markPendingAsEarned(bookingReferral, {
      referralHoldDays: 7,
      completedAt,
    })
    if (!marked?.held) {
      fail(sRef, `expected held accrual, got ${JSON.stringify(marked)}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const heldAfter = await readHeld(partnerId)
    const sumHeld = await sumEarnedHeld(partnerId)
    if (Math.abs(heldAfter - sumHeld) > 0.02) {
      fail(sRef, `held wallet=${heldAfter} ≠ Σ earned_held=${sumHeld}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    if (Date.parse(unlockAt) > Date.now()) {
      fail(sRef, 'unlock_at not in past', t0)
      return finalize(steps, context, runStartedAt)
    }
    const unlock = await ReferralLedgerService.unlockHeldRowsForBooking(bookingReferral)
    if (unlock.unlockedCount < 1) {
      fail(sRef, `unlockCount=${unlock.unlockedCount} errors=${JSON.stringify(unlock.creditErrors)}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const { data: earnedRow } = await supabaseAdmin
      .from('referral_ledger')
      .select('status')
      .eq('id', ledgerId)
      .maybeSingle()
    if (String(earnedRow?.status) !== REFERRAL_STATUSES.EARNED) {
      fail(sRef, `status=${earnedRow?.status}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    const heldFinal = await readHeld(partnerId)
    const sumHeldFinal = await sumEarnedHeld(partnerId)
    if (Math.abs(heldFinal - sumHeldFinal) > 0.02) {
      fail(sRef, `after unlock held=${heldFinal} Σ=${sumHeldFinal}`, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sRef, `unlock ok · held=${heldFinal}`, t0)

    t0 = Date.now()
    const sUi = step('11. Host-facing status/amount spot-check')
    steps.push(sUi)
    const { data: hostRows } = await supabaseAdmin
      .from('bookings')
      .select('id, status, partner_earnings_thb')
      .in('id', [bookingInvoice, bookingOk2, bookingFail])
    const map = Object.fromEntries((hostRows || []).map((r) => [r.id, r]))
    for (const id of [bookingInvoice, bookingOk2, bookingFail]) {
      if (String(map[id]?.status || '').toUpperCase() !== 'COMPLETED') {
        fail(sUi, `${id} status=${map[id]?.status}`, t0)
        return finalize(steps, context, runStartedAt)
      }
      if (Math.round(Number(map[id]?.partner_earnings_thb) || 0) !== partnerNet) {
        fail(sUi, `${id} partner_earnings=${map[id]?.partner_earnings_thb}`, t0)
        return finalize(steps, context, runStartedAt)
      }
    }
    pass(sUi, '3× COMPLETED · partner_earnings match', t0)

    return finalize(steps, context, runStartedAt)
  } catch (e) {
    const s = step('X. Uncaught')
    steps.push(s)
    fail(s, e?.message || e, Date.now())
    return finalize(steps, context, runStartedAt)
  }
}

export default runAudit02RegressionSmoke
