import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyTronTransaction, GOSTAYLO_WALLET, thbToUsdt } from '@/lib/services/tron.service'
import { getExpectedUsdtForBooking } from '@/lib/booking-price-integrity'
import PaymentIntentService from '@/lib/services/payment-intent.service'
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { assertWebhookGuestPaymentAllowed } from '@/lib/payment/webhook-guest-payment-gate.js'
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js'
import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'
import {
  cryptoPaymentIdempotencyKey,
  normalizeCryptoTxid,
} from '@/lib/payment/crypto-txid-replay-guard.js'
import {
  buildCryptoIdempotentSettledResult,
  classifyCryptoTxidReplay,
  settleCryptoPayment,
} from '@/lib/payment/settle-crypto-payment.js'

export const dynamic = 'force-dynamic'

function idempotentPaidBookingResponse(booking) {
  return NextResponse.json(buildCryptoIdempotentSettledResult(booking))
}

function getConfiguredSecret() {
  return String(process.env.CRYPTO_WEBHOOK_SHARED_SECRET || '').trim()
}

/**
 * Stage 200.69 — production: header-only secret. Non-prod may accept body for local tooling.
 */
function verifySharedSecret(request, body) {
  const expected = getConfiguredSecret()
  if (!expected) {
    return { ok: false, error: 'CRYPTO_WEBHOOK_SHARED_SECRET is not configured' }
  }
  const header =
    request.headers.get('x-crypto-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    ''
  const fromBody = body?.webhookSecret ?? body?.sharedSecret ?? ''
  const prod = isProductionPaymentEnvironment()
  if (prod && !String(header || '').trim()) {
    return { ok: false, error: 'invalid_secret' }
  }
  const candidate = String((prod ? header : header || fromBody) || '')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(candidate, 'utf8')
    if (a.length !== b.length) return { ok: false, error: 'invalid_secret' }
    if (!timingSafeEqual(a, b)) return { ok: false, error: 'invalid_secret' }
  } catch {
    return { ok: false, error: 'invalid_secret' }
  }
  return { ok: true }
}

/**
 * Post-escrow extension invoice on PAID_ESCROW+ booking (parity with payments/confirm webhook).
 */
async function tryPostEscrowInvoiceFromCryptoWebhook({ booking, bookingId, txid, body }) {
  if (!isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
    return null
  }

  const invoiceIdFromBody = body?.invoiceId || body?.invoice_id || null
  const intentRes = invoiceIdFromBody
    ? await PaymentIntentService.findActiveByBookingOrInvoice({
        bookingId,
        invoiceId: String(invoiceIdFromBody),
      })
    : await PaymentIntentService.findActiveByBookingOrInvoice({ bookingId })
  if (!intentRes.success || !intentRes.intent?.invoiceId) {
    return null
  }

  const intent = intentRes.intent
  const amountThb = Number(intent.amountThb)
  const expectedUsdt =
    Number.isFinite(amountThb) && amountThb > 0 ? await thbToUsdt(amountThb) : null
  if (!Number.isFinite(expectedUsdt) || expectedUsdt <= 0) {
    return NextResponse.json(
      { success: false, error: 'Could not resolve expected USDT amount for post-escrow invoice' },
      { status: 400 },
    )
  }

  const verification = await verifyTronTransaction(txid, expectedUsdt)
  if (!verification.success) {
    return NextResponse.json(
      {
        success: false,
        verified: false,
        error: verification.error || verification.status,
        status: verification.status,
      },
      { status: 400 },
    )
  }

  const marked = await PaymentIntentService.markPaid(intent.id, {
    source: 'crypto_webhook_post_escrow',
    txId: txid,
    gatewayRef: verification?.data?.blockNumber ? String(verification.data.blockNumber) : null,
    raw: verification.data,
  })
  if (!marked.success) {
    console.warn('[crypto/confirm] post-escrow markPaid:', marked.error)
  }

  const invoiceEffect = await applyInvoicePostPaymentEffects({
    bookingId,
    invoiceId: intent.invoiceId,
    txId: txid,
    gatewayRef: verification?.data?.blockNumber ? String(verification.data.blockNumber) : null,
    source: 'crypto_webhook_post_escrow',
  })

  const status = String(booking.status || '').toUpperCase()
  return NextResponse.json({
    success: true,
    verified: true,
    bookingId,
    intentId: intent.id,
    idempotent: true,
    alreadyProcessed: true,
    postEscrowInvoice: true,
    bookingStatus: status,
    ...(status === 'PAID_ESCROW' ? { alreadyEscrowed: true } : {}),
    invoiceEffect,
    data: {
      txid,
      bookingId,
      intentId: intent.id,
      tron: verification.data,
    },
  })
}

function settleResultToResponse(settled, { txid, verified = true, tronData = null }) {
  if (settled.success) {
    return NextResponse.json({
      success: true,
      verified,
      idempotent: Boolean(settled.idempotent || settled.alreadyProcessed),
      alreadyProcessed: Boolean(settled.alreadyProcessed),
      alreadyConfirmed: Boolean(settled.alreadyConfirmed),
      escrowHealed: Boolean(settled.escrowHealed),
      alreadyEscrowed: Boolean(settled.alreadyEscrowed),
      bookingId: settled.bookingId,
      bookingStatus: settled.bookingStatus,
      data: {
        txid,
        bookingId: settled.bookingId,
        paymentId: settled.paymentId,
        intentId: settled.intentId,
        ...(tronData ? { tron: tronData } : {}),
      },
    })
  }
  return NextResponse.json(
    {
      success: false,
      verified,
      error: settled.error || 'settle_failed',
      code: settled.code,
      bookingId: settled.bookingId,
      txid,
    },
    { status: settled.httpStatus || 500 },
  )
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch (parseErr) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — невалидный JSON\n<code>${escapeSystemAlertHtml(parseErr?.message || parseErr)}</code>`,
      )
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const secretCheck = verifySharedSecret(request, body)
    if (!secretCheck.ok) {
      const status = secretCheck.error === 'invalid_secret' ? 401 : 503
      if (status === 503) {
        void notifySystemAlert(
          '🔌 <b>Webhook: crypto/confirm</b> — не задан <code>CRYPTO_WEBHOOK_SHARED_SECRET</code>',
        )
      }
      return NextResponse.json(
        {
          success: false,
          error: secretCheck.error === 'invalid_secret' ? 'Unauthorized' : secretCheck.error,
        },
        { status },
      )
    }

    const { txid: rawTxid, bookingId, targetWallet } = body || {}
    const txid = normalizeCryptoTxid(rawTxid)
    if (!txid || !bookingId) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — нет txid/bookingId\n<code>${escapeSystemAlertHtml(JSON.stringify(body).slice(0, 500))}</code>`,
      )
      return NextResponse.json({ success: false, error: 'Missing txid or bookingId' }, { status: 400 })
    }

    const guestGate = await assertWebhookGuestPaymentAllowed({
      bookingId,
      channel: 'crypto/confirm',
    })
    if (!guestGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: guestGate.message,
          code: guestGate.code || 'PAYMENT_BLOCKED',
        },
        { status: 403 },
      )
    }

    if (targetWallet && String(targetWallet) !== String(GOSTAYLO_WALLET)) {
      return NextResponse.json(
        { success: false, verified: false, error: 'targetWallet does not match platform wallet' },
        { status: 400 },
      )
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    // Escrow already done → 2xx before replay guard (Stage 200.69)
    if (isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
      const postEscrow = await tryPostEscrowInvoiceFromCryptoWebhook({
        booking,
        bookingId,
        txid,
        body,
      })
      if (postEscrow) return postEscrow
      return idempotentPaidBookingResponse(booking)
    }

    const replay = await classifyCryptoTxidReplay(supabaseAdmin, { txid, bookingId })
    if (replay.kind === 'foreign_booking') {
      return NextResponse.json(
        {
          success: false,
          error: replay.error || 'already_processed',
          code: replay.code || 'TXID_ALREADY_USED',
          idempotencyKey: cryptoPaymentIdempotencyKey(txid, bookingId),
          existingBookingId: replay.existingBookingId || null,
        },
        { status: replay.status || 409 },
      )
    }
    if (replay.kind === 'error') {
      return NextResponse.json(
        {
          success: false,
          error: replay.error,
          code: replay.code,
          idempotencyKey: cryptoPaymentIdempotencyKey(txid, bookingId),
        },
        { status: replay.status || 500 },
      )
    }

    // Same booking + txid already recorded but not yet escrowed → heal without re-verify gate
    if (replay.kind === 'idempotent_same_booking') {
      const healed = await settleCryptoPayment({
        bookingId,
        booking,
        txid,
        tronData: null,
        source: 'crypto_webhook_reconcile',
        invoiceId: body?.invoiceId || body?.invoice_id || null,
      })
      if (healed.success) {
        return settleResultToResponse(healed, { txid, verified: true })
      }
      // Fall through to chain verify + settle if heal could not find payment target mid-flight
      if (healed.code !== 'NO_PAYMENT_TARGET') {
        return settleResultToResponse(healed, { txid, verified: true })
      }
    }

    const expectedUsdt = await getExpectedUsdtForBooking(booking)
    if (!Number.isFinite(expectedUsdt) || expectedUsdt <= 0) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve expected USDT amount' },
        { status: 400 },
      )
    }

    const verification = await verifyTronTransaction(txid, expectedUsdt)
    if (!verification.success) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: verification.error || verification.status,
          status: verification.status,
        },
        { status: 400 },
      )
    }

    const settled = await settleCryptoPayment({
      bookingId,
      booking,
      txid,
      tronData: verification.data,
      source: 'crypto_webhook',
      invoiceId: body?.invoiceId || body?.invoice_id || null,
    })
    if (!settled.success && settled.code === 'NO_PAYMENT_TARGET') {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — нет PENDING payment и нет active intent\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>`,
      )
    } else if (!settled.success && settled.httpStatus === 500) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — Tron OK, settle упал\n` +
          `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
          `<code>${escapeSystemAlertHtml(String(settled.error || '').slice(0, 600))}</code>`,
      )
    }
    return settleResultToResponse(settled, { txid, verified: true, tronData: verification.data })
  } catch (error) {
    console.error('Crypto webhook error:', error)
    void notifySystemAlert(
      `🔌 <b>Webhook: crypto/confirm</b> — необработанная ошибка\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET() {
  const prod = isProductionPaymentEnvironment()
  return NextResponse.json({
    success: true,
    message: 'Crypto verification webhook is active',
    info: {
      endpoint: 'POST /api/webhooks/crypto/confirm',
      auth: prod
        ? 'Header x-crypto-webhook-secret (or x-webhook-secret) required in production'
        : 'Header x-crypto-webhook-secret / x-webhook-secret, or body webhookSecret (non-prod only)',
      required_fields: ['txid', 'bookingId'],
      optional_fields: ['targetWallet', 'invoiceId'],
      network: 'TRC-20 (USDT)',
    },
  })
}
