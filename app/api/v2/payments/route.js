/**
 * GoStayLo - Payments Admin API
 * GET /api/v2/payments - List payments with filters
 * GET /api/v2/payments/pending-count - Count pending payments for badge
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PaymentsV3Service, PaymentStatus, PaymentMethod } from '@/lib/services/payments-v3.service';
import { requireAccess } from '@/lib/security/access-guard';

async function requireAdminAccess() {
  const access = await requireAccess({ roles: ['ADMIN'] });
  if (access.error) return access.error;
  return null;
}

export async function GET(request) {
  const denied = await requireAdminAccess();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    
    // Check if requesting pending count only
    if (searchParams.get('count') === 'pending') {
      const result = await PaymentsV3Service.countPendingPayments();
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
      const result = await PaymentsV3Service.getPendingPayments(filters);
      return NextResponse.json({
        success: result.success,
        payments: result.payments,
        error: result.error
      });
    }
    
    // Get all payments with filters
    const result = await PaymentsV3Service.getPayments(filters);
    
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
  const denied = await requireAdminAccess();
  if (denied) return denied;
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
        result = await PaymentsV3Service.confirmPayment(paymentId, verificationData);
        break;
      
      case 'reject':
        result = await PaymentsV3Service.rejectPayment(paymentId, reason);
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
