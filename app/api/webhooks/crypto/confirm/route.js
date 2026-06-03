import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTronTransaction, GOSTAYLO_WALLET } from '@/lib/services/tron.service';
import { getExpectedUsdtForBooking } from '@/lib/booking-price-integrity';
import { PaymentsV3Service } from '@/lib/services/payments-v3.service';
import PaymentIntentService from '@/lib/services/payment-intent.service';
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service';
import EscrowService from '@/lib/services/escrow.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { assertWebhookGuestPaymentAllowed } from '@/lib/payment/webhook-guest-payment-gate.js';
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js';

export const dynamic = 'force-dynamic';

/**
 * Crypto/Tron retries after successful capture: `bookings.status` is SSOT (PAID_ESCROW+ / COMPLETED).
 * Same idempotent set as acquiring webhook — skip verifyTron, confirmPayment, moveToEscrow.
 */
function idempotentPaidBookingResponse(booking) {
  const bookingId = String(booking.id);
  const status = String(booking.status || '').toUpperCase();
  return NextResponse.json({
    success: true,
    bookingId,
    idempotent: true,
    alreadyProcessed: true,
    bookingStatus: status,
    ...(status === 'PAID_ESCROW' ? { alreadyEscrowed: true } : {}),
  });
}

function getConfiguredSecret() {
  return String(process.env.CRYPTO_WEBHOOK_SHARED_SECRET || '').trim();
}

function verifySharedSecret(request, body) {
  const expected = getConfiguredSecret();
  if (!expected) {
    return { ok: false, error: 'CRYPTO_WEBHOOK_SHARED_SECRET is not configured' };
  }
  const header =
    request.headers.get('x-crypto-webhook-secret') ||
    request.headers.get('x-webhook-secret') ||
    '';
  const fromBody = body?.webhookSecret ?? body?.sharedSecret ?? '';
  const candidate = String(header || fromBody || '');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    if (a.length !== b.length) return { ok: false, error: 'invalid_secret' };
    if (!timingSafeEqual(a, b)) return { ok: false, error: 'invalid_secret' };
  } catch {
    return { ok: false, error: 'invalid_secret' };
  }
  return { ok: true };
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseErr) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — невалидный JSON\n<code>${escapeSystemAlertHtml(parseErr?.message || parseErr)}</code>`,
      );
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const secretCheck = verifySharedSecret(request, body);
    if (!secretCheck.ok) {
      const status = secretCheck.error === 'invalid_secret' ? 401 : 503;
      if (status === 503) {
        void notifySystemAlert(
          '🔌 <b>Webhook: crypto/confirm</b> — не задан <code>CRYPTO_WEBHOOK_SHARED_SECRET</code>',
        );
      }
      return NextResponse.json(
        { success: false, error: secretCheck.error === 'invalid_secret' ? 'Unauthorized' : secretCheck.error },
        { status },
      );
    }

    const { txid, bookingId, expectedAmount, targetWallet } = body || {};
    if (!txid || !bookingId) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — нет txid/bookingId\n<code>${escapeSystemAlertHtml(JSON.stringify(body).slice(0, 500))}</code>`,
      );
      return NextResponse.json({ success: false, error: 'Missing txid or bookingId' }, { status: 400 });
    }

    const guestGate = await assertWebhookGuestPaymentAllowed({
      bookingId,
      channel: 'crypto/confirm',
    });
    if (!guestGate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: guestGate.message,
          code: guestGate.code || 'PAYMENT_BLOCKED',
        },
        { status: 403 },
      );
    }

    if (targetWallet && String(targetWallet) !== String(GOSTAYLO_WALLET)) {
      return NextResponse.json(
        { success: false, verified: false, error: 'targetWallet does not match platform wallet' },
        { status: 400 },
      );
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();
    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    if (isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
      return idempotentPaidBookingResponse(booking);
    }

    const expectedFromDb = await getExpectedUsdtForBooking(booking);
    const expectedUsdt =
      expectedAmount != null && String(expectedAmount).trim() !== ''
        ? parseFloat(expectedAmount)
        : expectedFromDb;
    if (!Number.isFinite(expectedUsdt) || expectedUsdt <= 0) {
      return NextResponse.json(
        { success: false, error: 'Could not resolve expected USDT amount' },
        { status: 400 },
      );
    }

    const verification = await verifyTronTransaction(txid, expectedUsdt);
    if (!verification.success) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: verification.error || verification.status,
          status: verification.status,
        },
        { status: 400 },
      );
    }

    const { data: latestPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPayment?.status === 'CONFIRMED') {
      return NextResponse.json({
        success: true,
        verified: true,
        alreadyConfirmed: true,
        bookingId,
        txid,
      });
    }

    if (latestPayment?.id && latestPayment.status === 'PENDING') {
      const confirm = await PaymentsV3Service.confirmPayment(latestPayment.id, {
        source: 'crypto_webhook',
        txid,
        tron: verification.data,
      });
      if (!confirm?.success) {
        console.error('[CRYPTO CONFIRM] confirmPayment failed:', confirm?.error);
        void notifySystemAlert(
          `🔌 <b>Webhook: crypto/confirm</b> — Tron OK, confirmPayment упал\n` +
            `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
            `<code>${escapeSystemAlertHtml(String(confirm?.error || '').slice(0, 600))}</code>`,
        );
        return NextResponse.json(
          { success: false, error: confirm?.error || 'confirmPayment failed' },
          { status: 500 },
        );
      }
      return NextResponse.json({
        success: true,
        verified: true,
        data: {
          txid,
          bookingId,
          paymentId: latestPayment.id,
          tron: verification.data,
        },
      });
    }

    const intentRes = await PaymentIntentService.findActiveByBookingOrInvoice({ bookingId })
    if (!intentRes.success || !intentRes.intent) {
      void notifySystemAlert(
        `🔌 <b>Webhook: crypto/confirm</b> — нет PENDING payment и нет active intent\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>`,
      )
      return NextResponse.json(
        { success: false, error: 'No pending payment row or active payment intent for this booking' },
        { status: 409 },
      )
    }
    const intent = intentRes.intent
    const marked = await PaymentIntentService.markPaid(intent.id, {
      source: 'crypto_webhook',
      txId: txid,
      gatewayRef: verification?.data?.blockNumber ? String(verification.data.blockNumber) : null,
      raw: verification.data,
    })
    if (!marked.success) {
      return NextResponse.json({ success: false, error: marked.error || 'intent_mark_failed' }, { status: 500 })
    }

    const captureGuestTotalThb = Number(intent.amountThb)
    const escrow = await EscrowService.moveToEscrow(bookingId, {
      txId: txid,
      gatewayRef: verification?.data?.blockNumber ? String(verification.data.blockNumber) : null,
      source: 'crypto_webhook_intent',
      captureGuestTotalThb:
        Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0 ? captureGuestTotalThb : undefined,
    })
    if (!escrow?.success) {
      return NextResponse.json({ success: false, error: escrow?.error || 'escrow_failed' }, { status: 502 })
    }
    await applyInvoicePostPaymentEffects({
      bookingId,
      invoiceId: intent.invoiceId || null,
      txId: txid,
      gatewayRef: verification?.data?.blockNumber ? String(verification.data.blockNumber) : null,
      source: 'crypto_webhook_intent',
    })

    return NextResponse.json({
      success: true,
      verified: true,
      data: {
        txid,
        bookingId,
        intentId: intent.id,
        tron: verification.data,
      },
    })
  } catch (error) {
    console.error('Crypto webhook error:', error);
    void notifySystemAlert(
      `🔌 <b>Webhook: crypto/confirm</b> — необработанная ошибка\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Crypto verification webhook is active',
    info: {
      endpoint: 'POST /api/webhooks/crypto/confirm',
      auth: 'Header x-crypto-webhook-secret or body webhookSecret (must match CRYPTO_WEBHOOK_SHARED_SECRET)',
      required_fields: ['txid', 'bookingId'],
      optional_fields: ['expectedAmount', 'targetWallet'],
      network: 'TRC-20 (USDT)',
    },
  });
}
