/**
 * Gostaylo - Partner Payouts API (v2)
 * GET /api/v2/partner/payouts - Get partner's payout history
 * POST /api/v2/partner/payouts - Request payout
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentService } from '@/lib/services/payment.service';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    
    if (!partnerId) {
      return NextResponse.json({ 
        success: false, 
        error: 'partnerId is required' 
      }, { status: 400 });
    }
    
    const { data: payouts, error } = await supabaseAdmin
      .from('payouts')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Transform
    const transformed = payouts.map(p => ({
      id: p.id,
      amount: parseFloat(p.amount),
      currency: p.currency,
      method: p.method,
      status: p.status,
      walletAddress: p.wallet_address,
      transactionId: p.transaction_id,
      rejectionReason: p.rejection_reason,
      createdAt: p.created_at,
      processedAt: p.processed_at
    }));
    
    return NextResponse.json({ 
      success: true, 
      data: transformed
    });
    
  } catch (error) {
    console.error('[PAYOUTS GET ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { partnerId, amount, method, walletAddress, bankAccount } = body;
    
    if (!partnerId || !amount || !method) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: partnerId, amount, method' 
      }, { status: 400 });
    }
    
    // Request payout using service
    const result = await PaymentService.requestPayout(partnerId, amount, method, {
      walletAddress,
      bankAccount
    });
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
    console.log(`[PAYOUT] New payout request: ${result.payout.id} for ${amount} THB`);
    
    return NextResponse.json({ success: true, data: result.payout });
    
  } catch (error) {
    console.error('[PAYOUTS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
