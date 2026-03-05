/**
 * Gostaylo - TRON Transaction Verification API v2.0
 * POST /api/v2/payments/verify-tron
 * GET /api/v2/payments/verify-tron?txid=[TXID]&expectedAmount=[USDT]
 * 
 * Live verification with FULL AMOUNT check
 */

import { NextResponse } from 'next/server';
import { verifyTronTransaction, verifyTransactionWithBooking, getStatusBadge, GOSTAYLO_WALLET, thbToUsdt } from '@/lib/services/tron.service';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { txid, bookingId, expectedAmountUsdt, expectedAmountThb } = body;

    if (!txid) {
      return NextResponse.json(
        { success: false, error: 'TXID is required', status: 'INVALID' },
        { status: 400 }
      );
    }

    // Determine expected amount
    let expectedAmount = expectedAmountUsdt;
    
    // If booking ID provided, get the amount from booking
    if (bookingId && !expectedAmount) {
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('price_thb')
        .eq('id', bookingId)
        .single();
      
      if (booking?.price_thb) {
        // Add 15% service fee
        const totalThb = parseFloat(booking.price_thb) * 1.15;
        expectedAmount = thbToUsdt(totalThb);
      }
    }
    
    // Convert THB to USDT if provided
    if (expectedAmountThb && !expectedAmount) {
      expectedAmount = thbToUsdt(parseFloat(expectedAmountThb));
    }

    // Verify transaction with amount check
    const result = await verifyTronTransaction(txid, expectedAmount);
    const badge = getStatusBadge(result.status);

    // If bookingId provided and verification successful, update payment
    if (bookingId && result.success) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'CONFIRMED',
          metadata: {
            verification: result.data,
            verified_at: new Date().toISOString(),
            auto_verified: true
          }
        })
        .eq('booking_id', bookingId)
        .eq('status', 'PENDING');
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      badge,
      data: result.data,
      error: result.error,
      expectedWallet: GOSTAYLO_WALLET,
      amountVerification: result.data ? {
        received: result.data.amount,
        expected: result.data.expectedAmount,
        difference: result.data.amountDifference,
        percentage: result.data.amountPercentage,
        status: result.data.amountStatus,
        sufficient: result.data.isAmountSufficient
      } : null
    });

  } catch (error) {
    console.error('[VERIFY TRON API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message, status: 'ERROR' },
      { status: 500 }
    );
  }
}

// GET for quick status check
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const txid = searchParams.get('txid');
  const expectedAmount = searchParams.get('expectedAmount');
  const bookingId = searchParams.get('bookingId');

  if (!txid) {
    return NextResponse.json(
      { success: false, error: 'TXID query parameter is required' },
      { status: 400 }
    );
  }

  // Get expected amount from booking if provided
  let expectedUsdt = expectedAmount ? parseFloat(expectedAmount) : null;
  
  if (bookingId && !expectedUsdt) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('price_thb')
      .eq('id', bookingId)
      .single();
    
    if (booking?.price_thb) {
      const totalThb = parseFloat(booking.price_thb) * 1.15;
      expectedUsdt = thbToUsdt(totalThb);
    }
  }

  const result = await verifyTronTransaction(txid, expectedUsdt);
  const badge = getStatusBadge(result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    badge,
    data: result.data,
    error: result.error,
    expectedWallet: FUNNYRENT_WALLET,
    amountVerification: result.data ? {
      received: result.data.amount,
      expected: result.data.expectedAmount,
      difference: result.data.amountDifference,
      percentage: result.data.amountPercentage,
      status: result.data.amountStatus,
      sufficient: result.data.isAmountSufficient
    } : null
  });
}
