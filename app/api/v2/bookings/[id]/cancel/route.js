/**
 * POST /api/v2/bookings/[id]/cancel
 * Guest or host cancels booking; PAID_ESCROW / CHECKED_IN / THAWED → partial refund via Ledger (PR-#4/5).
 */

import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { isStaffRole } from '@/lib/services/chat/access';
import { supabaseAdmin } from '@/lib/supabase';
import { LedgerService } from '@/lib/services/ledger.service';
import EscrowService from '@/lib/services/escrow.service';
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';
import { computeRefundEstimateForBooking } from '@/lib/services/booking-refund-calculator.service';
import { BookingService } from '@/lib/services/booking.service';

export const dynamic = 'force-dynamic';

/** Had payment capture + escrow ledger */
const LEDGER_REFUND_STATUSES = new Set(['PAID_ESCROW', 'CHECKED_IN', 'THAWED']);

/** Cancel without ledger movement */
const SIMPLE_CANCEL_STATUSES = new Set([
  'PENDING',
  'INQUIRY',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
]);

export async function POST(request, context) {
  const params = await Promise.resolve(context.params);
  const bookingId = params?.id;
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 2000) : null;

  try {
    const session = await getSessionPayload();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userId = String(session.userId);
    const role = String(session.role || '').toUpperCase();

    const bookingBefore = await BookingService.getBookingById(bookingId);
    if (!bookingBefore) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    if (bookingBefore.status === 'CANCELLED') {
      return NextResponse.json({
        success: true,
        data: { bookingId, status: 'CANCELLED', alreadyCancelled: true },
      });
    }

    const isStaff = isStaffRole(role);
    const isRenter = bookingBefore.renter_id && String(bookingBefore.renter_id) === userId;
    const isPartner = bookingBefore.partner_id && String(bookingBefore.partner_id) === userId;
    if (!isStaff && !isRenter && !isPartner) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (['COMPLETED', 'REFUNDED'].includes(bookingBefore.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot cancel booking in status ${bookingBefore.status}` },
        { status: 409 },
      );
    }

    let estimate = { ok: false };
    let ledgerResult = null;

    if (LEDGER_REFUND_STATUSES.has(bookingBefore.status)) {
      estimate = await computeRefundEstimateForBooking(bookingId, new Date());
      if (!estimate.ok) {
        return NextResponse.json({ success: false, error: estimate.error || 'refund_estimate_failed' }, { status: 500 });
      }

      const fullBookingRow = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
      if (fullBookingRow.error || !fullBookingRow.data) {
        return NextResponse.json({ success: false, error: 'Booking load failed' }, { status: 500 });
      }

      if (estimate.refundGuestThb > 0) {
        ledgerResult = await LedgerService.postPartialRefundForBooking(fullBookingRow.data, {
          refundGuestThb: estimate.refundGuestThb,
          reason: reason || 'booking_cancel',
        });
        if (!ledgerResult.success) {
          return NextResponse.json(
            { success: false, error: ledgerResult.error || 'ledger_refund_failed', code: 'LEDGER_REFUND_FAILED' },
            { status: 502 },
          );
        }
      }

      try {
        await EscrowService.syncPartnerBalanceColumns(String(bookingBefore.partner_id));
      } catch (e) {
        console.warn('[cancel] syncPartnerBalanceColumns', e?.message);
      }
    } else if (!SIMPLE_CANCEL_STATUSES.has(bookingBefore.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cancellation not supported for status ${bookingBefore.status}`,
        },
        { status: 409 },
      );
    }

    const prevMeta =
      bookingBefore.metadata && typeof bookingBefore.metadata === 'object' ? bookingBefore.metadata : {};
    const cancelledAt = new Date().toISOString();
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'CANCELLED',
        cancelled_at: cancelledAt,
        metadata: {
          ...prevMeta,
          cancelled_by_user_id: userId,
          cancelled_at: cancelledAt,
          ...(reason ? { cancel_reason: reason } : {}),
          ...(estimate.ok && LEDGER_REFUND_STATUSES.has(bookingBefore.status)
            ? {
                cancel_refund_guest_thb: estimate.refundGuestThb,
                cancel_refund_percent: estimate.percent,
                cancel_policy: estimate.policy,
              }
            : {}),
        },
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ success: false, error: upErr?.message || 'update_failed' }, { status: 500 });
    }

    try {
      await syncBookingStatusToConversationChat({
        bookingId,
        previousStatus: bookingBefore.status,
        newStatus: 'CANCELLED',
        reasonFreeText: reason || undefined,
      });
    } catch (e) {
      console.error('[cancel] chat sync', e);
    }

    try {
      await NotificationService.dispatch(NotificationEvents.BOOKING_CANCELLED, {
        booking: updated,
        guest: bookingBefore.renter,
        listing: bookingBefore.listings,
        reason: reason || undefined,
      });
    } catch (e) {
      console.warn('[cancel] notification', e?.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        booking: updated,
        refundGuestThb: estimate.ok && LEDGER_REFUND_STATUSES.has(bookingBefore.status) ? estimate.refundGuestThb : 0,
        refundPercent: estimate.ok && LEDGER_REFUND_STATUSES.has(bookingBefore.status) ? estimate.percent : null,
        cancellationPolicy:
          estimate.ok && LEDGER_REFUND_STATUSES.has(bookingBefore.status) ? estimate.policy : null,
        guestTotalThb: estimate.ok && LEDGER_REFUND_STATUSES.has(bookingBefore.status) ? estimate.guestTotalThb : null,
        ledger: ledgerResult
          ? { success: ledgerResult.success, skipped: ledgerResult.skipped, journalId: ledgerResult.journalId }
          : null,
      },
    });
  } catch (error) {
    console.error('[BOOKING CANCEL]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
