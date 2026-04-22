/**
 * POST /api/v2/bookings/[id]/payment/confirm
 * Confirm payment → PAID_ESCROW via EscrowService.moveToEscrow (ledger + payouts).
 * SECURITY: renter_id must match session when set.
 */

import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/services/session-service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { BookingService } from '@/lib/services/booking.service';
import EscrowService from '@/lib/services/escrow.service';
import { applyInvoicePostPaymentEffects } from '@/lib/services/invoice-extension.service';
import PaymentIntentService from '@/lib/services/payment-intent.service';

export const dynamic = 'force-dynamic';

/** States from which a guest payment can move the booking into escrow */
const PAYMENT_CONFIRM_ALLOWED = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PAID',
]);

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
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Booking is cancelled' }, { status: 400 });
    }

    const effectiveIntentId = intentId || booking?.metadata?.paymentIntentId || null

    if (booking.status === 'PAID_ESCROW') {
      if (effectiveIntentId) {
        await PaymentIntentService.markPaid(effectiveIntentId, {
          txId: txId || null,
          gatewayRef: gatewayRef || null,
          source: 'payment_confirm_idempotent',
        }).catch(() => {})
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
      });
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
    if (effectiveIntentId) {
      const ir = await PaymentIntentService.getById(effectiveIntentId);
      if (ir.success && ir.intent && String(ir.intent.bookingId) === String(bookingId)) {
        const n = Number(ir.intent.amountThb);
        if (Number.isFinite(n) && n > 0) captureGuestTotalThb = n;
      }
    }
    if (captureGuestTotalThb == null) {
      const active = await PaymentIntentService.findActiveByBookingOrInvoice({
        bookingId,
        invoiceId: invoiceId || null,
      });
      if (active.success && active.intent && String(active.intent.bookingId) === String(bookingId)) {
        const n = Number(active.intent.amountThb);
        if (Number.isFinite(n) && n > 0) captureGuestTotalThb = n;
      }
    }

    const escrow = await EscrowService.moveToEscrow(bookingId, {
      txId: txId || null,
      gatewayRef: gatewayRef || null,
      source: 'payment_confirm',
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
      `[PAYMENT CONFIRMED] Booking ${bookingId} | PAID_ESCROW | TX: ${txId || 'N/A'} | prev: ${previousStatus}`,
    );

    let resolvedInvoiceId = invoiceId || null
    if (!resolvedInvoiceId && effectiveIntentId) {
      const intentRes = await PaymentIntentService.getById(effectiveIntentId)
      if (intentRes.success && intentRes.intent && String(intentRes.intent.bookingId) === String(bookingId)) {
        resolvedInvoiceId = intentRes.intent.invoiceId || null
      }
    }

    if (effectiveIntentId) {
      await PaymentIntentService.markPaid(effectiveIntentId, {
        txId: txId || null,
        gatewayRef: gatewayRef || null,
        source: 'payment_confirm',
      })
    }

    const invoiceEffect = await applyInvoicePostPaymentEffects({
      bookingId,
      invoiceId: resolvedInvoiceId || null,
      txId: txId || null,
      gatewayRef: gatewayRef || null,
      source: 'payment_confirm',
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
