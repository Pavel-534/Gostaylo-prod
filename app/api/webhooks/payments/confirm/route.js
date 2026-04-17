/**
 * POST /api/webhooks/payments/confirm
 * Acquiring webhook (Mandarin / YooKassa–совместимый контракт): HMAC-SHA256 тела + confirmPayment.
 *
 * Подпись: заголовок `X-Webhook-Signature` = hex SHA256-HMAC(rawBody, PAYMENT_ACQUIRING_WEBHOOK_SECRET).
 * Тело (JSON), примеры:
 * - Плоское: { "bookingId", "paymentId?", "amount", "currency": "THB", "paid": true }
 * - YooKassa-style: { "event": "payment.succeeded", "object": { "amount": { "value", "currency" }, "metadata": { "booking_id", "payment_id" } } }
 */

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentsV3Service } from '@/lib/services/payments-v3.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';

export const dynamic = 'force-dynamic';

function getWebhookSecret() {
  return String(process.env.PAYMENT_ACQUIRING_WEBHOOK_SECRET || '').trim();
}

function verifySignature(rawBody, signatureHeader) {
  const secret = getWebhookSecret();
  if (!secret) return { ok: false, error: 'PAYMENT_ACQUIRING_WEBHOOK_SECRET is not configured' };
  const sig = String(signatureHeader || '').trim();
  const expectedHex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(expectedHex, 'utf8');
    const b = Buffer.from(sig, 'utf8');
    if (a.length !== b.length) return { ok: false, error: 'invalid_signature' };
    if (!timingSafeEqual(a, b)) return { ok: false, error: 'invalid_signature' };
  } catch {
    return { ok: false, error: 'invalid_signature' };
  }
  return { ok: true };
}

function parsePayload(json) {
  if (json?.object?.metadata && json.object?.amount) {
    const md = json.object.metadata;
    const bookingId = md.booking_id || md.bookingId;
    const paymentId = md.payment_id || md.paymentId;
    const paid =
      json.event === 'payment.succeeded' ||
      json.event === 'payment.captured' ||
      json.object?.status === 'succeeded';
    const amount = parseFloat(json.object.amount?.value);
    const currency = String(json.object.amount?.currency || '').toUpperCase();
    return { bookingId, paymentId, amount, currency, paid };
  }

  const bookingId = json.bookingId || json.booking_id;
  const paymentId = json.paymentId || json.payment_id;
  const amount = json.amount != null ? parseFloat(json.amount) : parseFloat(json.amountThb);
  const currency = String(json.currency || 'THB').toUpperCase();
  const paid =
    json.paid === true ||
    json.status === 'succeeded' ||
    json.success === true;
  return { bookingId, paymentId, amount, currency, paid };
}

async function resolveExpectedGuestTotalThb(booking) {
  const gross = parseFloat(booking.price_thb) || 0;
  const fee = parseFloat(booking.commission_thb) || 0;
  const pot = parseFloat(booking.rounding_diff_pot) || 0;
  const ex = parseFloat(booking.exchange_rate);
  const pp = parseFloat(booking.price_paid);
  if (Number.isFinite(ex) && ex > 0 && Number.isFinite(pp) && pp > 0) {
    return Math.round(pp * ex * 100) / 100;
  }
  return Math.round((gross + fee + pot) * 100) / 100;
}

export async function POST(request) {
  const rawBody = await request.text();
  const sig = request.headers.get('x-webhook-signature') || request.headers.get('x-payment-signature');

  const v = verifySignature(rawBody, sig);
  if (!v.ok) {
    const status = v.error === 'invalid_signature' ? 401 : 503;
    if (status === 503) {
      void notifySystemAlert(
        '💳 <b>Webhook payments/confirm</b> — не задан <code>PAYMENT_ACQUIRING_WEBHOOK_SECRET</code>',
      );
    }
    return NextResponse.json(
      { success: false, error: v.error === 'invalid_signature' ? 'Unauthorized' : v.error },
      { status },
    );
  }

  let json;
  try {
    json = JSON.parse(rawBody || '{}');
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { bookingId, paymentId, amount, currency, paid } = parsePayload(json);
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
  }
  if (!paid) {
    return NextResponse.json({ success: true, ignored: true, reason: 'not_paid' });
  }

  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (bErr || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  const expectedThb = await resolveExpectedGuestTotalThb(booking);
  if (Number.isFinite(amount) && amount > 0 && String(currency || 'THB').toUpperCase() === 'THB') {
    const tol = 1.0;
    if (Math.abs(amount - expectedThb) > tol) {
      void notifySystemAlert(
        `💳 <b>Webhook payments/confirm</b> — расхождение суммы\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>\nexpected THB: <b>${expectedThb}</b>, got: <b>${escapeSystemAlertHtml(String(amount))}</b>`,
      );
      return NextResponse.json(
        { success: false, error: 'AMOUNT_MISMATCH', expectedThb, received: amount },
        { status: 400 },
      );
    }
  }

  let payId = paymentId;
  if (!payId) {
    const { data: pay } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    payId = pay?.id || null;
  }
  if (!payId) {
    return NextResponse.json(
      { success: false, error: 'No pending payment for booking' },
      { status: 409 },
    );
  }

  const confirm = await PaymentsV3Service.confirmPayment(payId, {
    source: 'payment_acquiring_webhook',
    bookingId,
    raw: json,
  });

  if (!confirm?.success) {
    void notifySystemAlert(
      `💳 <b>Webhook payments/confirm</b> — confirmPayment failed\n<code>${escapeSystemAlertHtml(String(confirm?.error || ''))}</code>`,
    );
    return NextResponse.json(
      { success: false, error: confirm?.error || 'confirmPayment failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    paymentId: payId,
    bookingId,
    escrow: confirm.escrow || null,
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST JSON with HMAC signature (X-Webhook-Signature = HMAC-SHA256 hex of raw body)',
    env: ['PAYMENT_ACQUIRING_WEBHOOK_SECRET'],
  });
}
