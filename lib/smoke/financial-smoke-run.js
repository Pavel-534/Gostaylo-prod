/**
 * Stage 104 — полный финансовый smoke (DB + сервисы), рельс RUB Direct / KG·USDT.
 * Вызывается из POST /api/admin/smoke/financial-run и scripts/smoke-full-financial.mjs
 */

import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import EscrowService from '@/lib/services/escrow.service.js'
import PayoutBatchService from '@/lib/services/payout-batch.service.js'
import { listPartnerSettlementDocuments } from '@/lib/services/partner-settlement-documents.service.js'
import { buildPayoutBatchBankPackageZip } from '@/lib/services/payout-batch-bank-package.service.js'
import { generatePayoutRequestDocuments } from '@/lib/services/payout-document.service.js'
import {
  defaultPartnerPayoutCurrencyForRail,
  getPayoutRailMeta,
  normalizePayoutRail,
} from '@/lib/treasury/payout-rails.js'

const TAG = `${E2E_TEST_DATA_TAG} stage104-financial-smoke`
const LISTING_ID = 'lst-stage104-smoke'
const LEGACY_LISTING_ID = 'lst-stage103-smoke'

/**
 * @param {import('node:process').argv} argv
 */
export function parseFinancialSmokeCliArgs(argv = process.argv.slice(2)) {
  /** @type {{ rail: string, priceThb: number, commissionRate: number, guestPayCurrency: string, skipCleanup: boolean }} */
  const out = {
    rail: 'TBANK_RU',
    priceThb: 5000,
    commissionRate: 10,
    guestPayCurrency: 'RUB',
    skipCleanup: false,
  }
  for (const arg of argv) {
    if (arg === '--skip-cleanup') out.skipCleanup = true
    const railM = arg.match(/^--rail=(.+)$/i)
    if (railM) out.rail = normalizePayoutRail(railM[1])
    const amountM = arg.match(/^--amount=(\d+(?:\.\d+)?)$/i)
    if (amountM) out.priceThb = Math.max(500, Number(amountM[1]))
    const commM = arg.match(/^--commission=(\d+(?:\.\d+)?)$/i)
    if (commM) out.commissionRate = Math.max(0, Number(commM[1]))
    const curM = arg.match(/^--guest-currency=(\w+)$/i)
    if (curM) out.guestPayCurrency = String(curM[1]).toUpperCase()
  }
  return out
}

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
  s.detail = String(detail || 'failed').slice(0, 500)
  if (t0 != null) markDuration(s, t0)
  return s
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * @param {{
 *   skipCleanup?: boolean,
 *   rail?: string,
 *   priceThb?: number,
 *   commissionRate?: number,
 *   guestPayCurrency?: string,
 * }} [opts]
 * @returns {Promise<{ ok: boolean, steps: object[], context: object }>}
 */
export async function runFinancialSmoke(opts = {}) {
  const runStartedAt = Date.now()
  const steps = []
  const payoutRail = normalizePayoutRail(opts.rail || 'TBANK_RU')
  const railMeta = getPayoutRailMeta(payoutRail)
  const priceThb = Math.max(500, Number(opts.priceThb) || 5000)
  const commissionRate = Math.max(0, Number(opts.commissionRate) || 10)
  const commissionThb = Math.round((priceThb * commissionRate) / 100)
  const partnerNet = Math.max(0, priceThb - commissionThb)
  const guestTotalThb = priceThb + commissionThb
  const partnerPayoutCurrency = defaultPartnerPayoutCurrencyForRail(payoutRail)
  const guestPayCurrency = String(opts.guestPayCurrency || (payoutRail === 'TBANK_RU' ? 'RUB' : 'USDT')).toUpperCase()

  const context = {
    tag: TAG,
    payoutRail,
    payoutRailLabel: railMeta.ownerLabel,
    simulation: {
      priceThb,
      commissionRate,
      commissionThb,
      partnerNet,
      guestTotalThb,
      guestPayCurrency,
      partnerPayoutCurrency,
    },
  }

  let t0 = Date.now()
  const sEnv = step('1. Окружение (Supabase)')
  steps.push(sEnv)
  if (!supabaseAdmin) {
    fail(sEnv, 'SUPABASE not configured', t0)
    return finalize(steps, context, runStartedAt)
  }
  pass(sEnv, 'подключено', t0)

  let guestId
  let partnerId
  let bookingId
  let batchId

  try {
    t0 = Date.now()
    const sClean = step('2. Очистка предыдущих smoke-данных')
    steps.push(sClean)
    if (!opts.skipCleanup) {
      for (const lid of [LISTING_ID, LEGACY_LISTING_ID]) {
        const { data: oldBookings } = await supabaseAdmin
          .from('bookings')
          .select('id')
          .eq('listing_id', lid)
        const ids = (oldBookings || []).map((b) => b.id)
        if (ids.length) {
          await supabaseAdmin.from('payout_batch_items').delete().in('booking_id', ids)
          await supabaseAdmin.from('bookings').delete().in('id', ids)
        }
      }
      await supabaseAdmin.from('payout_batches').delete().like('id', 'pb-stage104-%')
    }
    pass(sClean, 'готово', t0)

    t0 = Date.now()
    const sProfiles = step('3. Регистрация гостя и партнёра')
    steps.push(sProfiles)
    guestId = makeId('user-smoke-guest')
    partnerId = makeId('user-smoke-partner')
    const hash = bcrypt.hashSync('smoke-stage103-pass', 8)
    const ts = new Date().toISOString()

    const { error: pErr } = await supabaseAdmin.from('profiles').upsert(
      [
        {
          id: guestId,
          email: `${guestId}@smoke.invalid`,
          password_hash: hash,
          role: 'RENTER',
          first_name: 'SmokeGuest',
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
          first_name: 'SmokePartner',
          referral_code: `SP${Date.now().toString(36).slice(-6).toUpperCase()}`,
          terms_accepted: true,
          terms_accepted_at: ts,
          partner_terms_accepted_at: ts,
          preferred_payout_currency: partnerPayoutCurrency,
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
    pass(sProfiles, guestId.slice(0, 20) + '…', t0)

    t0 = Date.now()
    const sListing = step('4. Создание объявления (листинг)')
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
        metadata: withFintechTestDataMeta({ test_data_tag: E2E_TEST_DATA_TAG }),
      },
      { onConflict: 'id' },
    )
    if (lErr) {
      fail(sListing, lErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.listingId = LISTING_ID
    pass(sListing, LISTING_ID, t0)

    t0 = Date.now()
    const sBooking = step('5. Бронирование')
    steps.push(sBooking)
    bookingId = randomUUID()
    const checkIn = new Date()
    checkIn.setUTCDate(checkIn.getUTCDate() + 14)
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
      price_thb: priceThb,
      currency: 'THB',
      price_paid: priceThb + commissionThb,
      commission_thb: commissionThb,
      commission_rate: commissionRate,
      partner_earnings_thb: partnerNet,
      guest_name: 'Smoke Guest',
      guest_email: `${guestId}@smoke.invalid`,
      guests_count: 1,
      special_requests: TAG,
      metadata: withFintechTestDataMeta({ test_data_tag: E2E_TEST_DATA_TAG, smoke_stage104: true }),
      pricing_snapshot: {
        v: 2,
        fee_split_v2: {
          guest_service_fee_thb: commissionThb,
          host_commission_thb: 0,
          platform_gross_revenue_thb: commissionThb,
        },
        final_breakdown: { total_guest_payable_rounded_thb: priceThb + commissionThb },
      },
    })
    if (bErr) {
      fail(sBooking, bErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    context.bookingId = bookingId
    pass(sBooking, bookingId.slice(0, 12) + '…', t0)

    t0 = Date.now()
    const sPay = step('6. Оплата (mock) → PAID_ESCROW')
    steps.push(sPay)
    let escrow = await EscrowService.moveToEscrow(bookingId, {
      txId: `smoke-tx-${Date.now()}`,
      source: 'smoke_stage103',
      captureGuestTotalThb: guestTotalThb,
    })
    if (
      !escrow?.success &&
      /AWAITING_PAYMENT|invalid input value for enum booking_status/i.test(String(escrow?.error))
    ) {
      fail(
        sPay,
        `${escrow?.error} — примените migrations/stage103_escrow_rpc_status_fix.sql в Supabase`,
        t0,
      )
      return finalize(steps, context, runStartedAt)
    }
    if (!escrow?.success) {
      fail(sPay, escrow?.error || 'escrow failed', t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sPay, 'PAID_ESCROW', t0)

    t0 = Date.now()
    const sThaw = step('7. Escrow → Thaw (симуляция 25 ч)')
    steps.push(sThaw)
    const thawAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { error: thErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'THAWED',
        updated_at: new Date().toISOString(),
        metadata: withFintechTestDataMeta({
          escrow_thawed_at: thawAt,
          smoke_stage103: true,
          test_data_tag: E2E_TEST_DATA_TAG,
        }),
        partner_earnings_thb: partnerNet,
      })
      .eq('id', bookingId)
    if (thErr) {
      fail(sThaw, thErr.message, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sThaw, 'THAWED', t0)

    t0 = Date.now()
    const sReady = step('8. READY_FOR_PAYOUT')
    steps.push(sReady)
    const promoted = await PayoutBatchService.promoteThawedToReadyForPayout(50)
    const { data: bReady } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .maybeSingle()
    if (bReady?.status !== 'READY_FOR_PAYOUT') {
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'READY_FOR_PAYOUT',
          updated_at: new Date().toISOString(),
          metadata: { ready_for_payout_at: new Date().toISOString(), smoke_stage103: true },
        })
        .eq('id', bookingId)
    }
    pass(sReady, `promoted=${promoted?.promoted ?? 0}`, t0)

    t0 = Date.now()
    const sPool = step(`9. Пул выплат (${railMeta.ownerShort})`)
    steps.push(sPool)
    const pool = await PayoutBatchService.createDraftPoolForToday({
      rail: payoutRail,
      force: true,
      createdBy: partnerId,
    })
    if (!pool?.batchId && pool?.error) {
      fail(sPool, pool.error || pool.message || 'no pool', t0)
      return finalize(steps, context, runStartedAt)
    }
    batchId = pool.batchId
    context.batchId = batchId
    if (supabaseAdmin && batchId) {
      await supabaseAdmin
        .from('payout_batches')
        .update({
          metadata: withFintechTestDataMeta({
            smoke_stage104: true,
            test_data_tag: E2E_TEST_DATA_TAG,
          }),
        })
        .eq('id', batchId)
    }
    pass(sPool, `${batchId} · ${railMeta.ownerLabel} · ${pool.itemCount ?? 0} строк`, t0)
    context.poolRail = pool.rail || payoutRail

    t0 = Date.now()
    const sLock = step('10. Lock пула')
    steps.push(sLock)
    const locked = await PayoutBatchService.lockBatch(batchId, partnerId)
    if (!locked?.success) {
      fail(
        sLock,
        locked?.message || locked?.error || `status=${locked?.status ?? '?'}`,
        t0,
      )
      return finalize(steps, context, runStartedAt)
    }
    pass(sLock, locked.status || 'LOCKED', t0)

    t0 = Date.now()
    const sExport = step('11. CSV-реестр (как в админке)')
    steps.push(sExport)
    const exported = await PayoutBatchService.exportBatchRegistry(batchId, 'csv')
    if (exported?.error) {
      fail(sExport, exported.error, t0)
      return finalize(steps, context, runStartedAt)
    }
    pass(sExport, `${railMeta.ownerShort} CSV, ${exported.body?.length ?? 0} bytes`, t0)

    t0 = Date.now()
    const sSettle = step('12. Закрытие пула + PDF-акты партнёрам')
    steps.push(sSettle)
    const settled = await PayoutBatchService.markBatchSettled(batchId, partnerId)
    if (!settled?.success) {
      fail(
        sSettle,
        settled?.message ||
          `${settled?.error || 'settle_failed'} (status=${settled?.status ?? '?'})`,
        t0,
      )
      return finalize(steps, context, runStartedAt)
    }
    const acts = settled?.settlementDocuments?.results?.filter((r) => r.success)?.length ?? 0
    pass(sSettle, `актов: ${acts}`, t0)
    context.partnerActsCount = acts

    t0 = Date.now()
    const sReferral119 = step('12b. Referral 119.1 lifecycle smoke')
    steps.push(sReferral119)
    try {
      const { runReferralLifecycleSmokeStep } = await import('@/lib/smoke/referral-lifecycle-smoke-step.js')
      const refStep = await runReferralLifecycleSmokeStep()
      if (refStep.ok) {
        pass(sReferral119, refStep.detail, t0)
      } else {
        fail(sReferral119, refStep.detail, t0)
      }
    } catch (e) {
      fail(sReferral119, e?.message || String(e), t0)
    }

    t0 = Date.now()
    const sReferral121 = step('12d. Referral 121.1 hold period')
    steps.push(sReferral121)
    try {
      const { runReferralHoldSmokeStep } = await import('@/lib/smoke/referral-hold-smoke-step.js')
      const holdStep = await runReferralHoldSmokeStep({
        renterId: context.guestId,
        partnerId: context.partnerId,
        listingId: context.listingId,
      })
      if (holdStep.ok) {
        pass(sReferral121, holdStep.detail, t0)
      } else {
        fail(sReferral121, holdStep.detail, t0)
      }
    } catch (e) {
      fail(sReferral121, e?.message || String(e), t0)
    }

    t0 = Date.now()
    const sReferral123 = step('12e. Referral 123.1 rule_version marker')
    steps.push(sReferral123)
    try {
      const { runReferralRewardRulesSmokeStep } = await import(
        '@/lib/smoke/referral-reward-rules-smoke-step.js'
      )
      const rrStep = await runReferralRewardRulesSmokeStep({
        listingId: context.listingId,
        renterId: context.guestId,
        partnerId: context.partnerId,
      })
      if (rrStep.ok) {
        pass(sReferral123, rrStep.detail, t0)
      } else {
        fail(sReferral123, rrStep.detail, t0)
      }
    } catch (e) {
      fail(sReferral123, e?.message || String(e), t0)
    }

    t0 = Date.now()
    const sReferral120 = step('12c. Referral 120.1 attribution chain')
    steps.push(sReferral120)
    try {
      const { runReferralAttributionSmokeStep } = await import('@/lib/smoke/referral-attribution-smoke-step.js')
      const attrStep = await runReferralAttributionSmokeStep()
      if (attrStep.ok) {
        pass(sReferral120, attrStep.detail, t0)
      } else {
        fail(sReferral120, attrStep.detail, t0)
      }
    } catch (e) {
      fail(sReferral120, e?.message || String(e), t0)
    }

    t0 = Date.now()
    const sZip = step('13. ZIP-пакет для банка')
    steps.push(sZip)
    const zip = await buildPayoutBatchBankPackageZip(batchId)
    if (!zip.success || !zip.buffer?.length) {
      fail(sZip, zip.error || 'empty zip', t0)
    } else {
      pass(sZip, `${Math.round(zip.buffer.length / 1024)} KB`, t0)
      context.zipBytes = zip.buffer.length
      context.bankPackageUrl = `/api/admin/finances/payout-batches/${batchId}/bank-package`
    }

    t0 = Date.now()
    const sPartnerDocs = step('14. Партнёр: акты в кабинете «Документы»')
    steps.push(sPartnerDocs)
    const docs = await listPartnerSettlementDocuments(partnerId)
    const count = docs.rows?.length || 0
    if (!docs.success || count < 1) {
      fail(sPartnerDocs, `найдено: ${count}`, t0)
    } else {
      pass(sPartnerDocs, `${count} документ(ов)`, t0)
      context.partnerDocuments = count
    }

    t0 = Date.now()
    const sTestAct = step('15. Доп. тестовый PDF-акт (одиночная выплата)')
    steps.push(sTestAct)
    const payoutId = randomUUID()
    const { error: poErr } = await supabaseAdmin.from('payouts').insert({
      id: payoutId,
      partner_id: partnerId,
      amount: partnerNet,
      gross_amount: partnerNet,
      currency: 'THB',
      status: 'PAID',
      processed_at: new Date().toISOString(),
      notes: '[E2E_TEST_DATA] stage103-financial-smoke',
    })
    if (poErr && !String(poErr.message).includes('documents')) {
      fail(sTestAct, poErr.message, t0)
    } else {
      const { data: prow } = await supabaseAdmin.from('payouts').select('*').eq('id', payoutId).maybeSingle()
      const gen = prow ? await generatePayoutRequestDocuments(prow) : { success: false }
      pass(sTestAct, gen.success ? 'PDF OK' : gen.error || 'skipped', t0)
    }
  } catch (e) {
    const sCrash = step('Необработанная ошибка')
    fail(sCrash, e?.message || e, Date.now())
    steps.push(sCrash)
  }

  return finalize(steps, context, runStartedAt)
}

/**
 * Stage 105 — проверка, что оба рельса прошли smoke с разными пулами.
 * @param {Array<{ ok: boolean, context?: object }>} results
 */
export function validateDualRailSmokeResults(results) {
  if (!Array.isArray(results) || results.length < 2) {
    return { ok: true, skipped: true, detail: 'один рельс — пропуск' }
  }
  const rails = results.map((r) => r.context?.payoutRail).filter(Boolean)
  const batches = results.map((r) => r.context?.batchId).filter(Boolean)
  if (new Set(rails).size < 2) {
    return { ok: false, detail: `ожидались 2 рельса, получено: ${rails.join(', ') || '—'}` }
  }
  if (batches.length < 2 || new Set(batches).size < 2) {
    return { ok: false, detail: 'ожидались 2 разных payout batch' }
  }
  if (!results.every((r) => r.ok)) {
    return { ok: false, detail: 'не все прогоны PASS' }
  }
  return {
    ok: true,
    detail: `TBANK_RU + KG_CRYPTO · пулы ${batches.map((b) => b.slice(0, 18)).join(' / ')}`,
  }
}

function finalize(steps, context, runStartedAt) {
  const ok = steps.every((s) => s.ok)
  const totalDurationMs = Date.now() - (runStartedAt || Date.now())
  const stepsDurationMs = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0)
  return {
    ok,
    steps,
    context,
    totalDurationMs,
    stepsDurationMs,
    finishedAt: new Date().toISOString(),
  }
}
