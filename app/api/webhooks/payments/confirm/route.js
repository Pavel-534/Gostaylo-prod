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
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentsV3Service } from '@/lib/services/payments-v3.service';
import PaymentIntentService from '@/lib/services/payment-intent.service';
import EscrowService from '@/lib/services/escrow.service';
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import {
  resolveAdapterFromWebhook,
  verifyWebhookSignatureByAdapter,
} from '@/lib/services/payment-adapters/webhook-signature';
import {
  isIntentPaidStatus,
  normalizeProviderStatus,
} from '@/lib/services/payment-adapters/status-normalizer';

export const dynamic = 'force-dynamic';

function parsePayload(json, adapterKey) {
  if (json?.object?.metadata && json.object?.amount) {
    const md = json.object.metadata;
    const bookingId = md.booking_id || md.bookingId;
    const paymentId = md.payment_id || md.paymentId;
    const intentId = md.payment_intent_id || md.paymentIntentId || null;
    const normalizedStatus = normalizeProviderStatus({ adapterKey, payload: json });
    const amount = parseFloat(json.object.amount?.value);
    const currency = String(json.object.amount?.currency || '').toUpperCase();
    const gatewayRef = String(json?.object?.id || json?.id || '');
    return { bookingId, paymentId, intentId, amount, currency, gatewayRef, normalizedStatus };
  }

  const bookingId = json.bookingId || json.booking_id;
  const paymentId = json.paymentId || json.payment_id;
  const intentId = json.paymentIntentId || json.payment_intent_id || null;
  const amount = json.amount != null ? parseFloat(json.amount) : parseFloat(json.amountThb);
  const currency = String(json.currency || 'THB').toUpperCase();
  const normalizedStatus = normalizeProviderStatus({ adapterKey, payload: json });
  const gatewayRef = String(json?.object?.id || json?.id || '');
  return { bookingId, paymentId, intentId, amount, currency, gatewayRef, normalizedStatus };
}

/** YooKassa-style nested object.metadata must include both booking and intent ids (our adapters always send them). */
function assertGatewayObjectMetadata(json) {
  const md = json?.object?.metadata;
  if (!md || typeof md !== 'object' || Array.isArray(md)) return { ok: true };
  const bid = md.booking_id || md.bookingId;
  const pid = md.payment_intent_id || md.paymentIntentId;
  if (!bid || !pid) {
    return {
      ok: false,
      error: 'Gateway payment requires object.metadata.booking_id and object.metadata.payment_intent_id',
    };
  }
  return { ok: true };
}

async function resolveExpectedGuestTotalThbFromBooking(booking) {
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

/**
 * Resolve Payment Intent for amount verification (and later markPaid).
 * If client sent explicit pi-* / intent id, it must exist and belong to bookingId.
 */
async function resolvePaymentIntentForWebhook({ bookingId, intentIdFromPayload, paymentIdFromPayload }) {
  const explicitId =
    intentIdFromPayload ||
    (paymentIdFromPayload && String(paymentIdFromPayload).startsWith('pi-') ? paymentIdFromPayload : null);

  if (explicitId) {
    const r = await PaymentIntentService.getById(explicitId);
    if (!r.success || !r.intent || String(r.intent.bookingId) !== String(bookingId)) {
      return { intent: null, error: 'INTENT_NOT_FOUND_OR_BOOKING_MISMATCH' };
    }
    return { intent: r.intent, error: null };
  }

  const r2 = await PaymentIntentService.findActiveByBookingOrInvoice({ bookingId });
  if (r2.success && r2.intent && String(r2.intent.bookingId) === String(bookingId)) {
    return { intent: r2.intent, error: null };
  }
  return { intent: null, error: null };
}

export async function POST(request) {
  const rawBody = await request.text();
  let json;
  try {
    json = JSON.parse(rawBody || '{}');
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const adapterKey = resolveAdapterFromWebhook({ request, payload: json });
  const v = verifyWebhookSignatureByAdapter({ adapterKey, request, rawBody });
  if (!v.ok) {
    const status = v.error === 'invalid_signature' ? 401 : 503;
    if (status === 503) {
      void notifySystemAlert(
        `💳 <b>Webhook payments/confirm</b> — не задан секрет адаптера <code>${escapeSystemAlertHtml(
          v.adapter || adapterKey,
        )}</code>`,
      );
    }
    return NextResponse.json(
      { success: false, error: v.error === 'invalid_signature' ? 'Unauthorized' : v.error },
      { status },
    );
  }

  const metaCheck = assertGatewayObjectMetadata(json);
  if (!metaCheck.ok) {
    return NextResponse.json({ success: false, error: metaCheck.error }, { status: 400 });
  }

  const { bookingId, paymentId, intentId, amount, currency, gatewayRef, normalizedStatus } = parsePayload(
    json,
    adapterKey,
  );
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Missing bookingId' }, { status: 400 });
  }
  if (!isIntentPaidStatus(normalizedStatus)) {
    return NextResponse.json({
      success: true,
      ignored: true,
      reason: 'not_paid',
      normalizedStatus,
    });
  }

  const { data: booking, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (bErr || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  let payId = paymentId;
  if (!payId && !intentId) {
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

  const isLegacyPaymentsPath = !!(payId && !String(payId).startsWith('pi-') && !intentId);

  let resolvedIntentForEscrow = null;

  if (isLegacyPaymentsPath) {
    const expectedThb = await resolveExpectedGuestTotalThbFromBooking(booking);
    if (Number.isFinite(amount) && amount > 0 && String(currency || 'THB').toUpperCase() === 'THB') {
      const tol = 1.0;
      if (Math.abs(amount - expectedThb) > tol) {
        void notifySystemAlert(
          `💳 <b>Webhook payments/confirm</b> — расхождение суммы (legacy payments)\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>\nexpected THB: <b>${expectedThb}</b>, got: <b>${escapeSystemAlertHtml(String(amount))}</b>`,
        );
        return NextResponse.json(
          { success: false, error: 'AMOUNT_MISMATCH', expectedThb, received: amount },
          { status: 400 },
        );
      }
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

  const { intent: intentForAmount, error: intentResolveError } = await resolvePaymentIntentForWebhook({
    bookingId,
    intentIdFromPayload: intentId,
    paymentIdFromPayload: payId,
  });

  if (intentResolveError) {
    return NextResponse.json({ success: false, error: intentResolveError }, { status: 400 });
  }

  const expectedThb = intentForAmount
    ? Number(intentForAmount.amountThb)
    : await resolveExpectedGuestTotalThbFromBooking(booking);

  if (Number.isFinite(amount) && amount > 0 && String(currency || 'THB').toUpperCase() === 'THB') {
    const tol = 1.0;
    if (Math.abs(amount - expectedThb) > tol) {
      void notifySystemAlert(
        `💳 <b>Webhook payments/confirm</b> — расхождение суммы\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>\nexpected THB: <b>${expectedThb}</b> (${intentForAmount ? 'payment_intent' : 'booking'})\ngot: <b>${escapeSystemAlertHtml(String(amount))}</b>`,
      );
      return NextResponse.json(
        { success: false, error: 'AMOUNT_MISMATCH', expectedThb, received: amount },
        { status: 400 },
      );
    }
  }

  let intent = intentForAmount;
  if (!intent) {
    const explicitIntentId = intentId || (payId && String(payId).startsWith('pi-') ? payId : null);
    const intentLookup = explicitIntentId
      ? await PaymentIntentService.getById(explicitIntentId)
      : await PaymentIntentService.findActiveByBookingOrInvoice({ bookingId });
    if (!intentLookup.success || !intentLookup.intent) {
      return NextResponse.json(
        { success: false, error: 'No active payment intent for booking' },
        { status: 409 },
      );
    }
    intent = intentLookup.intent;
  }
  if (String(intent.bookingId) !== String(bookingId)) {
    return NextResponse.json({ success: false, error: 'INTENT_BOOKING_MISMATCH' }, { status: 400 });
  }

  const marked = await PaymentIntentService.markPaid(intent.id, {
    source: 'payment_acquiring_webhook',
    gatewayRef,
    raw: {
      ...json,
      normalized_status: normalizedStatus,
      adapter_key: adapterKey,
    },
  });
  if (!marked.success) {
    return NextResponse.json({ success: false, error: marked.error || 'intent_mark_failed' }, { status: 500 });
  }

  const captureGuestTotalThb = Number(intent.amountThb);
  const escrow = await EscrowService.moveToEscrow(bookingId, {
    txId: null,
    gatewayRef,
    source: 'payment_acquiring_webhook',
    captureGuestTotalThb: Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0 ? captureGuestTotalThb : undefined,
  });
  if (!escrow?.success) {
    return NextResponse.json({ success: false, error: escrow?.error || 'escrow_failed' }, { status: 502 });
  }
  await applyInvoicePostPaymentEffects({
    bookingId,
    invoiceId: intent.invoiceId || null,
    txId: null,
    gatewayRef,
    source: 'payment_acquiring_webhook',
  });

  return NextResponse.json({
    success: true,
    intentId: intent.id,
    bookingId,
    escrow: escrow.escrow || null,
  });
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'POST JSON with adapter signature (x-mandarin-signature | x-yookassa-signature | x-webhook-signature)',
    env: ['MANDARIN_WEBHOOK_SECRET', 'YOOKASSA_WEBHOOK_SECRET', 'PAYMENT_ACQUIRING_WEBHOOK_SECRET'],
  });
}
