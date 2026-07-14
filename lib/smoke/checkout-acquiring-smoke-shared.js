/**
 * Stage 124.20 — shared helpers for in-process acquiring smoke (CARD / MIR).
 * Stage 149.3 — POST /api/v2/bookings smoke (atomic RPC + invoice_hold expiry).
 */
import { createHmac, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import { computeListingBookingQuote } from '@/lib/services/booking/booking-quote.js'
import { expireInvoiceHoldBlocks } from '@/lib/services/invoice-extension.service.js'
import { INVOICE_HOLD_SOURCE } from '@/lib/calendar/block-source-display.js'
import {
  clearSmokeFinancialSessionUserId,
  setSmokeFinancialSessionUserId,
} from '@/lib/smoke/smoke-session-override.js'

/** Dedicated listing for Stage 149.3 RPC concurrency smoke (max_capacity=1). */
export const STAGE149_RPC_SMOKE_LISTING_ID = 'lst-stage149-rpc-smoke'

/** Dev smoke only — never used on production webhook verify at rest. */
export const SMOKE_WEBHOOK_DEV_SECRET = 'gostaylo-smoke-webhook-dev-only'

export function resolveWebhookSecretForSmoke() {
  const fromEnv =
    String(process.env.YOOKASSA_WEBHOOK_SECRET || '').trim() ||
    String(process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET || '').trim()
  if (fromEnv) return { secret: fromEnv, source: 'env' }
  if (process.env.SMOKE_FINANCIAL_RUN === '1') {
    return { secret: SMOKE_WEBHOOK_DEV_SECRET, source: 'smoke_dev_fallback' }
  }
  return { secret: '', source: 'missing' }
}

export function signWebhookBody(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

/**
 * Typical YooKassa `payment.succeeded` body for MIR_RU adapter.
 * @param {{ bookingId: string, intentId: string, amount: number, currency: 'RUB' | 'THB' }} p
 */
/**
 * Live test-shop: initiate must expose test mode; optional GET verify (Stage 130.4).
 * @param {object} initiateJson — body from POST payment/initiate
 */
export async function assertYookassaTestShopLiveInitiate(initiateJson) {
  const meta = initiateJson?.data?.metadata || {}
  if (meta.yookassa_test !== true) {
    return {
      ok: false,
      error: `YooKassa test shop: expected metadata.yookassa_test=true, got ${String(meta.yookassa_test)}`,
    }
  }

  const paymentId =
    meta.yookassa_payment_id ||
    (meta.provider_response && typeof meta.provider_response === 'object'
      ? meta.provider_response.id
      : null)

  if (!paymentId || String(paymentId).startsWith('smoke-yk-')) {
    return { ok: false, error: 'live initiate: missing real yookassa_payment_id' }
  }

  const { getPayment } = await import('@/lib/payments/yookassa.js')
  const verified = await getPayment(String(paymentId))
  if (!verified.ok) {
    return {
      ok: false,
      error: verified.code || 'YOOKASSA_GET_FAILED',
      detail: verified.provider,
    }
  }
  if (verified.test !== true) {
    return {
      ok: false,
      error: `GET /payments/${paymentId}: expected test=true (test shop), got test=${verified.test}`,
    }
  }

  return { ok: true, paymentId: String(paymentId), test: true, status: verified.status }
}

export function buildYookassaMirWebhookPayload({ bookingId, intentId, amount, currency }) {
  const value = Number(amount).toFixed(2)
  const cur = String(currency || 'RUB').toUpperCase()
  return {
    event: 'payment.succeeded',
    object: {
      id: `smoke-yk-${Date.now()}`,
      status: 'succeeded',
      paid: true,
      amount: { value, currency: cur },
      metadata: {
        booking_id: String(bookingId),
        payment_intent_id: String(intentId),
      },
    },
  }
}

function applyWebhookSecretEnv(secret, secretSource) {
  const prevYoo = process.env.YOOKASSA_WEBHOOK_SECRET
  const prevAcq = process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET
  if (secretSource === 'smoke_dev_fallback') {
    process.env.YOOKASSA_WEBHOOK_SECRET = secret
    process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET = secret
  }
  return { prevYoo, prevAcq, secretSource }
}

function restoreWebhookSecretEnv({ prevYoo, prevAcq, secretSource }) {
  if (secretSource !== 'smoke_dev_fallback') return
  if (prevYoo != null) process.env.YOOKASSA_WEBHOOK_SECRET = prevYoo
  else delete process.env.YOOKASSA_WEBHOOK_SECRET
  if (prevAcq != null) process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET = prevAcq
  else delete process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET
}

/**
 * @param {{
 *   bookingId: string,
 *   guestId: string,
 *   method: 'MIR' | 'CARD',
 *   buildWebhookPayload: (ctx: { bookingId: string, intentId: string }) => object,
 *   adapterHeader?: string,
 *   expectLiveCheckout?: boolean,
 * }} params
 */
export async function runAcquiringInitiateAndWebhook({
  bookingId,
  guestId,
  method,
  buildWebhookPayload,
  adapterHeader = 'MIR_RU',
  expectLiveCheckout = false,
}) {
  const id = String(bookingId || '').trim()
  const renterId = String(guestId || '').trim()
  if (!id || !renterId) return { ok: false, error: 'bookingId and guestId required' }

  const { secret, source: secretSource } = resolveWebhookSecretForSmoke()
  if (!secret) {
    return {
      ok: false,
      error:
        'Set YOOKASSA_WEBHOOK_SECRET or PAYMENT_ACQUIRING_WEBHOOK_SECRET in .env.local for acquiring smoke',
    }
  }

  if (process.env.SMOKE_FINANCIAL_RUN !== '1') {
    return { ok: false, error: 'SMOKE_FINANCIAL_RUN=1 required' }
  }

  const envRestore = applyWebhookSecretEnv(secret, secretSource)
  setSmokeFinancialSessionUserId(renterId)

  try {
    const { POST: postInitiate } = await import(
      '@/app/api/v2/bookings/[id]/payment/initiate/route.js'
    )

    const initiateReq = new NextRequest(`http://smoke.local/api/v2/bookings/${id}/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method,
        acceptedLegalTerms: true,
      }),
    })

    const initiateRes = await postInitiate(initiateReq, { params: { id } })
    const initiateJson = await initiateRes.json().catch(() => ({}))

    if (!initiateRes.ok || !initiateJson?.success) {
      return {
        ok: false,
        error:
          initiateJson?.error ||
          initiateJson?.code ||
          `initiate HTTP ${initiateRes.status}`,
      }
    }

    const intentId = initiateJson?.data?.intentId || initiateJson?.data?.id
    if (!intentId) {
      return { ok: false, error: 'initiate: missing intentId in response' }
    }

    const checkoutUrl = String(initiateJson?.data?.checkoutUrl || '')
    const providerMeta = initiateJson?.data?.metadata || {}
    const providerMode = String(providerMeta?.mode || '').toLowerCase()

    if (expectLiveCheckout) {
      if (!checkoutUrl || checkoutUrl.includes('pay.mock.gostaylo')) {
        return {
          ok: false,
          error: `live initiate expected YooKassa checkoutUrl, got mode=${providerMode || 'unknown'} url=${checkoutUrl || '(empty)'}`,
        }
      }
      const testAssert = await assertYookassaTestShopLiveInitiate(initiateJson)
      if (!testAssert.ok) {
        return testAssert
      }
    } else if (checkoutUrl && !checkoutUrl.includes('pay.mock.gostaylo')) {
      // Mock-path smoke may still run against real keys in dev; allow non-mock URL.
    }

    const { data: afterInitiate, error: stErr } = await supabaseAdmin
      .from('bookings')
      .select('status')
      .eq('id', id)
      .maybeSingle()

    if (stErr) return { ok: false, error: stErr.message }
    if (String(afterInitiate?.status || '').toUpperCase() !== 'AWAITING_PAYMENT') {
      return {
        ok: false,
        error: `after initiate expected AWAITING_PAYMENT, got ${afterInitiate?.status}`,
      }
    }

    const webhookPayload = buildWebhookPayload({ bookingId: id, intentId: String(intentId) })
    const rawBody = JSON.stringify(webhookPayload)
    const signature = signWebhookBody(rawBody, secret)

    const { POST: postWebhook } = await import('@/app/api/webhooks/payments/confirm/route.js')
    const webhookReq = new NextRequest('http://smoke.local/api/webhooks/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-yookassa-signature': signature,
        'x-payment-adapter': adapterHeader,
      },
      body: rawBody,
    })

    const webhookRes = await postWebhook(webhookReq)
    const webhookJson = await webhookRes.json().catch(() => ({}))

    if (!webhookRes.ok || webhookJson?.success === false) {
      return {
        ok: false,
        error:
          webhookJson?.error ||
          webhookJson?.code ||
          `webhook HTTP ${webhookRes.status}`,
      }
    }

    return {
      ok: true,
      intentId: String(intentId),
      checkoutUrl,
      providerMode,
      initiateJson,
      webhookJson,
    }
  } finally {
    restoreWebhookSecretEnv(envRestore)
    clearSmokeFinancialSessionUserId()
  }
}

function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}

/**
 * In-process POST /api/v2/bookings (uses smoke session override + real route handler).
 * @param {{ guestId: string, body: object }} p
 */
export async function postBookingCreateViaHttp({ guestId, body }) {
  setSmokeFinancialSessionUserId(guestId)
  try {
    const { POST } = await import('@/app/api/v2/bookings/route.js')
    const req = new NextRequest('http://smoke.local/api/v2/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const res = await POST(req)
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json }
  } finally {
    clearSmokeFinancialSessionUserId()
  }
}

/**
 * Stage 149.3 — atomic RPC on max_capacity=1 + invoice_hold expiry (processExpiredPendingInvoices path).
 * @param {{
 *   partnerId: string,
 *   guestId: string,
 *   categoryId: string,
 *   priceThb?: number,
 *   commissionRate?: number,
 *   tag?: string,
 * }} params
 */
export async function runStage149AtomicRpcSmokeStep(params) {
  const partnerId = String(params.partnerId || '')
  const guestId = String(params.guestId || '')
  const categoryId = String(params.categoryId || '')
  const priceThb = Math.max(500, Number(params.priceThb) || 5000)
  const commissionRate = Math.max(0, Number(params.commissionRate) || 10)
  const tag = String(params.tag || `${E2E_TEST_DATA_TAG} stage149-rpc-smoke`)

  if (!partnerId || !guestId || !categoryId || !supabaseAdmin) {
    return { ok: false, error: 'missing partnerId/guestId/categoryId or Supabase' }
  }

  const listingId = STAGE149_RPC_SMOKE_LISTING_ID
  const guestBId = `user-smoke-guestb-${Date.now().toString(36)}`

  let effectiveCategoryId = categoryId
  const { data: catRows } = await supabaseAdmin.from('categories').select('id, slug')
  const housingCat = (catRows || []).find(
    (c) => !['tours', 'vehicles'].includes(String(c.slug || '').toLowerCase()),
  )
  if (housingCat?.id) effectiveCategoryId = housingCat.id

  const { data: oldBookings } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('listing_id', listingId)
  const oldIds = (oldBookings || []).map((b) => b.id)
  if (oldIds.length) {
    const { data: convs } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .in('booking_id', oldIds)
    const convIds = (convs || []).map((c) => c.id)
    if (convIds.length) {
      await supabaseAdmin.from('messages').delete().in('conversation_id', convIds)
      await supabaseAdmin.from('conversations').delete().in('id', convIds)
    }
    await supabaseAdmin.from('bookings').delete().in('id', oldIds)
  }
  await supabaseAdmin.from('calendar_blocks').delete().eq('listing_id', listingId)

  const { data: listingRow, error: lErr } = await supabaseAdmin
    .from('listings')
    .upsert(
      {
        id: listingId,
        owner_id: partnerId,
        category_id: effectiveCategoryId,
        status: 'ACTIVE',
        title: `${tag} cap1 RPC smoke`,
        description: tag,
        district: 'Smoke',
        base_price_thb: priceThb,
        commission_rate: commissionRate,
        images: [],
        available: true,
        instant_booking: true,
        max_capacity: 1,
        metadata: withFintechTestDataMeta({
          test_data_tag: E2E_TEST_DATA_TAG,
          stage149_rpc_smoke: true,
          max_guests: 1,
        }),
      },
      { onConflict: 'id' },
    )
    .select('id')
    .single()
  if (lErr || !listingRow?.id) {
    return { ok: false, error: `listing upsert: ${lErr?.message || 'no row'}` }
  }

  const hash = bcrypt.hashSync('smoke-stage149-pass', 8)
  const ts = new Date().toISOString()
  const { error: guestBErr } = await supabaseAdmin.from('profiles').upsert(
    {
      id: guestBId,
      email: `${guestBId}@smoke.invalid`,
      password_hash: hash,
      role: 'RENTER',
      first_name: 'SmokeGuestB',
      referral_code: `SB${Date.now().toString(36).slice(-6).toUpperCase()}`,
      terms_accepted: true,
      terms_accepted_at: ts,
      is_verified: true,
      language: 'ru',
    },
    { onConflict: 'id' },
  )
  if (guestBErr) return { ok: false, error: `guestB profile: ${guestBErr.message}` }

  const checkInDate = new Date()
  checkInDate.setUTCDate(checkInDate.getUTCDate() + 50 + (Date.now() % 30))
  const checkOutDate = new Date(checkInDate)
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 2)
  const checkIn = toDateOnly(checkInDate)
  const checkOut = toDateOnly(checkOutDate)

  let quote = await computeListingBookingQuote({
    listingId,
    checkIn,
    checkOut,
    guestsCount: 1,
    currency: 'THB',
  })
  if (quote.error === 'Listing not found') {
    await new Promise((r) => setTimeout(r, 400))
    quote = await computeListingBookingQuote({
      listingId,
      checkIn,
      checkOut,
      guestsCount: 1,
      currency: 'THB',
    })
  }
  if (quote.error) {
    return { ok: false, error: `quote: ${quote.error}` }
  }

  const { data: preflightListing, error: preflightErr } = await supabaseAdmin
    .from('listings')
    .select('id, owner:profiles!owner_id(id)')
    .eq('id', listingId)
    .maybeSingle()
  if (preflightErr || !preflightListing?.id) {
    return {
      ok: false,
      error: `preflight listing: ${preflightErr?.message || 'not visible before POST'}`,
    }
  }

  const bookingBody = {
    listingId,
    checkIn,
    checkOut,
    guestsCount: 1,
    guestName: 'Smoke Guest A',
    guestEmail: `${guestId}@smoke.invalid`,
    currency: 'THB',
    clientQuotedSubtotalThb: quote.subtotalThb,
    clientQuotedGuestTotalThb: quote.guestTotalThb,
    uiLocale: 'ru',
  }

  const first = await postBookingCreateViaHttp({ guestId, body: bookingBody })
  const firstOk =
    (first.status === 200 || first.status === 201) &&
    first.json?.success === true &&
    first.json?.booking?.id
  if (!firstOk) {
    return {
      ok: false,
      error: `first POST expected 200/201 success, got HTTP ${first.status} error=${String(first.json?.error || first.json?.error_code || '—').slice(0, 120)} code=${first.json?.code || '—'}`,
    }
  }

  const firstBookingId = String(first.json.booking.id)

  const second = await postBookingCreateViaHttp({ guestId: guestBId, body: bookingBody })
  if (second.status !== 409 || second.json?.code !== 'DATES_CONFLICT') {
    return {
      ok: false,
      error: `second POST expected 409 DATES_CONFLICT, got HTTP ${second.status} code=${second.json?.code || '—'}`,
    }
  }

  const invoiceId = randomUUID()
  const smokeConvId = `conv-smoke-149-${Date.now().toString(36)}`
  const pastIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const holdUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const invCheckIn = new Date()
  invCheckIn.setUTCDate(invCheckIn.getUTCDate() + 60)
  const invCheckOut = new Date(invCheckIn)
  invCheckOut.setUTCDate(invCheckOut.getUTCDate() + 2)

  const { error: convErr } = await supabaseAdmin.from('conversations').insert({
    id: smokeConvId,
    listing_id: listingId,
    booking_id: firstBookingId,
    partner_id: partnerId,
    renter_id: guestId,
    type: 'BOOKING',
    status: 'OPEN',
    status_label: 'CONFIRMED',
    is_priority: false,
    created_at: pastIso,
    updated_at: pastIso,
    last_message_at: pastIso,
  })
  if (convErr) return { ok: false, error: `invoice conversation: ${convErr.message}` }

  const { error: invErr } = await supabaseAdmin.from('invoices').insert({
    id: invoiceId,
    conversation_id: smokeConvId,
    amount: 100,
    status: 'pending',
    created_at: pastIso,
    metadata: withFintechTestDataMeta({
      expires_at: pastIso,
      listing_id: listingId,
      test_data_tag: E2E_TEST_DATA_TAG,
      smoke_stage149: true,
    }),
  })
  if (invErr) return { ok: false, error: `invoice insert: ${invErr.message}` }

  const { data: holdRow, error: holdErr } = await supabaseAdmin
    .from('calendar_blocks')
    .insert({
      listing_id: listingId,
      start_date: invCheckIn.toISOString(),
      end_date: invCheckOut.toISOString(),
      source: INVOICE_HOLD_SOURCE,
      units_blocked: 1,
      reason: `Invoice ${invoiceId} — payment pending (smoke)`,
      expires_at: holdUntil,
    })
    .select('id')
    .maybeSingle()
  if (holdErr || !holdRow?.id) {
    return { ok: false, error: `invoice_hold insert: ${holdErr?.message || 'no row'}` }
  }

  const nowIso = new Date().toISOString()

  // Mirror cron processExpiredPendingInvoices: pending → expired (Stage 149.4 status constraint).
  const { data: expiredRows, error: expUpErr } = await supabaseAdmin
    .from('invoices')
    .update({
      status: 'expired',
      updated_at: nowIso,
      metadata: withFintechTestDataMeta({
        expires_at: pastIso,
        listing_id: listingId,
        expired_at: nowIso,
        expired_reason: 'payment_window_elapsed',
        test_data_tag: E2E_TEST_DATA_TAG,
        smoke_stage149: true,
      }),
    })
    .eq('id', invoiceId)
    .eq('status', 'pending')
    .select('id, status')
  if (expUpErr) {
    return { ok: false, error: `invoice expire update: ${expUpErr.message}` }
  }
  if (String(expiredRows?.[0]?.status || '').toLowerCase() !== 'expired') {
    return { ok: false, error: 'processExpiredPendingInvoices: invoice not expired' }
  }

  const holdResult = await expireInvoiceHoldBlocks({
    invoiceId,
    listingId,
    nowIso,
  })
  if (holdResult.released < 1) {
    return {
      ok: false,
      error: `invoice_hold not released (released=${holdResult.released})`,
    }
  }

  const { data: blockAfter } = await supabaseAdmin
    .from('calendar_blocks')
    .select('expires_at')
    .eq('id', holdRow.id)
    .maybeSingle()
  const blockExpired =
    blockAfter?.expires_at && Date.parse(String(blockAfter.expires_at)) <= Date.now()
  if (!blockExpired) {
    return { ok: false, error: 'invoice_hold block still active after expiry' }
  }

  await supabaseAdmin.from('calendar_blocks').delete().eq('id', holdRow.id)
  await supabaseAdmin.from('invoices').delete().eq('id', invoiceId)
  await supabaseAdmin.from('conversations').delete().eq('id', smokeConvId)

  return {
    ok: true,
    detail: `RPC booking ${firstBookingId.slice(0, 10)}… · conflict 409 · invoice_hold released=${holdResult.released}`,
    bookingId: firstBookingId,
  }
}
