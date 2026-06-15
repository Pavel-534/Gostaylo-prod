/**
 * POST /api/v2/bookings/[id]/payment/confirm
 * Confirm payment → PAID_ESCROW via EscrowService.moveToEscrow (ledger + payouts).
 * Stage 106.1: in production CARD/MIR confirm only after gateway webhook (intent PAID).
 */

import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/services/session-service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { BookingService } from '@/lib/services/booking.service';
import EscrowService from '@/lib/services/escrow.service';
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service';
import PaymentIntentService from '@/lib/services/payment-intent.service';
import { ensureProfileLegalConsentForPayment } from '@/lib/legal-consent';
import { assertClientPaymentConfirmAllowed } from '@/lib/payment/payment-production-guard.js';

export const dynamic = 'force-dynamic';

/** States from which a guest payment can move the booking into escrow */
const PAYMENT_CONFIRM_ALLOWED = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PAID',
]);

async function resolveIntentForConfirm({ effectiveIntentId, bookingId, invoiceId }) {
  if (effectiveIntentId) {
    const ir = await PaymentIntentService.getById(effectiveIntentId);
    if (ir.success && ir.intent && String(ir.intent.bookingId) === String(bookingId)) {
      return ir.intent;
    }
  }
  const active = await PaymentIntentService.findActiveByBookingOrInvoice({
    bookingId,
    invoiceId: invoiceId || null,
  });
  if (active.success && active.intent && String(active.intent.bookingId) === String(bookingId)) {
    return active.intent;
  }
  return null;
}

export async function POST(request, { params }) {
  const bookingId = params.id;

  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { txId, gatewayRef, invoiceId, intentId } = body;

    const booking = await BookingService.getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const previousStatus = booking.status;

    const sessionUserId = await getUserIdFromSession();
    if (booking.renter_id) {
      if (!sessionUserId) {
        return NextResponse.json({ success: false, error: 'Please log in to complete payment' }, { status: 401 });
      }
      if (booking.renter_id !== sessionUserId) {
        return NextResponse.json(
          { success: false, error: 'Access denied. This is not your booking.' },
          { status: 403 },
        );
      }

      const consent = await ensureProfileLegalConsentForPayment(
        sessionUserId,
        body?.acceptedLegalTerms,
        bookingId,
      );
      if (!consent.ok) {
        return NextResponse.json(
          {
            success: false,
            error: consent.error,
            code: consent.code || 'LEGAL_CONSENT_BLOCKED',
          },
          { status: consent.status || 403 },
        );
      }
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Booking is cancelled' }, { status: 400 });
    }

    const effectiveIntentId = intentId || booking?.metadata?.paymentIntentId || null;
    const resolvedIntent = await resolveIntentForConfirm({
      effectiveIntentId,
      bookingId,
      invoiceId,
    });

    const gate = await assertClientPaymentConfirmAllowed({
      intent: resolvedIntent,
      paymentMethod: resolvedIntent?.metadata?.selected_method,
      txId,
      booking,
      bookingId,
    });

    if (!gate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: gate.message || 'Payment not confirmed by gateway',
          code: gate.code || 'PAYMENT_NOT_CONFIRMED_BY_GATEWAY',
        },
        { status: 403 },
      );
    }

    if (booking.status === 'PAID_ESCROW') {
      const resolvedInvoiceIdEarly =
        invoiceId || resolvedIntent?.invoiceId || null
      if (resolvedInvoiceIdEarly) {
        const intentIdForMark = effectiveIntentId || resolvedIntent?.id || null
        if (!gate.skipClientMarkPaid && intentIdForMark) {
          const paidSource =
            gate.mode === 'crypto_tx_verified' ? 'verify_tron_api' : 'payment_confirm'
          const marked = await PaymentIntentService.markPaid(intentIdForMark, {
            txId: txId || null,
            gatewayRef: gatewayRef || null,
            source: paidSource,
            raw: gate.tron || null,
          })
          if (!marked.success) {
            return NextResponse.json(
              { success: false, error: marked.error || 'Failed to mark intent paid' },
              { status: 502 },
            )
          }
        }

        const invoiceEffect = await applyInvoicePostPaymentEffects({
          bookingId,
          invoiceId: resolvedInvoiceIdEarly,
          txId: txId || null,
          gatewayRef: gatewayRef || null,
          source: gate.skipClientMarkPaid
            ? 'payment_confirm_gateway_sync'
            : 'payment_confirm_post_escrow',
        })

        return NextResponse.json({
          success: true,
          data: {
            bookingId,
            status: 'PAID_ESCROW',
            alreadyEscrowed: true,
            postEscrowInvoice: true,
            transactionId: txId,
            confirmedAt: new Date().toISOString(),
            invoiceEffect,
            confirmMode: gate.mode,
          },
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          bookingId,
          status: 'PAID_ESCROW',
          alreadyEscrowed: true,
          transactionId: txId,
          confirmedAt: new Date().toISOString(),
        },
      })
    }

    if (!PAYMENT_CONFIRM_ALLOWED.has(booking.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment cannot be confirmed from status ${booking.status}`,
        },
        { status: 400 },
      );
    }

    try {
      await BookingService.attachSettlementSnapshotForBooking(bookingId);
    } catch (e) {
      console.error('[PAYMENT CONFIRM] settlement snapshot attach', e);
    }

    let captureGuestTotalThb;
    let isTestModePayment = false;
    if (resolvedIntent) {
      const n = Number(resolvedIntent.amountThb);
      if (Number.isFinite(n) && n > 0) captureGuestTotalThb = n;
      const mode = String(resolvedIntent?.metadata?.provider_payload?.mode || '').toLowerCase();
      isTestModePayment = mode.includes('mock');
    }

    const intentIdForMark = effectiveIntentId || resolvedIntent?.id || null;

    if (!gate.skipClientMarkPaid && intentIdForMark) {
      const paidSource = gate.mode === 'crypto_tx_verified' ? 'verify_tron_api' : 'payment_confirm';
      const marked = await PaymentIntentService.markPaid(intentIdForMark, {
        txId: txId || null,
        gatewayRef: gatewayRef || null,
        source: paidSource,
        raw: gate.tron || null,
      });
      if (!marked.success) {
        return NextResponse.json(
          { success: false, error: marked.error || 'Failed to mark intent paid' },
          { status: 502 },
        );
      }
    }

    const escrow = await EscrowService.moveToEscrow(bookingId, {
      txId: txId || null,
      gatewayRef: gatewayRef || null,
      source: gate.skipClientMarkPaid ? 'payment_confirm_gateway_sync' : 'payment_confirm',
      captureGuestTotalThb,
    });

    if (!escrow?.success) {
      void notifySystemAlert(
        `💳 <b>Платёж: escrow не выполнен</b>\n` +
          `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
          `<code>${escapeSystemAlertHtml(String(escrow?.error || '').slice(0, 800))}</code>`,
      );
      return NextResponse.json(
        { success: false, error: escrow?.error || 'Failed to confirm payment' },
        { status: 502 },
      );
    }

    console.log(
      `[PAYMENT CONFIRMED] Booking ${bookingId} | PAID_ESCROW | TX: ${txId || 'N/A'} | prev: ${previousStatus} | mode: ${gate.mode}`,
    );
    if (isTestModePayment) {
      console.warn(`⚠️ ВНИМАНИЕ: Проведен тестовый платеж (MOCK_MODE) для брони ${bookingId}`);
    }

    let resolvedInvoiceId = invoiceId || null;
    if (!resolvedInvoiceId && resolvedIntent) {
      resolvedInvoiceId = resolvedIntent.invoiceId || null;
    }

    const invoiceEffect = await applyInvoicePostPaymentEffects({
      bookingId,
      invoiceId: resolvedInvoiceId || null,
      txId: txId || null,
      gatewayRef: gatewayRef || null,
      source: gate.skipClientMarkPaid ? 'payment_confirm_gateway_sync' : 'payment_confirm',
    });

    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        status: 'PAID_ESCROW',
        transactionId: txId,
        confirmedAt: new Date().toISOString(),
        escrow: escrow.escrow || null,
        alreadyEscrowed: !!escrow.alreadyEscrowed,
        invoiceEffect,
        confirmMode: gate.mode,
      },
    });
  } catch (error) {
    console.error('[PAYMENT-CONFIRM ERROR]', error);
    void notifySystemAlert(
      `💳 <b>Платёж: ошибка confirm</b>\n` +
        `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return NextResponse.json({ success: false, error: 'Failed to confirm payment' }, { status: 500 });
  }
}
