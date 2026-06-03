/**
 * GoStayLo - Payment TXID Submit API
 * POST /api/v2/payments/submit-txid
 *
 * Submits a TXID for crypto payment verification (checkout flow).
 * Stage 124.18: session + renter ownership required.
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentsV3Service, PaymentMethod } from '@/lib/services/payments-v3.service';
import { getSessionPayload, getUserIdFromSession } from '@/lib/services/session-service';
import { authErrorJson, AuthErrorCode } from '@/lib/auth/auth-error-codes';

const STAFF_ROLES = new Set(['ADMIN', 'MODERATOR']);

export async function POST(request) {
  try {
    const sessionUserId = await getUserIdFromSession();
    if (!sessionUserId) {
      return NextResponse.json(authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED), { status: 401 });
    }

    const body = await request.json();
    const { bookingId, txid, paymentMethod = PaymentMethod.USDT_TRC20 } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    if (!txid || txid.length < 60) {
      return NextResponse.json(
        { success: false, error: 'Valid TXID is required (64 characters)' },
        { status: 400 }
      );
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, renter_id')
      .eq('id', String(bookingId))
      .maybeSingle();

    if (bookingErr) {
      return NextResponse.json({ success: false, error: bookingErr.message }, { status: 500 });
    }
    if (!booking?.id) {
      return NextResponse.json(authErrorJson(AuthErrorCode.API_BOOKING_NOT_FOUND), { status: 404 });
    }

    const session = await getSessionPayload();
    const role = String(session?.role || '').toUpperCase();
    const isStaff = STAFF_ROLES.has(role);
    if (!booking.renter_id) {
      if (!isStaff) {
        return NextResponse.json(authErrorJson(AuthErrorCode.AUTH_NOT_AUTHENTICATED), { status: 401 });
      }
    } else if (!isStaff && String(booking.renter_id) !== String(sessionUserId)) {
      return NextResponse.json(authErrorJson(AuthErrorCode.AUTH_ACCESS_FORBIDDEN), { status: 403 });
    }

    const result = await PaymentsV3Service.submitTxid(bookingId, txid, paymentMethod);

    if (!result.success) {
      const status =
        result.statusCode ||
        (result.error === 'payment_already_finalized' || result.error === 'booking_payment_past_escrow'
          ? 409
          : 400);
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...(result.message ? { message: result.message } : {}),
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'TXID submitted successfully. Payment is pending verification.',
      payment: result.payment
    });

  } catch (error) {
    console.error('[SUBMIT TXID API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
