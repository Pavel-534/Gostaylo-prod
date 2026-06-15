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
import { recordTreasuryWebhookError } from '@/lib/treasury/treasury-monitoring-alerts.js';
import {
  resolveAdapterFromWebhook,
  verifyWebhookSignatureByAdapter,
} from '@/lib/services/payment-adapters/webhook-signature';
import { verifyPaymentWebhookIp } from '@/lib/payment/webhook-ip-allowlist.js';
import {
  isIntentPaidStatus,
  normalizeProviderStatus,
} from '@/lib/services/payment-adapters/status-normalizer';
import {
  resolveAcquirerChargeAmount,
  verifyWebhookPaidAmount,
} from '@/lib/services/payment-adapters/acquirer-charge-amount.js';
import { ADAPTER_KEYS } from '@/lib/services/payment-adapters/constants';
import { assertWebhookGuestPaymentAllowed } from '@/lib/payment/webhook-guest-payment-gate.js';
import { isPaymentAcquiringWebhookIdempotentBookingStatus } from '@/lib/booking/status-sets.js';
import { formatRubAmountValue, getPayment } from '@/lib/payments/yookassa.js';
import { touchControlledLiveMirFirstPaymentAlert, touchControlledLiveMirSoftLimit } from '@/lib/payment/controlled-live-mir-guard.js';

export const dynamic = 'force-dynamic';

/**
 * PSP retries after successful capture: booking row is SSOT (PAID_ESCROW+ pipeline / COMPLETED).
 * We return HTTP 2xx without markPaid / moveToEscrow — intent status may lag or differ on duplicate events.
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

/**
 * Post-escrow extension invoice: booking already in capture pipeline, intent carries invoiceId.
 */
async function tryPostEscrowInvoiceFromWebhook({
  booking,
  bookingId,
  intentIdFromPayload,
  gatewayRef,
  json,
}) {
  if (!isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
    return null;
  }

  const { intent, error: intentResolveError } = await resolvePaymentIntentForWebhook({
    bookingId,
    intentIdFromPayload,
    paymentIdFromPayload: null,
  });
  if (intentResolveError || !intent?.invoiceId) return null;

  const marked = await PaymentIntentService.markPaid(intent.id, {
    source: 'payment_acquiring_webhook_post_escrow',
    gatewayRef: gatewayRef || null,
    raw: json,
  });
  if (!marked.success) {
    console.warn('[payments/confirm] post-escrow markPaid:', marked.error);
  }

  const invoiceEffect = await applyInvoicePostPaymentEffects({
    bookingId,
    invoiceId: intent.invoiceId,
    txId: null,
    gatewayRef: gatewayRef || null,
    source: 'payment_acquiring_webhook_post_escrow',
  });

  const status = String(booking.status || '').toUpperCase();
  return NextResponse.json({
    success: true,
    bookingId,
    intentId: intent.id,
    idempotent: true,
    alreadyProcessed: true,
    postEscrowInvoice: true,
    bookingStatus: status,
    ...(status === 'PAID_ESCROW' ? { alreadyEscrowed: true } : {}),
    invoiceEffect,
  });
}

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

/**
 * Stage 130.2 — YooKassa: GET payment verify + strict RUB amount + metadata (after IP allowlist).
 */
function isSmokeYookassaGatewayRef(gatewayRef) {
  return (
    process.env.SMOKE_FINANCIAL_RUN === '1' && String(gatewayRef || '').startsWith('smoke-yk-')
  );
}

async function verifyYookassaGatewayPayment({
  gatewayRef,
  bookingId,
  intentIdFromPayload,
  paymentIdFromPayload,
  booking,
  webhookAmount,
  webhookCurrency,
}) {
  if (!gatewayRef) {
    return { ok: false, error: 'YOOKASSA_VERIFY_FAILED', code: 'missing_gateway_ref' };
  }

  const expectedBookingId = String(bookingId);
  const expectedIntentId = String(intentIdFromPayload || '');

  if (!expectedIntentId) {
    return {
      ok: false,
      error: 'YOOKASSA_VERIFY_FAILED',
      code: 'missing_payment_intent_id',
    };
  }

  const smokeGateway = isSmokeYookassaGatewayRef(gatewayRef);
  let verified = null;

  if (!smokeGateway) {
    verified = await getPayment(gatewayRef);
    if (!verified.ok || verified.status !== 'succeeded' || !verified.paid) {
      return {
        ok: false,
        error: 'YOOKASSA_VERIFY_FAILED',
        code: verified.code || 'payment_not_succeeded',
        verified,
      };
    }

    const md = verified.metadata || {};
    const metaBookingId = String(md.booking_id || md.bookingId || '');
    const metaIntentId = String(md.payment_intent_id || md.paymentIntentId || '');

    if (!metaBookingId || metaBookingId !== expectedBookingId) {
      return {
        ok: false,
        error: 'YOOKASSA_VERIFY_FAILED',
        code: 'metadata_booking_mismatch',
        expected: { booking_id: expectedBookingId },
        received: { booking_id: metaBookingId },
      };
    }
    if (!metaIntentId || metaIntentId !== expectedIntentId) {
      return {
        ok: false,
        error: 'YOOKASSA_VERIFY_FAILED',
        code: 'metadata_intent_mismatch',
        expected: { payment_intent_id: expectedIntentId },
        received: { payment_intent_id: metaIntentId },
      };
    }
  }

  const { intent, error: intentResolveError } = await resolvePaymentIntentForWebhook({
    bookingId,
    intentIdFromPayload: expectedIntentId,
    paymentIdFromPayload,
  });
  if (intentResolveError) {
    return { ok: false, error: intentResolveError, code: 'intent_resolve' };
  }

  let expectedRubFormatted;
  try {
    const charge = resolveAcquirerChargeAmount({
      booking,
      intent,
      adapterKey: ADAPTER_KEYS.MIR_RU,
    });
    expectedRubFormatted = formatRubAmountValue(charge.acquirerAmount ?? charge.amount);
  } catch (e) {
    return {
      ok: false,
      error: e?.code || 'ACQUIRER_RUB_AMOUNT_UNAVAILABLE',
      code: 'expected_rub_unavailable',
    };
  }

  const receivedRubFormatted = smokeGateway
    ? formatRubAmountValue(webhookAmount)
    : formatRubAmountValue(verified?.amount?.value);

  const receivedCurrency = smokeGateway
    ? String(webhookCurrency || 'RUB').toUpperCase()
    : String(verified?.amount?.currency || 'RUB').toUpperCase();

  if (receivedCurrency !== 'RUB') {
    return {
      ok: false,
      error: 'YOOKASSA_AMOUNT_MISMATCH',
      code: 'currency_not_rub',
      expected: { amount: expectedRubFormatted, currency: 'RUB' },
      received: { amount: receivedRubFormatted, currency: receivedCurrency },
    };
  }

  if (!expectedRubFormatted || !receivedRubFormatted || receivedRubFormatted !== expectedRubFormatted) {
    return {
      ok: false,
      error: 'YOOKASSA_AMOUNT_MISMATCH',
      expected: { amount: expectedRubFormatted, currency: 'RUB' },
      received: { amount: receivedRubFormatted, currency: receivedCurrency },
    };
  }

  return { ok: true, verified, intent, smokeGateway };
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

  const ipCheck = verifyPaymentWebhookIp({ adapterKey, request });
  if (!ipCheck.ok) {
    void recordTreasuryWebhookError({
      error: ipCheck.error || 'ip_rejected',
      context: `adapter=${adapterKey} ip=${ipCheck.ip || 'unknown'}`,
    });
    return NextResponse.json(
      { success: false, error: 'Forbidden', code: ipCheck.error },
      { status: 403 },
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

  const guestGate = await assertWebhookGuestPaymentAllowed({
    bookingId,
    channel: 'payments/confirm',
    paymentMethod: adapterKey === 'MIR_RU' ? 'MIR' : null,
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

  if (isPaymentAcquiringWebhookIdempotentBookingStatus(booking.status)) {
    const postEscrow = await tryPostEscrowInvoiceFromWebhook({
      booking,
      bookingId,
      intentIdFromPayload: intentId,
      gatewayRef,
      json,
    });
    if (postEscrow) return postEscrow;
    return idempotentPaidBookingResponse(booking);
  }

  if (adapterKey === ADAPTER_KEYS.MIR_RU) {
    void touchControlledLiveMirSoftLimit({ booking })
    const ykVerify = await verifyYookassaGatewayPayment({
      gatewayRef,
      bookingId,
      intentIdFromPayload: intentId,
      paymentIdFromPayload: paymentId,
      booking,
      webhookAmount: amount,
      webhookCurrency: currency,
    });
    if (!ykVerify.ok) {
      void recordTreasuryWebhookError({
        error: ykVerify.error || 'yookassa_verify_failed',
        bookingId,
        context: `code=${ykVerify.code || ''} expected=${JSON.stringify(ykVerify.expected || {})} received=${JSON.stringify(ykVerify.received || {})}`,
      });
      if (ykVerify.error === 'YOOKASSA_AMOUNT_MISMATCH') {
        void notifySystemAlert(
          `💳 <b>Webhook YooKassa</b> — сумма не совпала\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>\nexpected RUB: <b>${escapeSystemAlertHtml(String(ykVerify.expected?.amount || ''))}</b>\ngot: <b>${escapeSystemAlertHtml(String(ykVerify.received?.amount || ''))}</b>`,
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: ykVerify.error,
          code: ykVerify.code || null,
          expected: ykVerify.expected || null,
          received: ykVerify.received || null,
        },
        { status: 400 },
      );
    }
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
      void recordTreasuryWebhookError({
        error: confirm?.error || 'confirmPayment failed',
        bookingId,
        context: 'legacy confirmPayment',
      });
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

  const amountCheck = verifyWebhookPaidAmount({
    receivedAmount: amount,
    receivedCurrency: currency,
    booking,
    intent: intentForAmount,
    adapterKey,
  });
  if (!amountCheck.ok) {
    void notifySystemAlert(
      `💳 <b>Webhook payments/confirm</b> — ${escapeSystemAlertHtml(amountCheck.error || 'amount_check')}\nbooking: <code>${escapeSystemAlertHtml(bookingId)}</code>\nexpected: <b>${escapeSystemAlertHtml(JSON.stringify(amountCheck.expected))}</b>\ngot: <b>${escapeSystemAlertHtml(JSON.stringify(amountCheck.received))}</b>`,
    );
    void recordTreasuryWebhookError({
      error: amountCheck.error || 'amount_check',
      bookingId,
      context: `expected ${JSON.stringify(amountCheck.expected)} got ${JSON.stringify(amountCheck.received)}`,
    });
    return NextResponse.json(
      {
        success: false,
        error: amountCheck.error,
        expected: amountCheck.expected,
        received: amountCheck.received,
      },
      { status: 400 },
    );
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
    void recordTreasuryWebhookError({
      error: marked.error || 'intent_mark_failed',
      bookingId,
      context: 'PaymentIntentService.markPaid',
    });
    return NextResponse.json({ success: false, error: marked.error || 'intent_mark_failed' }, { status: 500 });
  }

  const { data: bookingAfterMark } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingAfterMark && isPaymentAcquiringWebhookIdempotentBookingStatus(bookingAfterMark.status)) {
    if (intent.invoiceId) {
      const invoiceEffect = await applyInvoicePostPaymentEffects({
        bookingId,
        invoiceId: intent.invoiceId,
        txId: null,
        gatewayRef,
        source: 'payment_acquiring_webhook_post_escrow',
      });
      const status = String(bookingAfterMark.status || '').toUpperCase();
      return NextResponse.json({
        success: true,
        intentId: intent.id,
        bookingId,
        idempotent: true,
        alreadyProcessed: true,
        postEscrowInvoice: true,
        bookingStatus: status,
        ...(status === 'PAID_ESCROW' ? { alreadyEscrowed: true } : {}),
        invoiceEffect,
      });
    }
    return idempotentPaidBookingResponse(bookingAfterMark);
  }

  const captureGuestTotalThb = Number(intent.amountThb);
  const escrow = await EscrowService.moveToEscrow(bookingId, {
    txId: null,
    gatewayRef,
    source: 'payment_acquiring_webhook',
    captureGuestTotalThb: Number.isFinite(captureGuestTotalThb) && captureGuestTotalThb > 0 ? captureGuestTotalThb : undefined,
  });
  if (!escrow?.success) {
    void recordTreasuryWebhookError({
      error: escrow?.error || 'escrow_failed',
      bookingId,
      context: 'EscrowService.moveToEscrow',
    });
    return NextResponse.json({ success: false, error: escrow?.error || 'escrow_failed' }, { status: 502 });
  }
  await applyInvoicePostPaymentEffects({
    bookingId,
    invoiceId: intent.invoiceId || null,
    txId: null,
    gatewayRef,
    source: 'payment_acquiring_webhook',
  });

  if (adapterKey === ADAPTER_KEYS.MIR_RU) {
    void touchControlledLiveMirFirstPaymentAlert({
      booking: bookingAfterMark || booking,
      payment: {
        payment_method: 'MIR',
        method: 'MIR',
        source: 'payment_acquiring_webhook',
        amount: captureGuestTotalThb,
      },
    })
  }

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
