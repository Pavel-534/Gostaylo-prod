/**
 * Stage 124.20 / 130.3–130.4 — MIR / ЮKassa smoke.
 * - YOOKASSA_SHOP_ID + SECRET → live initiate (test shop, assert test:true + GET verify), mock webhook → escrow.
 * - Without API keys → mock initiate + mock webhook (legacy path).
 * - Ручной E2E карта 5555…: checkoutUrl из smoke + YOOKASSA_SMOKE_POLL_PAID_MS (см. PRE_REAL §E0).
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import {
  buildYookassaMirWebhookPayload,
  resolveWebhookSecretForSmoke,
  runAcquiringInitiateAndWebhook,
} from '@/lib/smoke/checkout-acquiring-smoke-shared.js'

/** Live YooKassa API (test shop credentials). */
export function hasYookassaApiCredentials() {
  const shopId = String(process.env.YOOKASSA_SHOP_ID || '').trim()
  const secretKey = String(process.env.YOOKASSA_SECRET_KEY || '').trim()
  return Boolean(shopId && secretKey)
}

/** @deprecated use hasYookassaApiCredentials — kept for callers */
export function isYookassaMirSmokeConfigured() {
  return canRunMirSmokeFinancial()
}

/** Webhook secret (env or smoke dev fallback) + SMOKE_FINANCIAL_RUN. */
export function canRunMirSmokeFinancial() {
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') return false
  const { secret } = resolveWebhookSecretForSmoke()
  return Boolean(secret)
}

export function yookassaMirSmokeSkipReason() {
  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return 'SKIP: SMOKE_FINANCIAL_RUN=1 required for MIR smoke'
  }
  const { secret } = resolveWebhookSecretForSmoke()
  if (!secret) {
    return 'SKIP: задайте YOOKASSA_WEBHOOK_SECRET или PAYMENT_ACQUIRING_WEBHOOK_SECRET (smoke dev fallback при SMOKE_FINANCIAL_RUN=1)'
  }
  return 'SKIP: MIR smoke prerequisites not met'
}

/**
 * RUB amount for MIR acquirer (illustrative FX for smoke).
 * @param {number} guestTotalThb
 */
export function deriveMirRubAmountFromThb(guestTotalThb) {
  const thb = Math.max(1, Number(guestTotalThb) || 5500)
  const rubPerThb = Number(process.env.SMOKE_MIR_RUB_PER_THB) || 2.8
  return Math.round(thb * rubPerThb * 100) / 100
}

async function assertEscrowLedgerAndBooking({
  bookingId,
  guestTotalThb,
  commissionThb,
  partnerNet,
  guestTotalRub,
}) {
  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select(
      'status, commission_thb, partner_earnings_thb, price_thb, currency, price_paid, metadata',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (bErr) return { ok: false, error: bErr.message }
  if (String(booking?.status || '').toUpperCase() !== 'PAID_ESCROW') {
    return { ok: false, error: `expected PAID_ESCROW, got ${booking?.status}` }
  }

  const comm = Math.round(Number(booking.commission_thb) || 0)
  const partner = Math.round(Number(booking.partner_earnings_thb) || 0)
  if (comm !== Math.round(commissionThb)) {
    return { ok: false, error: `commission_thb ${comm} !== ${commissionThb}` }
  }
  if (partner !== Math.round(partnerNet)) {
    return { ok: false, error: `partner_earnings_thb ${partner} !== ${partnerNet}` }
  }

  if (String(booking.currency || '').toUpperCase() !== 'RUB') {
    return { ok: false, error: `expected booking.currency RUB, got ${booking.currency}` }
  }

  const paid = Number(booking.price_paid)
  if (!Number.isFinite(paid) || Math.abs(paid - guestTotalRub) > 1.5) {
    return {
      ok: false,
      error: `price_paid RUB ${paid} diverges from snapshot ${guestTotalRub}`,
    }
  }

  const pv = booking.metadata?.payment_verification
  const source = pv?.source || booking.metadata?.payment_verification?.source
  if (!pv || typeof pv !== 'object') {
    return { ok: false, error: 'metadata.payment_verification missing after escrow' }
  }

  const idempotencyKey = `booking_payment_capture:${bookingId}`
  const { data: journal, error: jErr } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, event_type')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (jErr) return { ok: false, error: jErr.message }
  if (!journal?.id) {
    return { ok: false, error: `ledger journal missing for ${idempotencyKey}` }
  }

  const { data: entries, error: eErr } = await supabaseAdmin
    .from('ledger_entries')
    .select('side, amount_thb')
    .eq('journal_id', journal.id)

  if (eErr) return { ok: false, error: eErr.message }
  const rows = Array.isArray(entries) ? entries : []
  if (rows.length < 3) {
    return { ok: false, error: `expected >=3 ledger entries, got ${rows.length}` }
  }

  let debit = 0
  let credit = 0
  for (const row of rows) {
    const amt = Number(row.amount_thb) || 0
    if (row.side === 'DEBIT') debit += amt
    if (row.side === 'CREDIT') credit += amt
  }
  if (Math.abs(debit - credit) > 0.03) {
    return { ok: false, error: `ledger unbalanced dr=${debit} cr=${credit}` }
  }

  const fiscal = booking.metadata?.fiscal
  const fiscalNote = fiscal
    ? `fiscal=${fiscal.status || 'present'}`
    : 'fiscal=pending_or_unconfigured'

  const { count: referralRows } = await supabaseAdmin
    .from('referral_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', bookingId)

  return {
    ok: true,
    detail: `MIR RUB ${guestTotalRub} → PAID_ESCROW · ledger ${journal.id} balanced · ${fiscalNote} · referral_rows=${referralRows ?? 0} · source=${source || 'payment_acquiring_webhook'}`,
    journalId: journal.id,
    guestTotalThb,
  }
}

/**
 * @param {{
 *   listingId: string,
 *   guestId: string,
 *   partnerId: string,
 *   priceThb: number,
 *   commissionThb: number,
 *   partnerNet: number,
 *   guestTotalThb: number,
 *   tag?: string,
 * }} params
 */
export async function runCheckoutMirEscrowStep({
  listingId,
  guestId,
  partnerId,
  priceThb,
  commissionThb,
  partnerNet,
  guestTotalThb,
  tag = E2E_TEST_DATA_TAG,
}) {
  if (!canRunMirSmokeFinancial()) {
    return { ok: true, skipped: true, detail: yookassaMirSmokeSkipReason() }
  }

  if (!supabaseAdmin) {
    return { ok: false, error: 'Supabase not configured' }
  }

  const liveInitiate = hasYookassaApiCredentials()
  const guestTotalRub = deriveMirRubAmountFromThb(guestTotalThb)
  const bookingId = randomUUID()
  const checkIn = new Date()
  checkIn.setUTCDate(checkIn.getUTCDate() + 21)
  const checkOut = new Date(checkIn)
  checkOut.setUTCDate(checkOut.getUTCDate() + 2)

  const { error: insErr } = await supabaseAdmin.from('bookings').insert({
    id: bookingId,
    listing_id: listingId,
    renter_id: guestId,
    partner_id: partnerId,
    status: 'PENDING',
    check_in: checkIn.toISOString(),
    check_out: checkOut.toISOString(),
    price_thb: priceThb,
    currency: 'RUB',
    price_paid: guestTotalRub,
    commission_thb: commissionThb,
    commission_rate: Math.round((commissionThb / Math.max(priceThb, 1)) * 1000) / 10,
    partner_earnings_thb: partnerNet,
    guest_name: 'Smoke MIR Guest',
    guest_email: `${guestId}@smoke.invalid`,
    guests_count: 1,
    special_requests: `${tag} mir-checkout-smoke`,
    metadata: withFintechTestDataMeta({
      test_data_tag: E2E_TEST_DATA_TAG,
      smoke_mir_checkout: true,
    }),
    pricing_snapshot: {
      v: 2,
      guest_total_rub: guestTotalRub,
      final_breakdown: {
        total_guest_brutto: { amount: guestTotalRub, currency: 'RUB' },
        total_guest_payable_rounded_thb: guestTotalThb,
      },
      fee_split_v2: {
        guest_service_fee_thb: commissionThb,
        host_commission_thb: 0,
        platform_gross_revenue_thb: commissionThb,
      },
    },
  })

  if (insErr) {
    return { ok: false, error: insErr.message }
  }

  const flow = await runAcquiringInitiateAndWebhook({
    bookingId,
    guestId,
    method: 'MIR',
    adapterHeader: 'MIR_RU',
    expectLiveCheckout: liveInitiate,
    buildWebhookPayload: ({ bookingId: bid, intentId }) =>
      buildYookassaMirWebhookPayload({
        bookingId: bid,
        intentId,
        amount: guestTotalRub,
        currency: 'RUB',
      }),
  })

  if (!flow.ok) {
    return flow
  }

  const checks = await assertEscrowLedgerAndBooking({
    bookingId,
    guestTotalThb,
    commissionThb,
    partnerNet,
    guestTotalRub,
  })

  if (!checks.ok) {
    return checks
  }

  const modeNote = liveInitiate
    ? `live-initiate test-shop url=${flow.checkoutUrl || 'n/a'}`
    : `mock-initiate mode=${flow.providerMode || 'mock'}`

  return {
    ok: true,
    bookingId,
    intentId: flow.intentId,
    detail: `${modeNote} · ${checks.detail}`,
  }
}
