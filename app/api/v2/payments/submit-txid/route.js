/**
 * FunnyRent 2.1 - Payment TXID Submit API
 * POST /api/v2/payments/submit-txid
 * 
 * Submits a TXID for crypto payment verification
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PaymentService, PaymentMethod } from '@/lib/services/payment.service';

export async function POST(request) {
  try {
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

    // Submit TXID and send notifications
    const result = await PaymentService.submitTxid(bookingId, txid, paymentMethod);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
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
