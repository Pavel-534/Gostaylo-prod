/**
 * FunnyRent 2.1 - TRON Transaction Verification API
 * POST /api/v2/payments/verify-tron
 * 
 * Live verification of USDT TRC-20 transactions via TronScan API
 */

import { NextResponse } from 'next/server';
import { verifyTronTransaction, getStatusBadge, FUNNYRENT_WALLET } from '@/lib/services/tron.service';
import { PaymentService } from '@/lib/services/payment.service';

export async function POST(request) {
  try {
    const body = await request.json();
    const { txid, bookingId } = body;

    if (!txid) {
      return NextResponse.json(
        { success: false, error: 'TXID is required', status: 'INVALID' },
        { status: 400 }
      );
    }

    // Verify transaction using TronScan API
    const result = await verifyTronTransaction(txid);
    const badge = getStatusBadge(result.status);

    // If bookingId provided, update payment record
    if (bookingId && result.success) {
      await PaymentService.verifyCryptoPayment(bookingId, txid);
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      badge,
      data: result.data,
      error: result.error,
      expectedWallet: FUNNYRENT_WALLET
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

  if (!txid) {
    return NextResponse.json(
      { success: false, error: 'TXID query parameter is required' },
      { status: 400 }
    );
  }

  const result = await verifyTronTransaction(txid);
  const badge = getStatusBadge(result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    badge,
    data: result.data,
    error: result.error,
    expectedWallet: FUNNYRENT_WALLET
  });
}
