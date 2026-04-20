/**
 * GET /api/v2/bookings/[id]/cancel-preview
 * Renter (or staff): estimated refund before POST /cancel.
 */

import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { isStaffRole } from '@/lib/services/chat/access';
import { BookingService } from '@/lib/services/booking.service';
import { computeRefundEstimateForBooking } from '@/lib/services/booking-refund-calculator.service';

export const dynamic = 'force-dynamic';

const LEDGER_REFUND_STATUSES = new Set(['PAID_ESCROW', 'CHECKED_IN', 'THAWED']);
const SIMPLE_CANCEL_STATUSES = new Set([
  'PENDING',
  'INQUIRY',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
]);

export async function GET(request, context) {
  const params = await Promise.resolve(context.params);
  const bookingId = params?.id;
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }

  try {
    const session = await getSessionPayload();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userId = String(session.userId);
    const role = String(session.role || '').toUpperCase();
    const isStaff = isStaffRole(role);

    const booking = await BookingService.getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const isRenter = booking.renter_id && String(booking.renter_id) === userId;
    if (!isStaff && !isRenter) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json({
        success: true,
        data: { cancellable: false, reason: 'already_cancelled', status: booking.status },
      });
    }

    if (['COMPLETED', 'REFUNDED'].includes(booking.status)) {
      return NextResponse.json({
        success: true,
        data: {
          cancellable: false,
          reason: 'terminal_status',
          status: booking.status,
        },
      });
    }

    const estimate = await computeRefundEstimateForBooking(bookingId, new Date());
    if (!estimate.ok) {
      return NextResponse.json(
        { success: false, error: estimate.error || 'estimate_failed' },
        { status: 500 },
      );
    }

    const willUseLedger = LEDGER_REFUND_STATUSES.has(booking.status);
    const simpleCancel = SIMPLE_CANCEL_STATUSES.has(booking.status);

    return NextResponse.json({
      success: true,
      data: {
        cancellable: willUseLedger || simpleCancel,
        status: booking.status,
        policy: estimate.policy,
        refundGuestThb: willUseLedger ? estimate.refundGuestThb : 0,
        refundPercent: willUseLedger ? estimate.percent : null,
        guestTotalThb: willUseLedger ? estimate.guestTotalThb : null,
        hoursBeforeCheckIn: estimate.hoursBefore,
        ledgerRefund: willUseLedger,
        simpleCancelOnly: simpleCancel && !willUseLedger,
      },
    });
  } catch (error) {
    console.error('[CANCEL-PREVIEW]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
