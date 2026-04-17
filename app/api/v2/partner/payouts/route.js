/**
 * GoStayLo - Partner Payouts API (v2)
 * GET /api/v2/partner/payouts - Get partner's payout history
 * POST /api/v2/partner/payouts - Request payout
 * SECURITY: partnerId must match session userId
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentsV3Service } from '@/lib/services/payments-v3.service';
import { getUserIdFromSession } from '@/lib/services/session-service';

export async function GET(request) {
  try {
    const sessionUserId = await getUserIdFromSession();
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerIdParam = searchParams.get('partnerId');
    /** Всегда только свои выплаты; partnerId из query игнорируется, если не совпадает с сессией */
    const partnerId = sessionUserId;
    if (partnerIdParam && partnerIdParam !== sessionUserId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    
    const { data: payouts, error } = await supabaseAdmin
      .from('payouts')
      .select('*, payout_method:payout_methods(id,name,channel,fee_type,value,currency), payout_profile:partner_payout_profiles(id,is_verified,is_default)')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Transform
    const transformed = payouts.map(p => ({
      id: p.id,
      amount: parseFloat(p.amount),
      grossAmount: parseFloat(p.gross_amount) || parseFloat(p.amount) || 0,
      payoutFeeAmount: parseFloat(p.payout_fee_amount) || 0,
      finalAmount: parseFloat(p.final_amount) || parseFloat(p.amount) || 0,
      currency: p.currency,
      method: p.method,
      payoutMethod: p.payout_method || null,
      payoutProfile: p.payout_profile || null,
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
    const sessionUserId = await getUserIdFromSession();
    if (!sessionUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      partnerId,
      amount,
      method,
      walletAddress,
      bankAccount,
      payoutProfileId,
    } = body;
    
    if (!partnerId || !amount) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: partnerId, amount' 
      }, { status: 400 });
    }

    if (partnerId !== sessionUserId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    
    // Request payout using service
    const result = await PaymentsV3Service.requestPayout(partnerId, amount, method || 'MANUAL', {
      walletAddress,
      bankAccount,
      payoutProfileId,
    });
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    
    console.log(`[PAYOUT] New payout request: ${result.payout.id} for ${amount} THB`);
    
    return NextResponse.json({
      success: true,
      data: result.payout,
      payoutMath: result.payoutMath || null,
    });
    
  } catch (error) {
    console.error('[PAYOUTS POST ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
