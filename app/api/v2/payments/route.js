/**
 * FunnyRent 2.1 - Payments Admin API
 * GET /api/v2/payments - List payments with filters
 * GET /api/v2/payments/pending-count - Count pending payments for badge
 */

import { NextResponse } from 'next/server';
import { PaymentService, PaymentStatus, PaymentMethod } from '@/lib/services/payment.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if requesting pending count only
    if (searchParams.get('count') === 'pending') {
      const result = await PaymentService.countPendingPayments();
      return NextResponse.json({
        success: true,
        count: result.count
      });
    }
    
    // Build filters
    const filters = {};
    
    const status = searchParams.get('status');
    if (status && Object.values(PaymentStatus).includes(status)) {
      filters.status = status;
    }
    
    const paymentMethod = searchParams.get('paymentMethod');
    if (paymentMethod && Object.values(PaymentMethod).includes(paymentMethod)) {
      filters.paymentMethod = paymentMethod;
    }
    
    const limit = searchParams.get('limit');
    if (limit) {
      filters.limit = parseInt(limit);
    }
    
    // Get pending payments if requested
    if (searchParams.get('pending') === 'true') {
      const result = await PaymentService.getPendingPayments(filters);
      return NextResponse.json({
        success: result.success,
        payments: result.payments,
        error: result.error
      });
    }
    
    // Get all payments with filters
    const result = await PaymentService.getPayments(filters);
    
    return NextResponse.json({
      success: result.success,
      payments: result.payments,
      count: result.payments.length,
      error: result.error
    });

  } catch (error) {
    console.error('[PAYMENTS API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, paymentId, verificationData, reason } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'confirm':
        result = await PaymentService.confirmPayment(paymentId, verificationData);
        break;
      
      case 'reject':
        result = await PaymentService.rejectPayment(paymentId, reason);
        break;
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: confirm, reject' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('[PAYMENTS ADMIN API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
