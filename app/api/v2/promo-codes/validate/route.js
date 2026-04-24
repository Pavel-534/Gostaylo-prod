/**
 * GoStayLo - Promo Code Validation API (v2)
 * POST /api/v2/promo-codes/validate - Validate a promo code
 */

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { PricingService } from '@/lib/services/pricing.service';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { code, amount, bookingAmount, listingId } = body;
    
    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Promo code is required' 
      }, { status: 400 });
    }
    
    const rawAmount = amount ?? bookingAmount;
    const bookingAmountNum = parseFloat(rawAmount) || 0;

    let listingOwnerId = null;
    const lid = listingId != null && listingId !== '' ? String(listingId).trim() : '';
    if (lid && supabaseAdmin) {
      const { data: listingRow } = await supabaseAdmin
        .from('listings')
        .select('owner_id')
        .eq('id', lid)
        .maybeSingle();
      listingOwnerId = listingRow?.owner_id ?? null;
    }

    const result = await PricingService.validatePromoCode(code, bookingAmountNum, {
      listingOwnerId,
      listingId: lid || null,
    });
    
    if (!result.valid) {
      return NextResponse.json({ 
        success: false, 
        valid: false,
        error: result.error 
      }, { status: 400 });
    }
    
    console.log(`[PROMO] Code validated: ${code} - Discount: ${result.discountAmount} THB`);
    
    return NextResponse.json({ 
      success: true, 
      valid: true,
      data: {
        code: result.code,
        type: result.type,
        value: result.value,
        discountAmount: result.discountAmount,
        newTotal: result.newTotal,
        flashSale: Boolean(result.flashSale),
        promoEndsAt: result.promoEndsAt ?? null,
        secondsRemaining:
          result.secondsRemaining != null && Number.isFinite(Number(result.secondsRemaining))
            ? Number(result.secondsRemaining)
            : null,
      }
    });
    
  } catch (error) {
    console.error('[PROMO VALIDATION ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
